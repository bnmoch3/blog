+++
title = "Fine-grained Authorization with Row Level Security in PostgreSQL"
date = "2024-12-24"
summary = "Tutorial on RLS"
tags = ["PostgreSQL"]
type = "post"
toc = true
readTime = true
autonumber = true
showTags = true
featured = true
slug = "postgres-row-level-security"
+++

## Intro

Row-Level Security (RLS) is a PostgreSQL mechanism that lets us implement
authorization policies and pre-conditions over which rows in a table a user can
insert/read/modify/delete. It is meant to complement other authorization and
security measures such as the roles & privileges system rather than replace them
entirely.

In this post, I'll be going over how RLS works, various caveats and how you can
go about implementing it.

## Demo Database

For the sake of demonstration I'll be using the database from the
[pgexercises](https://pgexercises.com/gettingstarted.html) SQL tutorial site.
It's "for a newly created country club, with a set of members, facilities such
as tennis courts, and booking history for those facilities". The database
consists of 3 tables:

The `members` table:

```sql
create table members (
    memid integer primary key,
    surname varchar(200) not null,
    firstname varchar(200) not null,
    address varchar(300) not null,
    zipcode integer not null,
    telephone varchar(20) not null,
    recommendedby integer references members(memid) on delete set null,
    joindate timestamp without time zone not null
);
```

The `facilities` table which holds all the amenities the club has to offer:

```sql
create table facilities (
    facid integer primary key,
    name varchar(100) not null,
    membercost numeric not null,
    guestcost numeric not null,
    initialoutlay numeric not null,
    monthlymaintenance numeric not null
);
```

And the `bookings` table:

```sql
create table bookings (
    bookid integer primary key,
    facid integer not null references facilities(facid),
    memid integer not null references members(memid),
    starttime timestamp without time zone not null,
    slots integer not null
);
```

## Authorization Strategy

There will be two kinds of people that will access the database: the admin and
club members. The admin will have no restrictions. As for the members, we want
to limit what each can do. Let's go over the restrictions table by table

For the members table:

- A member can only read their own membership details OR membership details for
  the members they directly recommended to join the club
- A member can only modify their own membership details, they are not allowed to
  touch any other members' details
- The only fields a member can modify are the `address`, `zipcode` and
  `telephone` fields - the rest have to handled by admin
- A member cannot insert new members nor delete any current member including
  themselves, this will be handled by the admin

For the facilities table:

- A member can read all the facilities available
- A member cannot insert/modify/delete any facility

For the bookings table:

- A member can only read their own bookings. They should not be able to read
  bookings made by other members.
- A member can insert/modify/delete a new booking as long as that booking has
  their membership ID and it's set in the future.
- When modifying a booking, the only fields a member is allowed to change are
  the `facid` (facility), `starttime` and `slots`.

RLS by itself cannot be used to implement all these restrictions, we will start
with Postgres' roles/privileges system then bring in RLS:

## Roles & Privileges

There is an admin superuser already setup. The admin role created and owns the
database. Each member will have separate user roles that they can use to login
in and access the database. The admin will create each member's roles as part of
onboarding.

Rather than grant privileges one-by-one to each member, we'll create a _group_
role, `member_access`, which will _hold_ all the privileges - permissions given
to members. From there, whenever a member role is added to `member_access`, it
will inherit all the requisite privileges.

Here is `member_access`:

```sql
create role member_access; -- no login
```

We'll need to give `member_access` permission to access all the objects held
within the database's main schema, `cd`. Usually, this is not a permission we
think much of when creating roles since if we're using the `public` schema
(which is the default schema) then it is already configured to grant usage and
modification permission to all roles. However, given that we're using a
non-default schema, we'll have to grant `usage` to the `member_access` role,
otherwise members will not be able to view any of the tables:

```sql
grant usage on schema cd to member_access;
```

A member can view all the facilities available, but they cannot modify any:

```sql
grant select on cd.facilities to member_access;
```

A member can view or update membership details (in the `cd.members` table) but
can't add new members or make any deletions. The updates a member can make are
limited to the `address`, `zipcode` and `telephone` columns.

```sql
grant select on cd.members to member_access;
grant update (address,zipcode,telephone) on cd.members to member_access;
```

Above, we can see where the roles & privileges system works best and where RLS
works best and how both can complement each other: while we can use the roles &
privileges system to limit which columns can be modified, we can't use it to
prevent one member from modifying another member's details - in order to
implement the latter, we'll have to use row-level security. Let's proceed to the
last table, `bookings`:

A member can select, update, delete or insert a booking (again, we'll tighten
what exactly a member can do with RLS):

```
grant select, insert, update(facid,starttime, slots), delete
  on cd.bookings to member_access;
```

Now let's create an actual member and add them to the `member_access` group.
Note, each member name will have the format `member_` + member ID.

```
create role member_2 with login password 'super_secret_password';
grant member_access to member_2;
alter role member_2 set search_path to cd;
```

## RLS on the Members Table

We'll start with the `members` table then the `bookings` table. For the
`facilities` table, we've already achieved all the authorization goals by
granting members only the ability to select from the table and nothing else - so
we won't be enabling RLS on that table.

On the `members` table, RLS is enabled as follows:

```sql
alter table members enable row level security;
```

In a separate session, we can log in as `member_2`. The first observation is
that `member_2` can't _see_ any row from `members` after RLS is enabled:

```
member_2@club=> select * from members;
 memid │ surname │ firstname │ address │ zipcode │ telephone │ recommendedby │ joindate
═══════╪═════════╪═══════════╪═════════╪═════════╪═══════════╪═══════════════╪══════════
(0 rows)
```

After enabling RLS on a table, we have to specify a policy. The policy is
evaluated for each row we're selecting (or modifying) and if the policy returns
true, upstream operators can access the row, otherwise if false is returned, the
row is filtered out. Without any policy present, Postgres opts for a
`default-deny` policy which means that false is returned for every row.

Let's add a policy:

First, a member should be able to read their own membership details:

```sql
create policy member_self_read_policy
    on cd.members
    for select
    using ('member_'|| memid = current_user);
```

`current_user` is a Postgres function that returns the currently logged-in DB
user
([PostgreSQL CURRENT_USER](https://neon.tech/postgresql/postgresql-administration/postgresql-current_user)).

If we run it as `member_2` we get:

```
member_2@club=> select current_user;
 current_user
══════════════
 member_2
```

With the above policy in place, member 2 can now read their own details

```
member_2@club=> select memid, firstname, surname from members;
 memid │ firstname │ surname
═══════╪═══════════╪═════════
     2 │ Tracy     │ Smith
(1 row)
```

Additionally, we want members to be able to read the details of other members
whom they recommended to join the club. Luckily, Postgres let's us apply more
than one policy to a table:

```sql
create policy member_recs_read_policy
    on cd.members
    for select
    using ('member_'|| recommendedby = current_user);
```

Now member 2 can see also read details of all the members she recommended:

```
member_2@club=> select memid, firstname, surname, recommendedby from members;
 memid │ firstname │      surname      │ recommendedby
═══════╪═══════════╪═══════════════════╪═══════════════
    29 │ Henry     │ Worthington-Smyth │             2
    30 │ Millicent │ Purview           │             2
    36 │ Erica     │ Crumpet           │             2
     2 │ Tracy     │ Smith             │             ¤
(4 rows)
```

### Permissive & Restrictive Policies

Postgres has two ways of combining policies whenever they apply to the same
query:

- as `permissive`
- as `restrictive`

With permissive, policies are combined using logical `or`, that is if a row is
not cleared using policy 1, we check policy 2 and so on until it's cleared by at
least one policy. Otherwise it is filtered out. On the other hand, with
restrictive, policies are combined using logical `and`, that is a row must be
cleared by all the restrictive policies present on the table - if it fails at
least one restrictive policy, then it's filtered out. Policies default to
permissive unless specified otherwise, which is what we've got with the two
policies above

Alternatively, we could have rewritten the two policies as a single policy:

```sql
create policy member_read_policy
    on cd.members for select using
    (('member_'|| memid = current_user) or ('member_'|| recommendedby = current_user))
```

Lest we forget, let's also add the policy on updates: a member should only be
allowed to update their own details and no one elses:

```sql
create policy member_update_policy
    on cd.members for update
    using ('member_'|| memid = current_user)
```

This now works:

```
member_2@club=> update members set telephone='445-445-4445' where memid=2;
UPDATE 1
```

We can even leave out the `where` clause since RLS will ensure the update only
applies to the member's own row:

```
member_2@club=> update members set telephone='333-333-3332';
UPDATE 1
member_2@club=> select memid, telephone from members where memid = 2;
 memid │  telephone
═══════╪══════════════
     2 │ 333-333-3332
(1 row)
```

## RLS on the Bookings Table

Now, for the `bookings` table:

```sql
alter table cd.bookings enable row level security
```

The first policy we'll create on `bookings` is that all the rows a member
selects/updates/deletes/inserts have to have that member's ID:

```sql
create policy bookings_gen_policy on cd.bookings
    as permissive for all
    using ('member_'|| memid = current_user)
```

Since it's a permissive policy, it lets us add restrictive policies down the
line (those require us to have at least one permissive policy setup on the
table). In fact, let's go right ahead and add one. We don't want members to
'change' the past, only the future. That is, a member can only
modify/delete/insert a booking if the start time of that booking is >= `now()`.
Usually I'd implement this using both constraints and triggers but let's see how
to do it with RLS:

```sql
create policy bookings_del_policy on cd.bookings
    as restrictive for delete
    using (starttime > now());

create policy bookings_upd_policy on cd.bookings
    as restrictive for update
    with check (starttime > now());

create policy bookings_ins_policy on cd.bookings
    as restrictive for insert
    with check (starttime > now());
```

### With Check Clause for Inserts & Updates

The policies above ensure that a member cannot 'change' the past. It's worth
noting the usage of `with check` in `bookings_ins_policy` and
`bookings_upd_policy`.

From the docs, the check expression:

> will be used in INSERT and UPDATE queries against the table if row-level
> security is enabled. Only rows for which the expression evaluates to true will
> be allowed. An error will be thrown if the expression evaluates to false or
> null for any of the records inserted or any of the records that result from
> the update. Note that the check_expression is evaluated against the proposed
> new contents of the row, not the original contents.

On the other hand, with using:

> This expression will be added to queries that refer to the table if row-level
> security is enabled. Rows for which the expression returns true will be
> visible. Any rows for which the expression returns false or null will not be
> visible to the user (in a SELECT), and will not be available for modification
> (in an UPDATE or DELETE). Such rows are silently suppressed; no error is
> reported.

Also, all the new policies are restrictive. This means for example when we
insert a row as `member_2`, the expression
`('member_'|| memid = current_user) AND (starttime > now())` will be ran against
the new row and if the expression returns true, that row will be allowed,
otherwise we'll get an error. If `bookings_ins_policy` was permissive, the
expression would instead be:
`('member_'|| memid = current_user) OR (starttime > now())`. This means a member
could create a booking in the "past" OR they could even insert a booking on
behalf of another member since only one of the disjuncts has to evaluate to True
for the entire expression to be True. By the way, whenever we don't specify a
`with check` expression, the `using` expression is used in place of the
`check expression`. So the `bookings_gen_policy` is effectively as follows:

```sql
create policy bookings_gen_policy on cd.bookings
    as permissive for all
    using ('member_'|| memid = current_user)
    with check ('member_'|| memid = current_user)
```

Additionally, instead of having 4 different policies on `bookings`, we could
simplify them down to 2:

```sql
create policy bookings_gen_policy on cd.bookings
    as permissive for all
    using ('member_'|| memid = current_user)
    with check (('member_'|| memid = current_user) and (starttime > now()));

create policy bookings_del_policy on cd.bookings
    as restrictive for delete
    using (starttime > now());
```

## RLS with Session/Local Variables

Now, unless all the members of our club are DB experts and are comfortable
accessing their information directly from Postgres, we'll need some way of
mapping web/app sessions to DB member IDs for RLS authorization.

One way is to still keep the roles for each member and right before running a
query on behalf of a member, we switch to their role, execute the query, then
switch back to a base role. For example, suppose member 20 wants to book the
Squash Court tomorrow:

```sql
set role member_20;

insert into bookings(facid, memid, starttime, slots)
values (6, 20, now() + '1 day'::interval, 4) returning bookid;

reset role;
```

Alternatively, we could use session variables and avoid having to create a role
for each member. We'll still keep the `member_access` role and give it `login`
privileges:

```sql
alter role member_access with login password '123456';
```

The backend app that connects to Postgres will use `member_access` exclusively
when handling members' interactions with the club's system.

Let's review PG variables a bit before applying them to RLS.

Postgres let's us read and write variables:

```sql
set app.foo = 'bar';
```

To retrieve the value, we use `current_setting`:

```sql
select current_setting('app.foo')

-- bar
```

The `current_setting` function gives us a clue that PG's variable system is
primarily meant for runtime configuration rather than general querying, we're
just being creative with our usage.

If no value is set for a given variable name, we get an error:

```
admin@club=# select current_setting('app.quz');
ERROR:  42704: unrecognized configuration parameter "app.quz"
LOCATION:  find_option, guc.c:1278
```

`current_setting` has an optional parameter `missing_ok` which if set to `true`,
the error is suppressed and `null` is returned instead:

```
admin@club=# select current_setting('app.quz', true);
 current_setting
═════════════════
 ¤
(1 row)

admin@club=# select current_setting('app.quz', true) is null;
 ?column?
══════════
 t
(1 row)
```

Variables can also be scoped to transactions via the `local` keyword. This is
great since it prevents leaking - the variable is cleared after the transaction
and the next query can't access/modify data they weren't supposed to:

```sql
begin;
set local app.member_name = 'Alice';
select current_setting('app.member_name', true);
commit;

select current_setting('app.member_name', true) is null;
-- t
```

### Refactoring, Internal IDs & External IDs

Before switching over to local variables, let's make a key change in the schema.
Since member IDs are auto-incrementing primary keys, it's considered best
practice to avoid exposing them in external APIs. Therefore, we'll use UUIDs as
the external member IDs i.e. the ones the rest of the world can 'see':

```sql
create extension if not exists "uuid-ossp";

alter table cd.members
add column ext_memid uuid not null default uuid_generate_v4();
```

Next, we'll rewrite our policies to use the external IDs rather than the roles.
Let's start with `member_read_policy`

```sql
drop policy member_read_policy on cd.members;

create policy member_read_policy on cd.members for select
    using (
        (ext_memid = (current_setting('auth.mem_xid', true))::uuid)
        or
        (select m2.ext_memid = current_setting('auth.mem_xid', true)::uuid
        from members m2 where m2.memid = recommendedby)
    );
```

### RLS, Infinite Recursion & Security Definer Functions

Though we can create the above policy without any error, if we attempt to run a
select query, we'll get the following error:

```
psql:admin.sql:14: ERROR:  42P17: infinite recursion detected in policy for relation "members"
LOCATION:  fireRIRrules, rewriteHandler.c:2247
```

We've got two basic solution we can apply:

- denormalization
- use a security definer function that sidesteps the RLS check

With denormalization, we would have to add a `recommendedby_xid` column:

```sql
begin;

alter table cd.members
add column recommendedby_xid uuid;

update cd.members
set recommendedby_xid = (
    select ext_memid
    from cd.members mr
    where  mr.memid = cd.members.recommendedby
);

commit;
```

And then the policy doesn't have to invoke a subquery:

```sql
create policy member_read_policy on cd.members for select
    using (
        (ext_memid = (current_setting('auth.mem_xid', true))::uuid)
        or
        (recommendedby_xid = (current_setting('auth.mem_xid', true))::uuid)
    );
```

However, let's proceed with the second solution: using a security definer
function. These are functions that execute with the privileges of the owner
(`admin`) rather than the invoker (`member_access`). Since `admin` can bypass
RLS, we won't end up with infinite recursion policy checks. The function is as
follows:

```sql
create or replace function cd.get_recommender_ext_memid(recommendedby_id integer)
returns uuid
language sql
security definer
as $$
    select ext_memid
    from cd.members
    where memid = recommendedby_id
$$;

alter function cd.get_recommender_ext_memid(integer) owner to admin;
grant execute on function cd.get_recommender_ext_memid(integer) to member_access;
```

We can now use it in the policy definition:

```sql
create policy member_read_policy
on cd.members for select
using (
    (ext_memid = (current_setting('auth.mem_xid', true))::uuid)
    or
    (cd.get_recommender_ext_memid(recommendedby) = (current_setting('auth.mem_xid', true))::uuid)
);
```

### Bringing It All Together: RLS, External IDs and Local Variables

Let's also update the `member_update_policy`:

```sql
create policy member_update_policy
    on cd.members for update
    using (ext_memid = (current_setting('auth.mem_xid', true))::uuid);
```

For some example usage:

```sql
set role member_access;
set local auth.mem_xid = '807ea0dc-1361-4536-8837-cc7a0275c14c'; -- member 2

update cd.members
set telephone = '222-222-2222'
where memid = 2;

select memid, recommendedby, telephone from members;
```

We're not quite done yet, we've also got to handle the policies on the
`bookings` table. `bookings_del_policy` will remain as is:

```sql
create policy bookings_del_policy on cd.bookings
    as restrictive for delete
    using (starttime > now());
```

As for `bookings_gen_policy`, we'll have to update it.

```sql
drop policy bookings_gen_policy on cd.bookings;
```

For the `bookings` table, we could use a subquery to retrieve the associated
`ext_memid`:

```sql
create policy bookings_gen_policy on cd.bookings
    as permissive for all
    using (
        (
            select ext_memid from cd.members m
            where m.memid = cd.bookings.memid
        ) = (current_setting('auth.mem_xid', true))::uuid
    )
    with check (
        (
            select ext_memid from cd.members m
            where m.memid = cd.bookings.memid
        ) = (current_setting('auth.mem_xid', true))::uuid
        and (starttime > now())
    );
```

Or we could opt for denormalization:

```sql
begin;

alter table cd.bookings add column ext_memid UUID;

update cd.bookings
set ext_memid = (
    select ext_memid
    from cd.members
    where cd.members.memid = cd.bookings.memid
);

alter table cd.bookings alter column ext_memid set not null;
commit;
```

Then define the policy as follows:

```sql
create policy bookings_gen_policy on cd.bookings
    as permissive for all
    using ( ext_memid = (current_setting('auth.mem_xid', true))::uuid)
    with check (
        ext_memid = (current_setting('auth.mem_xid', true))::uuid
        and (starttime > now())
    );
```

I'm tempted to go for the denormalization approach but I'll use the former for
now.

All in all, we end up with the following RLS policies:

```sql
create policy member_read_policy
    on cd.members for select
    using (
        (ext_memid = (current_setting('auth.mem_xid', true))::uuid)
        or
        (cd.get_recommender_ext_memid(recommendedby) = (current_setting('auth.mem_xid', true))::uuid)
    );

create policy member_update_policy
    on cd.members for update
    using (ext_memid = (current_setting('auth.mem_xid', true))::uuid);

create policy bookings_gen_policy on cd.bookings
    as permissive for all
    using (
        (
            select ext_memid from cd.members m
            where m.memid = cd.bookings.memid
        ) = (current_setting('auth.mem_xid', true))::uuid
    )
    with check (
        (
            select ext_memid from cd.members m
            where m.memid = cd.bookings.memid
        ) = (current_setting('auth.mem_xid', true))::uuid
        and (starttime > now())
    );

create policy bookings_del_policy on cd.bookings
    as restrictive for delete
    using (starttime > now());
```

## RLS & JWT

We now have external IDs that we can expose to the outside world and all our
policies use these IDs for authorization via local variables.

As an example, suppose we're using JWTs and member 2 has been authenticated and
provided with a token that encodes the following payload:

```
{
  "sub": "807ea0dc-1361-4536-8837-cc7a0275c14c",
  "exp": 1735554932
}
```

The `sub` field holds member 2's external ID.

With every operation member 2 invokes, they have to send the following token:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MDdlYTBkYy0xMzYxLTQ1MzYtODgzNy1jYzdhMDI3NWMxNGMiLCJleHAiOjE3MzU1NTQ5MzJ9.utPHo-Jh4tWnv_2iv7qZYfNJIZ90H5HNGirsIhvTl9o
```

Suppose member 2 wants to retrieve all the bookings she has ever made. Here's
how we'd implement the handler in python:

```python
import os
import psycopg2
import jwt

secret_key = os.getenv("JWT_SECRET_KEY")
pg_url = os.getenv("PG_URL")

conn = psycopg2.connect(pg_url)


def get_bookings(conn, token):
    decoded = jwt.decode(token, secret_key, algorithms=["HS256"])
    member_uuid = decoded["sub"]
    bookings = None
    with conn:  # tx context
        with conn.cursor() as cur:
            cur.execute("set local auth.mem_xid=%s", (member_uuid,))
            cur.execute(
                """
                select memid, bookid, f.name, starttime
                from cd.bookings b
                join cd.facilities f using(facid)
                order by starttime desc
            """
            )
            bookings = cur.fetchall()
    return bookings
```

If we push the jwt decoding and validation step into Postgres and switch from
using symmetric keys to asymmetric keys via JSON Web Key Sets (JWKS) then we end
up with something quite close to what Neon provides via
[Neon Authorize](https://neon.tech/docs/guides/neon-authorize).

## View Permissions, Security Invoker Views and RLS

Suppose we want to create a view that holds a facilities plus the amount of
money a member spent booking those facilities:

Suppose we want to create a view that holds each member's sum of payments made
for bookings. We'll do so as admin:

```sql
create view member_costs as
select
    memid,
    sum(f.membercost * b.slots) as cost
from cd.bookings b
join cd.facilities f using (facid)
group by memid
```

We'll also have to grant select to `member_access`:

```sql
grant select on member_costs to member_access;
```

Let's select from this view as member 2:

```sql
set session auth.mem_xid = '807ea0dc-1361-4536-8837-cc7a0275c14c'; -- member 2
select * from member_costs;
```

We get:

```
 memid │  cost
═══════╪═════════
    29 │      70
     4 │  1490.0
     0 │ 30486.0
...
     8 │  3644.0
(30 rows)
```

Not ideal, we're leaking all the other members' costs.

What's happening here is that views have owners (in our case `admin`) and when
`member_access` reads from that view, Postgres uses the owner to check what
permissions the view should be evaluated with. `admin` can bypass RLS therefore
`member_access` uses the view to effectively bypass RLS.

Fear not, Postgres provides `security_invoker` views that ensure the permissions
used to evaluate the views are those of the role accessing the view rather than
the owner. Let's configure it as admin:

```sql
alter view member_costs set (security_invoker = on);
```

Now, if we run the previous query, we only get the authorized member's costs:

```
member_access@club=> select * from member_costs;
 memid │ cost
═══════╪═══════
     2 │ 957.0
(1 row)
```

We can also configure `security_invoker` during the view definition:

```sql
create view member_costs
with (security_invoker=true) as
  select memid, sum(f.membercost * b.slots) as cost
  from cd.bookings b
  join cd.facilities f using (facid)
  group by memid;

grant select on member_costs to member_access;
```

For more details on security invoker views, check out:

- [Postgres Docs: Views and the Rule System](https://www.postgresql.org/docs/current/rules-views.html)
- [Cybertec: View permissions and row-level security in PostgreSQL - Laurenz Albe](https://www.cybertec-postgresql.com/en/view-permissions-and-row-level-security-in-postgresql/)

## Optimizing Row Level Security

Let's finish off with one key implementation detail - performance. Granted, our
dataset is currently small and we might cost along without bothering too much
with how long queries take to execute, but it's still worth considering.

There are two general approaches we can use when optimizing RLS:

- Call functions with select so that the result is cached for the entire query
  rather than getting evaluated for each row
- Index columns used for evaluating RLS

Suppose we revisit our authorization policy for the `members` table and want to
limit members solely to their own details and cut off access to those of members
they recommended:

```sql
-- check to see cd is the first schema in our search_path
show search_path;

-- drop previous policy
drop policy member_read_policy on members;

-- drop function to retrieve member uuid since we don't need it any more as the
-- policy it was being used for is deleted
drop function get_recommender_ext_memid;

-- add new policy
create policy member_read_policy
    on members for select
    using (ext_memid = (current_setting('auth.mem_xid', true))::uuid);
```

Some test data won't hurt, we'll delete it later:

```sql
insert into members (memid, surname, firstname, address, zipcode, telephone, joindate)
with max_id as (
    select coalesce(max(memid), 0) as max_id from members
)
select
    max_id + gs.memid,
    'surname_' || gs.memid as surname,
    'firstname_' || gs.memid as firstname,
    'address_' || gs.memid as address,
    10000 + gs.memid as zipcode,
    '777' || gs.memid::text as telephone,
    now() as joindate
from
    max_id, generate_series(1, 250000) as gs(memid);
```

Let's run the following query as `member_access`:

```sql
set session auth.mem_xid = '807ea0dc-1361-4536-8837-cc7a0275c14c'; -- member 2
explain (analyze, buffers)
  select memid, firstname, surname from members;
```

This query has the following plan:

```
                                                      QUERY PLAN
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 Gather  (cost=1000.00..11077.69 rows=1 width=34) (actual time=0.239..53.892 rows=1 loops=1)
   Workers Planned: 2
   Workers Launched: 2
   Buffers: shared hit=7994
   ->  Parallel Seq Scan on members  (cost=0.00..10077.59 rows=1 width=34) (actual time=31.565..48.504 rows=0 loops=3)
         Filter: (ext_memid = (current_setting('auth.mem_xid'::text, true))::uuid)
         Rows Removed by Filter: 83343
         Buffers: shared hit=7994
 Planning Time: 0.085 ms
 Execution Time: 53.913 ms
```

Let's apply both optimization strategies. First, notice that the
`current_setting` is being invoked for each row. If we rewrite the policy as
follows:

```sql
create policy member_read_policy
    on members for select
    using (ext_memid = (select current_setting('auth.mem_xid', true)::uuid));
```

then we get the following plan:

```
                                                     QUERY PLAN
════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 Gather  (cost=1000.02..10296.36 rows=1 width=34) (actual time=0.355..14.570 rows=1 loops=1)
   Workers Planned: 2
   Workers Launched: 2
   Buffers: shared hit=7994
   InitPlan 1
     ->  Result  (cost=0.00..0.02 rows=1 width=16) (actual time=0.003..0.004 rows=1 loops=1)
   ->  Parallel Seq Scan on members  (cost=0.00..9296.24 rows=1 width=34) (actual time=5.505..9.372 rows=0 loops=3)
         Filter: (ext_memid = (InitPlan 1).col1)
         Rows Removed by Filter: 83343
         Buffers: shared hit=7994
 Planning:
   Buffers: shared hit=5
 Planning Time: 0.090 ms
 Execution Time: 14.591 ms
```

Notice that we're caching the invocation of `current_setting` in `InitPlan 1`
and its conversion from `text` to `uuid`. This gives us a speed up of 3.69.

We've still got the sequential scan. Let's add an index on the `ext_memid`
column which we're using for RLS:

```sql
create index idx_members_ext_memid on members(ext_memid);
```

We now get the following plan:

```
                                                           QUERY PLAN
════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 Index Scan using idx_members_ext_memid on members  (cost=0.44..8.46 rows=1 width=34) (actual time=0.108..0.111 rows=1 loops=1)
   Index Cond: (ext_memid = (InitPlan 1).col1)
   Buffers: shared hit=1 read=3
   InitPlan 1
     ->  Result  (cost=0.00..0.02 rows=1 width=16) (actual time=0.010..0.011 rows=1 loops=1)
 Planning:
   Buffers: shared hit=16 read=1
 Planning Time: 0.620 ms
 Execution Time: 0.158 ms
```

Not bad (it's now 340x faster). Reviewing and optimizing all the other policies
is left as an exercise for the reader. That's all for Row Level Security - if
there's something I missed please do reach out.

## References

1. [PG Docs: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
2. [PG Docs: Create Policy](https://www.postgresql.org/docs/current/sql-createpolicy.html)
3. [Row Level Security (RLS): Basics and Examples - Satori](https://satoricyber.com/postgres-security/postgres-row-level-security/)
4. [Row Level Security for Tenants in Postgres - Craig Kerstiens - Crunchy Data](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
5. [Exploring Row Level Security in PostgreSQL - pgDash](https://pgdash.io/blog/exploring-row-level-security-in-postgres.html)
6. [Tips for Row Level Security (RLS) in Postgres and
   Supabase](https://maxlynch.com/2023/11/04/tips-for-row-level-security-rls-in-postgres-and-supabase/)
7. [Row Level Security - Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
