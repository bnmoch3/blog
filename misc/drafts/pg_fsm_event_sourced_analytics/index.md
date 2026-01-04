+++
title = "Postgres Event Sourcing, FSMs & Temporal Analytics"
date = "2025-01-03"
summary = "Turns out storing state transitions makes temporal analytics much easier"
tags = ["PostgreSQL" ]
type = "post"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "postgres-event-sourced-fsm-analytics"
+++

In a previous post I covered two approaches for enforcing state machines in
PostgreSQL: state-based and event-sourced. The event-sourced approach has a cost
which is that deriving current state requires replaying events. Still, it comes
with a significant upside: the ability to answer temporal & point-in-time
questions that are impossible with state-based approaches (that don't keep a
history log).

We'll use the order management sys from
[Raphael's blog](https://raphael.medaer.me/2019/06/12/pgfsm.html) but slightly
simplified to remove versioning of FSMs:

## Schema

As a refresher, this is the order flow: `start` -> `awaiting_payment` ->
`awaiting_shipment` -> `shipped`. There's also branches for cancellation and
refunds.

TODO insert FSM diagram here

The schema starts as follows:

```sql
create type order_state as enum (
  'start',
  'awaiting_payment',
  'awaiting_shipment',
  'awaiting_refund',
  'shipped',
  'canceled',
  'error'
);

create type order_event as enum (
  'create',
  'pay',
  'ship',
  'refund',
  'cancel'
);

create table orders(
    id bigserial primary key,
    created_at timestamptz not null default now()
);

create table order_events(
    id bigint generated always as identity primary key,
    order_id int not null references orders(id),
    event order_event not null,
    occured_at timestamptz default now() not null
);
```

For the FSM, we've got:

```sql
create table order_transitions(
    state order_state not null,
    event order_event not null,
    next_state order_state not null,
    primary key(state, event)
);

insert into order_transitions values
  ('start',             'create', 'awaiting_payment'  ),
  ('awaiting_payment',  'pay',    'awaiting_shipment' ),
  ('awaiting_payment',  'cancel', 'canceled'          ),
  ('awaiting_shipment', 'cancel', 'awaiting_refund'   ),
  ('awaiting_shipment', 'ship',   'shipped'           ),
  ('awaiting_refund',   'refund', 'canceled'          );
```

We use this function to get the next state, given an event + current state:

```sql
create function order_events_transition(_state order_state, _event order_event)
returns order_state
language sql
stable
parallel safe
as $$
select coalesce(
  (select next_state from order_transitions
        where state=_state and event=_event),
  'error'::order_state
);
$$
;
```

Then there's the aggregate that folds over past events (ordered by `id`, newer
events for a given order have a higher id than older events) which we use to
derive the current state

```sql
create aggregate order_events_fsm(order_event) (
  sfunc = order_events_transition,
  stype = order_state,
  initcond = 'start'
);
```

Example usage:

```sql
select order_events_fsm(event order by id) as state
from order_events
where order_id = 42
;
```

Now let's see what analytics we unlock with an event-sourced approach:

## Point-in-Time Queries

Suppose we want to see what state each order was in as of June 15th 2025:

```sql
select
    order_id,
    order_events_fsm(event order by id) as state
from order_events
where occured_at <= '2025-06-15'
group by order_id;
```

We get:

```
┌──────────┬───────────────────┐
│ order_id │       state       │
│  int64   │      varchar      │
├──────────┼───────────────────┤
│        1 │ shipped           │
│        2 │ canceled          │
│        3 │ shipped           │
│        · │    ·              │
│        · │    ·              │
│        · │    ·              │
│     1001 │ awaiting_payment  │
│     1002 │ awaiting_payment  │
├──────────┴───────────────────┤
│ 1002 rows          2 columns │
│ (5 shown)                    │
└──────────────────────────────┘
```

What about this: for all orders initiated in June, what state were they in at
the end of June? Here's how we get the answer:

```sql
select order_id, order_events_fsm(event order by id) as state
from order_events
where
    occured_at < '2025-07-01'  -- end of June
    and order_id in ( -- all orders created in June
        select order_id
        from order_events
        where
            event = 'create'
            and occured_at >= '2025-06-01'
            and occured_at < '2025-07-01'
    )
group by order_id
;
```

Let's get aggregates:

```sql
with
    june_orders as (
        select order_id, order_events_fsm(event order by id) as state
        from order_events
        where
            occured_at < '2025-07-01'  -- end of June
            and order_id in (  -- all orders created in June
                select order_id
                from order_events
                where
                    event = 'create'
                    and occured_at >= '2025-06-01'
                    and occured_at < '2025-07-01'
            )
        group by order_id
    )
select state, count(*)
from june_orders
group by state
order by count(*) desc
;
```

Visualizing this as a bar chart:

TODO add order_states_june.{png,svg}

## Time-in-State Analysis

The FSM aggregate can also be used as a window function. Combined with `lead`,
we can calculate how long orders spend in each intermediate state. The query
calculates both the average and the 95th percentile (P95) durations for each
intermediate state:

```sql
with
    state_timeline as (
        select
            order_id,
            order_events_fsm(event) over w as state,
            occured_at as entered_at,
            lead(occured_at) over w as exited_at
        from order_events
        window w as (partition by order_id order by id)
    )
select
    state,
    round(
        avg(extract(epoch from (exited_at - entered_at)) / 3600)::numeric, 1
    ) as avg_hours,
    round(
        percentile_cont(0.95) within group (
            order by extract(epoch from (exited_at - entered_at)) / 3600
        )::numeric,
        1
    ) as p95_hours
from state_timeline
where exited_at is not null  -- only intermediate states
group by state
;
```

This gives us:

```
       state       │ avg_hours │ p95_hours
═══════════════════╪═══════════╪═══════════
 awaiting_payment  │      26.0 │      49.9
 awaiting_shipment │      47.3 │     179.4
 awaiting_refund   │      73.2 │     114.9
```

We can visualize it as follows:

TODO add order_state_durations.{svg,png} here

While on average orders spend 47 hours before shipment, the P95 (an SLA metric)
is nearly 180 hours! Probably worth investigating the source of variability,
there's a fulfillment botttleneck somewhere.

## Detecting Anomalies

Let's see how fulfillment speed changes over time by calculating the average
hours spent in `awaiting_shipment` each month:

```sql
with
    state_timeline as (
        select
            order_id,
            order_events_fsm(event) over w as state,
            occured_at as entered_at,
            lead(occured_at) over w as exited_at
        from order_events
        window w as (partition by order_id order by id)
    )
select
    date_trunc('month', entered_at)::date as month,
    round(
        avg(extract(epoch from (exited_at - entered_at)) / 3600)::numeric, 1
    ) as avg_hours
from state_timeline
where state = 'awaiting_shipment' and exited_at is not null
group by month
order by month
;
```

Here's the results:

```
   month    │ avg_hours
════════════╪═══════════
 2025-01-01 │      27.5
 2025-02-01 │      28.8
 2025-03-01 │      28.0
 2025-04-01 │      26.2
 2025-05-01 │      27.4
 2025-06-01 │     140.6
 2025-07-01 │     129.4
 2025-08-01 │      26.4
 2025-09-01 │      27.4
 2025-10-01 │      26.1
 2025-11-01 │      27.8
```

June & July, something definitely was up. Warehouse issue? Carrier problems?

TODO: insert shipment_time_trend.png/svg here

## Operational Metrics

Three metrics that might be useful for a logistics dashboard:

### Backlog Ratio

Of all orders ready to ship (either still waiting or already shipped), what
fraction is stuck waiting?

```sql
with
    month_end_states as (
        select
            date_trunc('month', d)::date as month,
            orders.order_id,
            order_events_fsm(event order by id) as state
        from generate_series('2025-01-31', '2025-12-31', '1 month'::interval) d
        cross join (select distinct order_id from order_events) orders
        join order_events e on e.order_id = orders.order_id and e.occured_at <= d
        group by month, orders.order_id
    )
select
    month,
    count(*) filter (where state = 'awaiting_shipment') as awaiting,
    count(*) filter (where state = 'shipped') as shipped,
    round(
        count(*) filter (where state = 'awaiting_shipment')::numeric
        / nullif(count(*) filter (where state in ('awaiting_shipment', 'shipped')), 0),
        3
    ) as backlog_ratio
from month_end_states
group by month
order by month
;
```

Visualizing the results:

TODO insert blacklog_trend.png here

- we're taking month-end snapshots of every order's state and filtering in those
  in the shipping pipeline
- we're visualizing both absolute volumes and percentage stuck over time to see
  whether the fulfillment botttleneck got worse over time or things improved
- Overall the backlog ratio drops, while shipping orders grew, great for us,
  strong finish by December
- We can see the June/July spike once more, maybe there was a seasonal surge or
  warehouse staffing shortage or inventory issue

### Throughput Ratio

Orders shipped today divided by orders entering awaiting_shipment today:

```sql
with
    order_states as materialized(
        select
            order_id,
            id,
            event,
            occured_at,
            order_events_fsm(event) over (partition by order_id order by id) as state
        from order_events
    ),
    state_transitions as materialized(
        select
            state,
            lag(state) over (partition by order_id order by id) as prev_state,
            occured_at::date as day
        from order_states
    )
select
    day,
    count(*) filter (
        where
            state = 'awaiting_shipment'
            and coalesce(prev_state, 'start') != 'awaiting_shipment'
    ) as entered,
    count(*) filter (
        where state = 'shipped' and prev_state = 'awaiting_shipment'
    ) as shipped,
    round(
        count(*) filter (
            where state = 'shipped' and prev_state = 'awaiting_shipment'
        )::numeric / nullif(
            count(*) filter (
                where
                    state = 'awaiting_shipment'
                    and coalesce(prev_state, 'start') != 'awaiting_shipment'
            ),
            0
        ),
        2
    ) as throughput_ratio
from state_transitions
group by day
order by day
;
```

We use materialized here because PG's query planner keeps trying to flatten the
CTEs and then gets confused about the grouping aggregate functions.
`materialized` forces Postgres to compute and store intermediate results before
proceeding thereby preventing the grouping error. The query gives us:

TODO add throughput_daily.png here

With daily throughput ratio, we want to see whether we're shipping orders faster
than new ones arrive (as in, are we keeping up?).

- `< 1.0`: backlog growing
- `= 1.0`: steady state
- `> 1.0`: we're clearing the backlog

### Aging Buckets

Suppose on June 30th, we wanted to ask the following question: of all orders
stuck awaiting shipment right now, how long have they been waiting?

To get this:

1. We identify orders that have been paid but haven't been shipped or canceled
   yet
2. From there, we calculate how long each order has been sitting idle
3. We then group them into age buckets to get the distribution

```sql
with
    current_awaiting as (
        select order_id, max(occured_at) as entered_at
        from order_events
        where
            event = 'pay'
            and occured_at <= '2025-06-30'::timestamp  -- as of end of June
            and order_id not in (
                select order_id
                from order_events
                where
                    event in ('ship', 'cancel')
                    and occured_at <= '2025-06-30'::timestamp  -- as of end of June
            )
        group by order_id
    )
select
    case
        when '2025-06-30'::timestamp - entered_at < interval '1 day'
        then '< 1 day'
        when '2025-06-30'::timestamp - entered_at < interval '3 days'
        then '1-3 days'
        when '2025-06-30'::timestamp - entered_at < interval '7 days'
        then '3-7 days'
        else '> 7 days'
    end as age_bucket,
    count(*) as orders
from current_awaiting
group by 1
order by
    case
        when
            case
                when '2025-06-30'::timestamp - entered_at < interval '1 day'
                then '< 1 day'
                when '2025-06-30'::timestamp - entered_at < interval '3 days'
                then '1-3 days'
                when '2025-06-30'::timestamp - entered_at < interval '7 days'
                then '3-7 days'
                else '> 7 days'
            end
            = '< 1 day'
        then 1
        when
            case
                when '2025-06-30'::timestamp - entered_at < interval '1 day'
                then '< 1 day'
                when '2025-06-30'::timestamp - entered_at < interval '3 days'
                then '1-3 days'
                when '2025-06-30'::timestamp - entered_at < interval '7 days'
                then '3-7 days'
                else '> 7 days'
            end
            = '1-3 days'
        then 2
        when
            case
                when '2025-06-30'::timestamp - entered_at < interval '1 day'
                then '< 1 day'
                when '2025-06-30'::timestamp - entered_at < interval '3 days'
                then '1-3 days'
                when '2025-06-30'::timestamp - entered_at < interval '7 days'
                then '3-7 days'
                else '> 7 days'
            end
            = '3-7 days'
        then 3
        else 4
    end
;
```

It's a bit verbose and I should probably figure out a way to simplify it. It
gives us:

```
 age_bucket │ orders
════════════╪════════
 < 1 day    │      3
 1-3 days   │     10
 3-7 days   │     11
 > 7 days   │      5
```

we've got 5 orders > 7 days. Getting the distribution is insightful because the
total count (29 orders) includes both fresh orders and stale orders.

## Funnel Analysis

We can also calculate the order conversion funnel i.e. what percentage of orders
make it through each stage from creation to shipment:

```sql
with
    final_states as (
        select order_events_fsm(event order by id) as state
        from order_events
        group by order_id
    ),
    total as (select count(*) as n from final_states)
select 'created' as stage, count(*), round(100.0 * count(*) / n, 1) as pct
from final_states, total
group by n
union all
select
    'paid',
    count(*) filter (where state not in ('awaiting_payment', 'canceled')),
    round(
        100.0
        * count(*) filter (where state not in ('awaiting_payment', 'canceled'))
        / n,
        1
    )
from final_states, total
group by n
union all
select
    'shipped',
    count(*) filter (where state = 'shipped'),
    round(100.0 * count(*) filter (where state = 'shipped') / n, 1)
from final_states, total
group by n
;
```

This gives us:

```
  stage  │ count │  pct
═════════╪═══════╪═══════
 created │  2000 │ 100.0
 paid    │  1542 │  77.1
 shipped │  1542 │  77.1
```

We're losing 22.9% of orders in between creation and payment. Between payment
and shipping, we aren't losing any. So we've got a payment abandoment problem
and not a fulfillment problem.

## Conclusion

That's all for now. There's always more queries we can ask especially if we were
to flesh out the database a bit more.
