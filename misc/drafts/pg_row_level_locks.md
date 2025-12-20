# Postgres Row-Level Locking Overview

## Intro

Problem: you want to read a tuple in Postgres then later on modify it depending
on application logic i.e. the _read-modify-write_ pattern.

For example, suppose we've got the following database:

```sql
create table users(
    id int primary key,
    name varchar not null
);

create table accounts(
    id int primary key,
    user_id int not null references users(id),
    balance decimal(10,2) not null default 0.00
        check (balance >= 0),
    account_type varchar(20) not null
        check (account_type in ('checking', 'savings')),
    status varchar(20) not null default 'active'
        check (status in ('active', 'frozen', 'closed'))
);

insert into users values (1, 'Alice'), (2, 'Bob');
insert into accounts(id, user_id, balance, account_type) values
    (1, 1, 10, 'checking'),
    (2, 1, 20, 'savings'),
    (3, 2, 50, 'checking');
```

And Alice wants to withdraw from her checking account:

```sql
begin;

select balance from accounts where id = 1 ;
-- application logic, business rules etc
update accounts set balance = balance - 10 where id = 1;

commit;
```

As part of code, the withdraw handler would be as follows:

```python
import os
from decimal import Decimal

import psycopg
from dotenv import load_dotenv

load_dotenv()


class AccountError(Exception):
    pass


class InsufficientFundsError(Exception):
    pass


def withdraw(account_id, amount):
    with psycopg.connect(os.getenv("PG_DATABASE_URL")) as conn:
        with conn.cursor() as cur:
            cur.execute("begin")

            cur.execute(
                """
                select id, balance, account_type, status
                from accounts where id = %s
                """,
                (account_id,),
            )

            row = cur.fetchone()

            if not row:
                raise AccountError(f"Account {account_id} not found")

            acc_id, balance, acc_type, status = row

            if status != "active":
                raise AccountError(f"Account {account_id} is inactive({status})")

            if balance < amount:
                raise InsufficientFundsError(
                    f"Insufficient funds for Account {account_id}: have {balance}, need {amount}"
                )

            cur.execute(
                """
                update accounts
                set balance = balance - %s
                where id = %s
                returning id, balance
            """,
                (amount, account_id),
            )

            updated_id, new_balance = cur.fetchone()

            conn.commit()

            return {
                "account_id": updated_id,
                "amount_withdrawn": amount,
                "new_balance": new_balance,
            }


def main():
    try:
        res = withdraw(account_id=1, amount=Decimal("50.00"))
        print(res)
    except AccountError as e:
        print(f"Account issue: {e}")
    except InsufficientFundsError as e:
        print(f"Transaction declined: {e}")


if __name__ == "__main__":
    main()
```

However, the code is wrong. Between the `select` statement where we check for
the balance and the `update` statement where we modify it, another concurrent
transaction can modify the same row. There are two ways to fix this. The first
is to use a higher isolation level such as repeatable read or serializable then
set up retries for tx aborts on conflicts:

```sql
begin isolation level serializable;

select balance from accounts where id = 1 ;
-- application logic, business rules etc
update accounts set balance = balance - 10 where id = 1;

commit ;
```

This works but requires handling serialization failures which makes the code a
bit more complex: when conflicts occur, at least one of the concurrent txs is
aborted and must retry.

The second approach is to use a row-level lock.

## Row Level Locks (for update, for share)

Whenever a row is modified or deleted, Postgres implicitly locks it to prevent
concurrent modifications. Postgres also allows for explicit locking in `select`
queries via the `for update` and `for share` clauses.

Let's start with `for update`; from the PG docs: "FOR UPDATE causes the rows
retrieved by the SELECT statement to be locked as though for update. This
prevents them from being locked, modified or deleted by other transactions until
the current transaction ends".

The lock prevents all other concurrent transactions from acquiring conflicting
locks on the same row (such as other `for update` locks, `for share` locks, or
attempting to update/delete the row). Regular `select` queries can still read
the row concurrently.

Therefore without resorting to a higher isolation level (i.e. sticking to the
default `read committed`), the withdraw code can be fixed by using `for update`:

```sql
begin;

select balance from accounts where id = 1 for update;
-- application logic, business rules etc
update accounts set balance = balance - 10 where id = 1;

commit ;
```

As for `for share`: we can use it for acquiring a shared lock rather than
exclusive lock. It blocks all concurrent modifications (i.e. `update` and
`delete` statements trying to access the given row) plus all exclusive lock
attempts (`select ... for update`). However `for share` allows other concurrent
`select ... for share` queries and regular `select` queries to access the row
concurrently.

## More Row Level Locks (for no key update, for key share)

There are two additional row level locks that PG provides, mostly to deal with
scenarios involving foreign keys. These are:

- `for no key update`
- `for key share`

`for no key update` is a slightly lighter/more lax/weaker version of
`for update`:

- it's primarily for locking a row for update to non-key columns but still
  allowing other transactions to create foreign key references to key columns of
  the row.
- what counts as "key columns":
  - primary key columns
  - columns with unique constraints (even if not currently referenced)
  - columns referenced by foreign keys from other tables
- let's consider the `users` table and `accounts` table: each accounts row has a
  `user_id` that references the `id` in users. A user can have zero, one or more
  accounts but each account is associated with one-and-only-one user
- suppose for user Alice, we want to update her name to add a surname, so we use
  a `for update` lock.
- on a separate concurrent transaction, we want to create a new account for
  Alice. Her user ID does not change.

```
-- TRANSACTION 1                       |
                                       |
begin;                                 |
                                       |
select * from users where id=1         |
for update;                            |
                                       |
                                       | -- TRANSACTION 2
                                       | begin;
                                       |
                                       | insert into accounts
                                       | (id,user_id,balance,account_type, status)
                                       | values (4,1,50,'checking', 'active');
                                       | -- ❌ blocked by tx 1
                                       |
update users                           |
set name='Alice Burgers'               |
where id=1;                            |
                                       |
commit;                                |
                                       |
                                       | -- ✅tx 2 can now proceed
```

Let's continue:

- Ideally, both transactions should be able to proceed concurrently. However,
  with a `for update` lock, the second transaction is blocked
- Hence the `for no key update` lock - this is precisely where we need it: if we
  used it instead when locking Alice's row, then it wouldn't have blocked the tx
  on the `accounts` table that's inserting a new account:

```
-- ✅both can proceed concurrently
-- TRANSACTION 1                       | TRANSACTION 2
begin;                                 | begin;
                                       |
select * from users where id=1         | insert into accounts
for no key update;                     | (id,user_id,balance,account_type,status)
                                       | values (4,1,50,'checking', 'active');
```

So, to summarize on `for no key update`

- use it for updating **non-key columns** ie columns that are not primary keys,
  nor have a unique constraint nor are referenced by foreign keys in other
  tables
- allows other concurrent transactions to acquire `for key share` locks on the
  row
- however, it blocks concurrent `for update`, `for no key update` and
  `for share`

Btw `insert` on accounts needs a lock on the users table due to _referential
integrity_. When inserting an account for user Alice who has ID 1, Postgres
needs to guarantee that a user with `id=1` exists and that they won't be deleted
during this transaction (though they can be deleted after). Postgres also needs
to guarantee that on insert, the user's ID won't change from 1 (though it can be
changed later on). On change or delete, as part of our DB design, we can decide
how such modifications should affect `accounts`. By default, Postgres restricts
changes and deletes on key columns referenced in other tables, though we can
decide to cascade it or set the user ID to null depending on what we need for
our application.

I've mentioned that `insert` into accounts acquires some sort of lock in users
due to the foreign key. The exact lock it acquires is `for key share`.
`for key share` is a slightly lighter/more lax/weaker version of `for share`:

- it prevents a row from being deleted or having any of its **key columns**
  (primary key or unique constraint columns) from being modified
- allows concurrent `for share`, `for key share` and `for no key update`
- also allows concurrent `update` as long as it's modifying non-key columns
- however, blocks concurrent `select ... for update`
- also blocks concurrent `delete`
- also blocks `update` that's modifying key columns

## Summary

When to use each:

- **for update**: default choice when modifying any column
- **for no key update**: for when you're updating non-key columns only
  (performance optimization)
- **for share**: when you need to ensure data consistency across your read
- **for key share**: rarely used explicitly, PG handles this for foreign keys

Also from the Postgres docs, here's the lock compatibility table. For two locks
to be compatible per a given row it means different transactions can hold them
concurrently/simultaneously. An ❌ means the locks conflict, if one tx holds the
row lock, another tx requesting the conflicting lock must wait until the first
tx releases its lock.

|                   | for update | for no key update | for share | for key share |
| ----------------- | ---------- | ----------------- | --------- | ------------- |
| for update        | ❌         | ❌                | ❌        | ❌            |
| for no key update | ❌         | ❌                | ❌        | ✅            |
| for share         | ❌         | ✅                | ✅        | ✅            |
| for key share     | ❌         | ✅                | ✅        | ✅            |

## References

1. Explicit Locking - Postgres Docs:
   [link](https://www.postgresql.org/docs/current/explicit-locking.html)
2. Row locks in PostgreSQL - Laurenz Albe - Cybertec:
   [link](https://www.cybertec-postgresql.com/en/row-locks-in-postgresql/)
3. SELECT FOR UPDATE considered harmful in PostgreSQL - Laurenz Albe - Cybertec:
   [link](https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/)
