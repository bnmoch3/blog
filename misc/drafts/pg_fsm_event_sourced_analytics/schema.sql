begin
;

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
create table order_events(
    id bigint generated always as identity primary key,
    order_id int not null references orders(id),
    event order_event not null,
    occured_at timestamptz default now() not null
);
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
create aggregate order_events_fsm(order_event) (
  sfunc = order_events_transition,
  stype = order_state,
  initcond = 'start'
);
-- trigger
create function order_events_trigger_func()
returns trigger
language plpgsql
as $$
declare
  next_state order_state;
begin
  select order_events_fsm(event order by id)
  from (
    select id, event from order_events where order_id = NEW.order_id
    union all
    select NEW.id, NEW.event
  ) s
  into next_state;
  if next_state = 'error'::order_state then
    raise exception 'invalid order(%) event(%)', NEW.order_id, NEW.event;
  end if;
  return new;
end
$$
;
create trigger trg_order_events before insert on order_events
for each row execute procedure order_events_trigger_func();

commit
;
