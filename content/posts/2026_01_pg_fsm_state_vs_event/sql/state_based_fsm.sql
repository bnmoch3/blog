begin
;

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

create table invoices(
    id serial primary key,
    state invoice_state not null default 'draft'::invoice_state,
    amount numeric(12,2) default 0,
    created_at timestamptz not null default now()
);


-- VALIDATE INVOICE INITIAL STATE
-- all invoices start as draft
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


-- VALIDATE INVOICE NEXT STATE TRANSITION
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

-- -- for test, in prod set int to bigserial or bigint generated as ...
-- insert into invoices(id) select id from generate_series(1,5) i(id);
-- AUDIT INVOICE STATE TRANSITIONS
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

select *
from invoices
;

insert into invoices (amount) values (100.00);  -- starts in 'draft'

update invoices set state = 'sent' where id = 1;
update invoices set state = 'paid' where id = 1;

-- this fails:
update invoices set state = 'draft' where id = 1;

-- -- 1
-- update invoices set state='sent' where id = 1;
-- update invoices set state='paid' where id = 1;
-- -- 2
-- update invoices set state='sent' where id = 2;
-- update invoices set state='overdue' where id = 2;
-- update invoices set state='paid' where id = 2;
-- -- 3
-- update invoices set state='sent' where id = 3;
-- update invoices set state='cancelled' where id = 3;
-- -- 4
-- update invoices set state='sent' where id = 4;
-- update invoices set state='paid' where id = 4;
-- update invoices set state='refunded' where id = 4;
-- -- 5
-- update invoices set state='sent' where id = 5;
-- update invoices set state='overdue' where id = 5;
-- update invoices set state='cancelled' where id = 5;
select *
from invoice_state_history
order by invoice_id asc, id asc
;

create function invoice_next_state(_state invoice_state, _event invoice_event)
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

select
    s as state,
    e as event,
    invoice_next_state(s::invoice_state, e::invoice_event) as next_state
from
    (
        values
            ('draft', 'send'),
            ('draft', 'cancel'),
            ('sent', 'pay'),
            ('sent', 'cancel'),
            ('sent', 'mark_overdue'),
            ('paid', 'refund'),
            ('overdue', 'pay'),
            ('overdue', 'cancel')
    ) as v(s, e)
;


rollback
;
