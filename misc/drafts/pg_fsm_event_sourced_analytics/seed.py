import argparse
import os
import random
from datetime import datetime, timedelta

import psycopg2
from dotenv import load_dotenv

# state -> [(event, next_state, weight), ...]
TRANSITIONS = {
    "start": [("create", "awaiting_payment", 1.0)],
    "awaiting_payment": [
        ("pay", "awaiting_shipment", 0.85),
        ("cancel", "canceled", 0.15),
    ],
    "awaiting_shipment": [
        ("ship", "shipped", 0.92),
        ("cancel", "awaiting_refund", 0.08),
    ],
    "awaiting_refund": [("refund", "canceled", 1.0)],
    "shipped": [],
    "canceled": [],
}

# hours between events (min, max) - normal conditions
TIME_DELTAS = {
    "create": (0, 0),
    "pay": (0.5, 48),
    "cancel": (1, 72),
    "ship": (4, 48),
    "refund": (24, 120),
}

# anomaly: shipping delays (min, max hours)
ANOMALY_SHIP_DELTA = (48, 240)

# default anomaly months (1-indexed)
DEFAULT_ANOMALY_MONTHS = [6, 7]  # june, july


def pick_transition(choices):
    total = sum(c[2] for c in choices)
    r = random.random() * total
    cumulative = 0
    for event, next_state, weight in choices:
        cumulative += weight
        if r <= cumulative:
            return event, next_state
    return choices[-1][:2]


def get_time_delta(event, current_time, anomaly_months):
    if event == "ship" and current_time.month in anomaly_months:
        min_h, max_h = ANOMALY_SHIP_DELTA
    else:
        min_h, max_h = TIME_DELTAS[event]
    return timedelta(hours=random.uniform(min_h, max_h))


def generate_order_events(start_time, anomaly_months):
    events = []
    state = "start"
    current_time = start_time

    while TRANSITIONS.get(state):
        event, next_state = pick_transition(TRANSITIONS[state])
        current_time += get_time_delta(event, current_time, anomaly_months)
        events.append((event, current_time))
        state = next_state

    return events


def generate_orders(n, year_start, anomaly_months):
    orders = []

    for _ in range(n):
        # spread order creation across ~11 months
        start_time = year_start + timedelta(
            days=random.uniform(0, 330),
            hours=random.uniform(0, 23),
            minutes=random.uniform(0, 59),
        )
        events = generate_order_events(start_time, anomaly_months)

        orders.append(
            {
                "created_at": events[0][1],
                "events": events,
            }
        )

    orders.sort(key=lambda o: o["created_at"])
    return orders


def flatten_and_sort_events(orders):
    """
    returns all events across all orders sorted by occurred_at.
    each event includes its order index for later id lookup.
    """
    all_events = []
    for order_idx, order in enumerate(orders):
        for event, occurred_at in order["events"]:
            all_events.append(
                {
                    "order_idx": order_idx,
                    "event": event,
                    "occurred_at": occurred_at,
                }
            )
    all_events.sort(key=lambda e: e["occurred_at"])
    return all_events


def seed_database(conn, orders):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM order_events")
        cur.execute("DELETE FROM orders")
        cur.execute("ALTER SEQUENCE orders_id_seq RESTART WITH 1")

        # insert orders, store mapping from order_idx to db id
        order_id_map = {}
        for idx, order in enumerate(orders):
            cur.execute(
                "INSERT INTO orders (created_at) VALUES (%s) RETURNING id",
                (order["created_at"],),
            )
            order_id_map[idx] = cur.fetchone()[0]

        # flatten and sort all events globally by occurred_at
        all_events = flatten_and_sort_events(orders)

        for evt in all_events:
            order_id = order_id_map[evt["order_idx"]]
            cur.execute(
                "INSERT INTO order_events (order_id, event, occured_at) VALUES (%s, %s, %s)",
                (order_id, evt["event"], evt["occurred_at"]),
            )

        conn.commit()


def print_stats(conn, anomaly_months):
    with conn.cursor() as cur:
        # final state distribution
        cur.execute(
            """
            with final_states as (
                select order_events_fsm(event order by id) as state
                from order_events
                group by order_id
            )
            select state, count(*)
            from final_states
            group by state
            order by count desc
        """
        )
        print("\nFinal state distribution:")
        for state, count in cur.fetchall():
            print(f"  {state}: {count}")

        # avg time in awaiting_shipment by month
        cur.execute(
            """
            with state_times as (
                select
                    order_id,
                    order_events_fsm(event) over w as state,
                    occured_at as entered_at,
                    lead(occured_at) over w as exited_at
                from order_events
                window w as (partition by order_id order by id)
            )
            select
                extract(month from entered_at)::int as month,
                round(avg(extract(epoch from (exited_at - entered_at)) / 3600)::numeric, 1) as avg_hours
            from state_times
            where state = 'awaiting_shipment' and exited_at is not null
            group by month
            order by month
        """
        )
        print("\nAvg hours in awaiting_shipment by month:")
        for month, avg_hours in cur.fetchall():
            marker = " <-- anomaly" if month in anomaly_months else ""
            print(f"  Month {month:2d}: {avg_hours:6.1f}h{marker}")


def main():
    load_dotenv()

    parser = argparse.ArgumentParser()
    parser.add_argument("-n", "--num-orders", type=int, default=2000)
    parser.add_argument(
        "--anomaly-months",
        type=int,
        nargs="+",
        default=DEFAULT_ANOMALY_MONTHS,
        help="months with shipping delays (1-12)",
    )
    parser.add_argument("--year", type=int, default=2025)
    args = parser.parse_args()

    pg_url = os.getenv("PG_DATABASE_URL")
    if not pg_url:
        raise ValueError("PG_DATABASE_URL env variable is not set")

    anomaly_months = set(args.anomaly_months)
    year_start = datetime(args.year, 1, 1)
    orders = generate_orders(args.num_orders, year_start, anomaly_months)

    with psycopg2.connect(pg_url) as conn:
        seed_database(conn, orders)
        print(f"Seeded {args.num_orders} orders (year: {args.year})")
        print(f"Anomaly months: {sorted(anomaly_months)}")
        print_stats(conn, anomaly_months)


if __name__ == "__main__":
    main()
