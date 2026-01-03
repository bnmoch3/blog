+++
title = "DB-Enforced State Machines in PostgreSQL: State-Based vs Event Sourced"
title = "Enforcing State Machines in PostgreSQL"
date = "2025-01-03"
summary = "FSMs: Storing State vs Storing Events. Also invalid State Transitions shouldn't reach your DB"
tags = ["PostgreSQL"]
type = "post"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "postgresql-state-machine-approaches"
+++

Let's consider the following problem, we want to track and manage the lifecycle
of invoices in our business:

- Invoices start as drafts
- They're then sent
- Recipients pay them
- If not, the invoices are marked as overdue
- Invoices can be cancelled as long as they haven't been paid yet
- Once paid, invoices can also be refunded

This problem can be modeled as a state-machine:

TODO insert graphviz image here

Better yet, the states an invoice goes through and transitions can be stored and
enforced within the DB (specifically PostgreSQL), otherwise we'll have to rely
on application code to never make mistakes and keep everything consistent.

There are two main approaches for database-enforced FSMs:

1. **State-based**: Store the current state on the entity, validate transitions
   via triggers
2. **Event-sourced**: Store events in an append-only log, derive state by
   folding over the events

Before proceeding, I'd like to credit the following sources:

For state-based, I first encountered this approach in this extension
[pg_fsm](https://github.com/michelp/pgfsm) by Michel Pelletier. I made the
following improvements/additions to pg_fsm:

- Added an audit trail to track state transitions
- Used enums instead of text for type safety and minimizing storage
- In pg_fsm, the primary key `from_state` only allows on outgoing transition per
  state, so for example, a draft invoice can only transition to `sent`, it
  cannot be cancelled. The fix is to use both current state and event as the
  primary key
- I added a separate initial state validation, pg_fsm only validates transitions
  not initial stages

As for event-sourced, I based my approach on Raphael Medaer's
[Versioned FSM (Finite-State Machine) with Postgresql](https://raphael.medaer.me/2019/06/12/pgfsm.html)
who in turn based his approach on Felix Geisendörfer's
[Implementing State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/).
For the sake of clarity/blogging I chucked out the versioning stuff in Raphael's
approach but in 'real-life' business processes change so consider incorporating
versioning of FSMs.

Okay, let's proceed

## The FSM Definition

Both approaches share the same foundation: an enum for states, an enum for
events, and a transition table that defines valid paths.

```sql
create type invoice_state as enum(
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
  ('draft',     'send',         'sent'),
  ('draft',     'cancel',       'cancelled'),
  ('sent',      'pay',          'paid'),
  ('sent',      'mark_overdue', 'overdue'),
  ('sent',      'cancel',       'cancelled'),
  ('overdue',   'pay',          'paid'),
  ('overdue',   'cancel',       'cancelled'),
  ('paid',      'refund',       'refunded');
```

The primary key `(state, event)` enforces determinism: one event from a given
state leads to exactly one next state. If your FSM requires multiple possible
outcomes from the same `(state, event)` pair, you'd use
`(state, event, next_state)` instead, but that's almost always not a good idea
(malformed FSM design).

On to the implementations:

## State-Based Approach

The entity table stores the current state directly. Triggers validate
transitions on update.

```sql
create table invoices(
    id bigint generated always as identity primary key,
    state invoice_state not null default 'draft',
    amount numeric(12,2) not null default 0,
    created_at timestamptz not null default now()
);
```

### Enforcing Initial State

All invoices must start as `draft`. To enforce this, we use a before insert
trigger on the `invoices` table:

```sql
create or replace function invoice_validate_initial_state()
returns trigger
language plpgsql
as $$
begin
    if NEW.state <> 'draft' then
        raise exception 'invalid initial state: %', NEW.state;
    end if;
    return NEW;
end;
$$
;

create trigger trg_on_invoice_insert
before insert on invoices
for each row
execute function invoice_validate_initial_state();
```

### Enforcing Transitions

Whenever the state of an invoice is changed, the change/transition must be
validated. For this, we use a before update trigger on the `invoices` table:

```sql
create function invoice_validate_next_state()
returns trigger
language plpgsql
as $$
begin
    if OLD.state = NEW.state then return NEW; end if;
    perform 1 from invoice_transitions it
    where it.state = OLD.state and it.next_state = NEW.state;

    if not found then
        raise exception 'Invalid transition from % to %', OLD.state, NEW.state;
    end if;
    return NEW;
end;
$$
;

create trigger trg_on_invoice_update
before update on invoices
for each row
execute function invoice_validate_next_state();
```

### Audit Trail

Any time the state of an invoice changes, we log the state change/transition for
auditing purposes. For this we use an `after update` trigger on the `invoices`
table:

```sql
create table invoice_state_history(
    id bigserial primary key,
    invoice_id int not null references invoices(id),
    prev_state invoice_state not null,
    curr_state invoice_state not null,
    occured_at timestamptz not null default now()
);

create function invoice_audit_transitions()
returns trigger
language plpgsql
as $$
begin
    if OLD.state = NEW.state then return NEW; end if;
    insert into invoice_state_history(invoice_id, prev_state, curr_state)
        values (NEW.id, OLD.state, NEW.state);
    return NEW;
end;
$$
;

create trigger trg_after_invoices_update
after update on invoices
for each row
when (OLD.state is distinct from NEW.state)
execute function invoice_audit_transitions();
```

### Usage

State changes/transitions happen via direct state assignments:

```sql
insert into invoices (amount) values (100.00);  -- starts in 'draft'

update invoices set state = 'sent' where id = 1;
update invoices set state = 'paid' where id = 1;

-- this fails:
update invoices set state = 'draft' where id = 1;
-- ERROR:  P0001: Invalid transition from paid to draft
-- CONTEXT:  PL/pgSQL function invoice_validate_next_state() line 8 at RAISE
-- LOCATION:  exec_stmt_raise, pl_exec.c:3911
```

One thing to note: we're not tracking which event caused the transition. The
history table records `prev_state -> curr_state` but not the event that caused
the transition. In this FSM each `(prev_state, curr_state)` pair is unique so
the event is derivable.

If your FSM has multiple events leading between the same two states, you'd need
to track the event explicitly. For example, we might we might have different
events such as `auto_cancel`, `admin_cancel`, `compliance_blocked` leading from
state `draft` to state `cancelled`.

## Event-Sourced Approach

In this approach, instead of storing current state at the entity(invoice), we
store into append-only log of events. State is derived by replaying the events
through a transition function.

The invoice table is simpler, no state column:

```sql
create table invoices(
    id int primary key,
    amount numeric(12,2) default 0,
    created_at timestamptz not null default now()
);
```

We need a `start` state to represent invoices with no events yet:

```sql
-- add 'start' to the enum
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
```

Events are stored in their own table:

```sql
create table invoice_events(
    id bigint generated always as identity primary key,
    invoice_id int not null references invoices(id),
    event invoice_event not null,
    occured_at timestamptz default now() not null
);
```

### The Transition Function

A pure function that takes `(current_state, event)` and returns the next state:

```sql
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
```

To test it out:

```sql
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
```

Invalid transitions return `error` rather than raising an exception. This lets
us use the function in aggregates.

### The Aggregate

Here's the key insight: PostgreSQL aggregates can fold over a sequence of
events, threading state through each transition:

```sql
create aggregate invoice_fsm(invoice_event) (
  sfunc = invoice_transition,
  stype = invoice_state,
  initcond = 'start'
);
```

Usage:

```sql
select invoice_id, invoice_fsm(event order by id) as current_state
from invoice_events
group by invoice_id
;
```

This replays all events per each invoice in order, returning their current
state:

```
 invoice_id │ current_state
════════════╪═══════════════
          1 │ paid
          2 │ paid
          3 │ cancelled
          4 │ refunded
          5 │ cancelled
```

### Enforcing Valid Transitions

A `before insert` trigger validates that the new event produces a valid state:

```sql
create function invoice_events_trigger_func()
returns trigger
language plpgsql
as $$
declare
  next_state invoice_state;
begin
  select invoice_fsm(event order by id asc)
  from (
    select id, event from invoice_events where invoice_id = NEW.invoice_id
    union all
    select NEW.id, NEW.event
  ) s
  into next_state;

  if next_state = 'error'::invoice_state then
    raise exception 'invalid invoice event';
  end if;

  return new;
end
$$
;


create trigger trg_before_insert_invoice_events before insert on invoice_events
for each row execute procedure invoice_events_trigger_func();
```

This trigger replays all existing events for the given invoice plus the new one.
If the result is `error`, the insert is rejected.

### Usage

Now, instead of directly updating the invoice, we "record" events that happen to
the invoice:

```sql
-- test inserts
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
```

### Querying Current State

The state of a given invoice is always derived:

```sql
select invoice_fsm(event order by id) as state
from invoice_events
where invoice_id = 1; -- paid
```

The history is just the events table itself. To see state at each point:

```sql
select id, event, invoice_fsm(event) over (order by id) as state_after, occured_at
from invoice_events
where invoice_id = 1
```

Which gives:

```
 id │ event  │ state_after │          occured_at
════╪════════╪═════════════╪═══════════════════════════════
  1 │ create │ draft       │ 2026-01-03 10:39:28.641375+00
  2 │ send   │ sent        │ 2026-01-03 10:39:28.641375+00
  3 │ pay    │ paid        │ 2026-01-03 10:39:28.641375+00
```

Ignore the occured_at timestamps, I probably should have seeded more realistic
timestamps.

## Comparison + Recommendations

Here's a quick comparison of the differences between the two approaches:

| Aspect                | State-Based                 | Event-Sourced              |
| --------------------- | --------------------------- | -------------------------- |
| Current state query   | `O(1)` - direct column read | `O(n)` - replay all events |
| History               | Derived from audit table    | Events _are_ the history   |
| Transition validation | Check `(old, new)` pair     | Replay all events          |

Which to use? **State-based** is easier to retrofit into an existing DB schema
since often people just modify attributes in-place. Should be sufficient if you
just need to prevent invalid transitions and maintain an audit log.

However **Event-sourced** is probably the best approach if you're starting from
scratch or willing to make big changes to your schema - the audit log should be
source of truth, not a side effect.

Still, the event-sourced approach has a performance cost in cases where FSMs can
be really really large (our invoice one isn't that large): every time we insert
an event, the full event history of that invoice has to be replayed. Here's how
we can mitigate it:

## Hybrid Approach (Denormalization)

To reduce the performance cost of inserts in the event-sourced approach, we can
store the resultant state alongside the event. I'm not a big fan of this since
we're denormalizing which brings with it all the problems that denormalizing
tends to bring. There's no need to store state if we can always derive it.

Anyway, there's two ways to keep track of the current invoice state: we can do
so either in the entity(`invoices` table) or in `invoice_events`. The former
brings back some form of the state-based approach. Let's look at the latter:

We'll start by adding a `state` column in `invoice_events`:

```sql
create table invoice_events(
    id bigint generated always as identity primary key,
    invoice_id int not null references invoices(id),
    event invoice_event not null,
    state invoice_state not null, -- denormalized: stores the resultant state after this event occured
    occured_at timestamptz default now() not null
);
```

We'll also need to add an index to make lookups of the latest state somewhat
`O(1)`:

```sql
create index idx_invoice_events_invoice_id_id_desc
    on invoice_events(invoice_id, id desc);
```

The biggest change will be in the `before insert` trigger that's on the
`invoice_events` table:

```sql
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
    limit 1;

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
```

Also, something I noticed way later when re-reading this: we probably have to
add some row-locking just in case the application doesn't wrap up recording
invoice events in transactions (with the correct isolation level). Therefore, in
`invoice_events_trigger_func`, we'll have:

```sql
select state into current_state
from invoice_events
where invoice_id = NEW.invoice_id
order by id desc
limit 1
for update; -- lock row
```

Without row locking or proper transaction wrapping, two concurrent transactions
could:

1. Both read the same current state
2. Both calculate their next states independently
3. Both insert their events, potentially creating an invalid state sequence

So for further reading if you're interested in DB-enforced FSMs:

- [Implementing State Machines in PostgreSQL - Felix Geisendörfer](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) -
  great starting point
- [Versioned FSM (Finite-State Machine) with Postgresql - Raphael Medaer](https://raphael.medaer.me/2019/06/12/pgfsm.html)
- [Use your database to power state machines - Lawrence Jones](https://blog.lawrencejones.dev/state-machines/)
- [pgfsm](https://github.com/michelp/pgfsm)
