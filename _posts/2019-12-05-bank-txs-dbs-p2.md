---
title: "Handling Bank Transactions, V2"
slug: "sql-bank-txs-v2"
category: "PostgreSQL"
excerpt_separator: <!--start-->
layout: post
---

Version 2 of a simplified Node.js-based API + PG database layer for handling a
bank's intra-account transfer operations

<!--start-->

### DB DESIGN

The following is an overview of the database layer for an API that facilates a
subset of the business operations of a made-up bank. Right now, the bank's
services are limited: users make a one-time deposit of 1000 into an account when
they open it and users can transfer money but only to other users within the
same bank. Additionally, users can check their balance, last 5 transactions and
full transactions history.

The three main tables underlying the database are: **users**, **account** and
**transfer_log**. There is a one-to-many relationship from **users** to
**account**, that is, users can have zero, one or more accounts with the bank.
There is also a one-to-many relationship from **account** to **transfer_log**
entries: each transfer log entry is associated with a sender's account and the
receiver's account.

### users table

The users table is pretty standard and self-explanatory. I kind of prefer using
the singular 'user' over 'users' but in postgres, 'user' is a reserved keyword.

```sql
create domain contact_entry_t as
    varchar(50) not null check (value <> '' and value !~ '\s');

create table users(
    user_id serial primary key,
    email contact_entry_t unique,
    firstname contact_entry_t,
    lastname contact_entry_t,
    password varchar(50) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_login timestamptz not null default now()
);
```

### account table

The 'account' table is also quite basic and is as follows:

```sql
create table account(
    account_id serial primary key,
    user_id int not null,
    balance numeric(12,2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    is_active boolean not null default 't',

    foreign key (user_id) references users(user_id)
        on delete restrict on update restrict,

    constraint balance_nonnegative check(
        balance >= 0
    )
);
```

One of the business rules of the bank is that account balances should not go
below 0 and this is enforced via the constraint _balance_nonnegative_. An
additional business rule is that there are no 'dangling' accounts, each account
must be linked to a _user_. Therefore, the _user_id_ is constrained to non-null
values. Furthermore, the foreign-key constraint ensures that a users entry
cannot be deleted as long as an account has been registered under its name and
accounts can not be transfered from one user to another. Additionally, accounts
themselves cannot be deleted, they can only be deactivated. This is enforced
with the following trigger:

```plsql
create or replace function trig_soft_account_delete_fn()
    returns trigger
    language 'plpgsql'
as $$
    begin
        update account
            set is_active= 'f' where account_id = old.account_id;
        raise notice 'hard delete aborted: not allowed for account entries';
        return null;
    end;
$$;

create trigger trig_soft_account_delete
    before delete on account for each row
    execute procedure trig_soft_account_delete_fn();
```

Lastly, deactivated accounts cannot send any money but they can receive money.
This is implemented and enforced in the _confirm_transfer_ function that's
detailed later on.

### transfer_log table

The transfer_log table stores all the transfers. Each transfer consists of an
id, the sender's account, the receiver's account, the amount and the status of
the transfer plus the time it was created and time it was updated.

The transfer id's are uuids. Since they only have to be random,
_uuid_generate_v4()_ is used instead of _uuid_generate_v1()_. But first, the
_uuid_ extension is enabled:

```sql
create extension if not exists "uuid-ossp";
```

The type used to store the transfer state are enums, which is created as
follows:

```sql
create type transfer_status_t as enum
    ('pending', 'cancelled', 'timeout', 'error', 'confirmed');
```

Now for the table definition. Not that the _from_account_ can have a null value.
This is so as to accomodate the initial 'deposit' of 1000 whenever an account is
created. However, it is definitely an anti-pattern and a future redesign should
be able to accomodate deposits and withdrawal entries without having to resort
to null values.

```sql
create table transfer_log(
    transfer_log_id uuid primary key default uuid_generate_v4(),
    from_account int references account,
    to_account int references account not null,
    amount numeric(12,2) check(amount > 0),
    transfer_status transfer_status_t not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint transfer_self_send check(
        from_account <> to_account
    )
);
```

When inserted, transfer's must begin from a _pending_ state. Under this state,
modifications on the receipient and amount are allowed. However, the sender
cannot be changed. When a transfer is either confirmed, cancelled, errored out
or timed out, its respective state is changed. This state change is one-way and
once it occurs, further modifications on the row are disabled. In order to
accomdate deposits, an additional condition whereby the _from_account_ is null
is included. Lastly, transfer_log entries cannot be deleted. All these rules are
enforced with the following trigger and procedure:

```plsql
create function trig_validate_transfer_log_fn()
    returns trigger 
    language 'plpgsql'
as $$
begin
    if tg_op = 'INSERT' and new.transfer_status = 'pending' then 
        return new;
    end if; 
    if tg_op = 'UPDATE' 
        and old.transfer_status = 'pending' 
        and old.from_account = new.from_account then
        new.updated_at = now();
        return new; 
    end if;
    if tg_op = 'UPDATE' 
        and old.transfer_status = 'pending' 
        and old.from_account is null and new.from_account is null then
        return new; 
    end if; 
    raise exception 'invalid operation on transfer_log entry';
    return null;
end;
$$;

create trigger trig_validate_transfer_log
    before insert or update or delete on transfer_log for each row
    execute procedure trig_validate_transfer_log_fn();
```

It was mentioned that on creation, a 1000 is deposited to each account. This is
really for test-purposes since we need each account to at least have some money
for transfers here and there. This is achieved via the following post-trigger.
On second thought though, it should have just been a direct procedure which the
application can invoke:

```plsql
create or replace function trig_account_creation_bonus_fn()
    returns trigger 
    language 'plpgsql'
as $$
    declare
        bonus_amount constant int := 1000;
        bonus_transfer_id uuid;
    begin 
        with bonus as (
            insert into transfer_log(to_account, amount) values (new.account_id, bonus_amount)
            returning transfer_log_id
        )
        select transfer_log_id into bonus_transfer_id from bonus;

        update transfer_log set transfer_status = 'confirmed'
            where transfer_log_id = bonus_transfer_id;

        update account set balance = balance + bonus_amount
            where account_id = new.account_id;
        return new;
    end;
$$;

create trigger trig_account_creation_bonus
    after insert on account for each row 
    execute procedure trig_account_creation_bonus_fn();
```

### handling transfers

Finally, the heart of the application, handling actual transfers. Transfers
consist of two stages: the request/pending stage and the
finalization/confirmation stage.

#### transfer request

The _request_transfer_ is quite simple: given the sender's account id, the
receiver's account id and the amount to transfer, it inserts the pending entry
into _transfer_log_ and returns the transfer id generated on insertion. This
transfer id can then be used to either confirm or cancel the transfer.

```plsql
create function request_transfer(from_acc int, to_acc int, amount numeric)
    returns uuid
    language 'plpgsql'
as $$
declare 
    transfer_id uuid;
begin
    with tf as (
        insert into transfer_log(from_account, to_account, amount) 
        values (from_acc, to_acc, amount)
        returning transfer_log_id
    )
    select transfer_log_id into transfer_id from tf;
    return transfer_id;
end;
$$;
```

A lot of the work to ensure the transfer request entry is valid is handled by
the contraints and additional pre-triggers placed on the _transfer_log_ table.
For example,

- the foreign key constraint ensures that the _to_acc_ must exist

- the nonnegative constraint on _amount_ ensures that the sender cannot send
  negative money which is basically stealing money from the receiver

- The _transfer_log_ trigger detailed earlier ensures that a transfer request
  must begin from a _pending_ state and the _from_account_ cannot be changed
  once inserted since it it were otherwise, an enterprising user can modify the
  _from_ field after insertion and before confirmation so as to swindle from
  someone else's account.

One glaring aspect that's missing is a security check to ensure that the
transfer request comes from a verified sender account and the _from_account_ id
matches. I'm reading up as much as I can on row-level security and authorization
so that it is incorporated in future. For now, it is expected that the
application will handle such authorization.

#### transfer cancellation

An account user is given the chance to cancel a transfer if they don't intend
for it to go through. This is achieved via the following _cancel_transfer_
function:

```plsql
create function cancel_transfer(transfer_id uuid)
    returns boolean 
    language 'plpgsql'
as $$
declare 
    tf_row record;
begin
    update transfer_log 
        set transfer_status = 'cancelled'
        where transfer_log_id = transfer_id and transfer_status = 'pending';
    select * into tf_row from transfer_log where transfer_log_id = transfer_id;
    if tf_row.transfer_status = 'cancelled' then 
        return 't';
    else
        return 'f';
    end if;
end;
$$;
```

The function is a bit extraneous since the update query is quite simple, it can
be invoked directly from the application. I guess I got carried away with trying
to use stored procedures as much as possible. My original intention was to have
the cancel requests be idempotent. In a way, this is already achieved by the
_transfer_log_ trigger which ensures that once a transfer entry's state is
changed to 'cancelled' (or any other non-pending state), further modifications
(such as the update in this case) are disabled.

#### transfer confirmation

Finally, an account's user can confirm a pending transfer using the
_confirm_transfer_ function - all they have to provide is the transfer_id. This
function is quite involved compared to previous ones:

```plsql
--CONFIRM TRANSFER
create function confirm_transfer(transfer_id uuid)
    returns boolean
    language 'plpgsql'
as $$
declare
    sender_acct_id int;
    tf_row transfer_log%ROWTYPE;
begin
    --update sender account, deduct balance
    select * into tf_row from transfer_log where transfer_log_id = transfer_id;
    if tf_row.transfer_status = 'confirmed' then 
        return 't';
    end if;
    if tf_row.transfer_status <> 'pending' then 
        return 'f';
    end if;
    with sender as(
        update account 
            set balance = balance - tf_row.amount, updated_at = now() 
            where account_id = tf_row.from_account 
                and is_active = 't' 
                and balance >= tf_row.amount 
            returning account_id
    )select account_id into sender_acct_id from sender;
    --if from_acc has insufficient balance or acct deactivated then error
    if not found then 
        update transfer_log 
            set transfer_status = 'error'
            where transfer_log_id = transfer_id and transfer_status = 'pending';
        return 'f';
    end if;
    --update receiever account
    update account 
        set balance = balance + tf_row.amount, updated_at = now() 
        where account_id = tf_row.to_account;
    --update transfer_status in transfer_log
    update transfer_log 
        set transfer_status = 'confirmed'
        where transfer_log_id = transfer_id;
    --timeout other previous transfer requests
    update transfer_log 
        set transfer_status = 'timeout'
        where transfer_status = 'pending' and from_account = sender_acct_id;
    return 't';
end;
$$;
```

The first part of _confirm_transfer_ checks whether the confirmation has already
been made or if the caller is attempting to confirm a non-pending transfer:

```plsql
select * into tf_row from transfer_log where transfer_log_id = transfer_id;
if tf_row.transfer_status = 'confirmed' then 
    return 't';
end if;
if tf_row.transfer_status <> 'pending' then 
    return 'f';
end if;
```

Past the checks, a deduction is made from the sender's account, with checks that
the sender's account should be active, and they should have enough money to
begin with before sending. Otherwise, the transfer status is set to _error_ and
the function returns immediately.

```plsql
with sender as(
    update account 
        set balance = balance - tf_row.amount, updated_at = now() 
        where account_id = tf_row.from_account 
            and is_active = 't' 
            and balance >= tf_row.amount 
        returning account_id
)select account_id into sender_acct_id from sender;
--if from_acc has insufficient balance or acct deactivated then error
if not found then 
    update transfer_log 
        set transfer_status = 'error'
        where transfer_log_id = transfer_id and transfer_status = 'pending';
    return 'f';
end if;
-- ...
```

Next the amount is added to the receiver's account. Inactive accounts can still
receive money unless a change to the requirement is made. Since the receiver's
account id is retrieved from the transfer entry, we know that it already exists
(via the foreign key constraint), hence there's no need to perform such a check
again.

```plsql
update account 
    set balance = balance + tf_row.amount, updated_at = now() 
    where account_id = tf_row.to_account;
```

The transfer entry state is then changed to 'confirmed'.

```plsql
update transfer_log 
    set transfer_status = 'confirmed'
    where transfer_log_id = transfer_id;
```

Finally, other pending requests are timed out. This is so as to constrain
account holders to only carrying out a transfer(both stages), one at a time and
in combination with UI and the application, prevent them from mistakenly
repeating the same transfer several times.

```plsql
update transfer_log 
    set transfer_status = 'timeout'
    where transfer_status = 'pending' and from_account = sender_acct_id;
```

It goes without saying that the entire procedure should be atomic. In the
_transfer concurrency issues_ section, a discussion on the correct isolation
level for the transaction block is provided.

It is worth noting that the _confirm_transfer_ has the same security issue as
the _request_transfer_ and even _cancel_transfer_, that is, they all have no
means of enforcing that only the authorized sender can initiate a transfer,
cancel it or confirm it. Part of mitigating this is delegated to the
application. The other part is the sender's responsibility. The UUID is
guaranteed to be unique. Therefore, as long as the application ensures it is
delivered securely, the only way a third party could know its exact value is if
the sender revealed it to them. This is also why uuids are used instead of
serial keys, since with serial keys, attackers can just post the transfer id
back and confirm/cancel transfers that don't belong to them by easily generating
keys. Hashing the uuid before sending and caching it until it's processed at the
application does not add any security benefits plus it adds the burden of making
the application stateful.

#### transfer concurrency issues

As is, I don't think there is any concurrency error that can occur if
_request_transfer_ is invoked without placing it in a transaction block - it's a
simple insertion. However, both the _cancel_transfer_ and _confirm_transfer_
have to be invoked within a transaction block. Moreover, given that locks aren't
used (they are harder to get right and reason with), it's expected that both
functions are invoked under a _serializable_ isolation level. This not only
ensures correctness under concurrency, it also provides a simple reasoning model
whereby, we only have to think about whether they are doing the right thing when
run serially (ie one by one rather than concurrently). The only downside is that
the application must be ready to retry when serialization errors occurs.

From the application (using node.js), in order to carry out the transfer within
a transaction, I use the following helper or rather, wrapper:

```javascript
const makeSerializableTx = async (doSQL) => {
  let serializationErrOccured = false;
  do {
    const client = await db.getClient();
    try {
      await client.query("begin isolation level serializable");
      const res = await doSQL(client);
      await client.query("commit");
      return res;
    } catch (err) {
      await client.query("rollback");
      serializationErrOccured = err.code === "40001";
      if (serializationErrOccured === false) {
        throw err;
      }
    } finally {
      client.release();
    }
  } while (serializationErrOccured);
};
```

From there, the _confirmTransfer_ procedure is as follows. _makeSerializableTx_
handles retrying the transfer if a serialization error occurs:

```javascript
const confirmTransfer = (transferID) =>
  makeSerializableTx(async (tx) => {
    const res = await tx.query("select confirm_transfer($1)", [transferID]);
    return { confirmed: res.rows[0].confirm_transfer };
  });
```

The rest of the code for the full API is in
[this](https://github.com/nagamocha3000/bank_transactions_v2) repository. It's
almost complete but I've paused adding further features since on load-testing,
Postgres was reporting dead-lock errors and I'm trying to figure out what's
causing them and how I can fix it. I welcome any and all suggestions. Regards.
