begin
;

create type invoice_state as enum(
    'start',
    'draft',
    'sent',
    'paid',
    'refunded',
    'overdue',
    'cancelled',
    'error'
);

create type invoice_event as enum(
    'create',
    'send',
    'pay',
    'refund',
    'cancel',
    'mark_overdue'
);


create table invoice_transitions(
    state invoice_state not null,
    event invoice_event not null,
    next_state invoice_state not null,
    primary key(state, event)
);

insert into invoice_transitions(state, event, next_state)
values
  ('start',     'create',         'draft'),
  ('draft',     'send',         'sent'),
  ('draft',     'cancel',       'cancelled'),
  ('sent',      'pay',          'paid'),
  ('sent',      'mark_overdue', 'overdue'),
  ('sent',      'cancel',       'cancelled'),
  ('overdue',   'pay',          'paid'),
  ('overdue',   'cancel',       'cancelled'),
  ('paid',      'refund',       'refunded');

create table invoices(
    id int primary key,
    amount numeric(12,2) default 0,
    created_at timestamptz not null default now()
);

-- for test, in prod set int to bigserial or bigint generated as ...
insert into invoices(id) select id from generate_series(1,5) i(id);

create table invoice_events(
    id bigint generated always as identity primary key,
    invoice_id int not null references invoices(id),
    event invoice_event not null,
    state invoice_state not null, -- denormalized: stores the resultant state after this event occured
    occured_at timestamptz default now() not null
);

-- index to make lookups of the latest state O(1)
create index idx_invoice_events_invoice_id_id_desc
    on invoice_events(invoice_id, id desc);


create function invoice_transition(_state invoice_state, _event invoice_event)
returns invoice_state
language sql
stable
parallel safe
as $$
select coalesce(
  (select next_state from invoice_transitions
        where state=_state and event=_event),
  'error'::invoice_state
);
$$
;

create aggregate invoice_fsm(invoice_event) (
  sfunc = invoice_transition,
  stype = invoice_state,
  initcond = 'start'
);

-- test out the invoice_transition function
select
    state,
    event,
    invoice_transition(state::invoice_state, event::invoice_event) as next_state
from
    (
        values
            ('start', 'create'),
            ('draft', 'send'),
            ('sent', 'mark_overdue'),
            ('overdue', 'pay'),
            ('paid', 'refund')
    ) as examples(state, event)
;

-- ensure validity
-- trigger
create function invoice_events_trigger_func()
returns trigger
language plpgsql
as $$
declare
  current_state invoice_state;
  next_state invoice_state;
begin
  -- get current state
  select state into current_state
  from invoice_events
  where invoice_id = NEW.invoice_id
  order by id desc
  limit 1
  for update; -- lock row



  -- if no prev event exists for this invoice then we're in start state
  if current_state is null then
    current_state := 'start'::invoice_state;
  end if;

  -- calculate the next state based on curr state and new event
  next_state := invoice_transition(current_state, NEW.event);

  -- validate the transition
  if next_state = 'error'::invoice_state then
    raise exception 'invalid invoice event';
  end if;

  -- automatically set the state s.t. users only need to provide the event
  NEW.state := next_state;
  return new;
end
$$
;


create trigger trg_before_insert_invoice_events before insert on invoice_events
for each row execute procedure invoice_events_trigger_func();

insert into invoice_events(invoice_id, event) values
    (1, 'create'),
    (1, 'send'),
    (1, 'pay'),

    (2, 'create'),
    (2, 'send'),
    (2, 'mark_overdue'),
    (2, 'pay'),

    (3, 'create'),
    (3, 'send'),
    (3, 'cancel'),

    (4, 'create'),
    (4, 'send'),
    (4, 'pay'),
    (4, 'refund'),

    (5, 'create'),
    (5, 'send'),
    (5, 'mark_overdue'),
    (5, 'cancel');


select id, event, invoice_fsm(event) over (order by id) as state_after, occured_at
from invoice_events
where invoice_id = 1
;

select *
from invoice_events
;
rollback
;
