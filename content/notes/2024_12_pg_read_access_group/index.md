+++
title = "PostgreSQL: Create a Read-only User/Group"
date = "2024-12-09"
summary = "Let's create a read only group in PG and add users to it"
tags = ["SQL", "PostgreSQL"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "pg-create-read-only-group"
+++

Suppose we've got a role `some_user` and want to give it read access to all the
tables in a given database. It's cumbersome to grant these privileges one by
one.

Instead, let's create a `read_access` role that will have read access to all the
tables present. From there, we'll take advantage Postgres' ability to add a role
as a member of another role which will serve as a _group_. In concrete terms,
`some_user` will be added to the `read_access` 'group'. PS I learnt of this
approach from this blog post:
['Securing your PostgreSQL DB with Roles & Privileges'](https://rlopzc.com/posts/securing-your-postgresql-db-with-roles--privileges/).

It's worth emphasizing that Postgres does not really have separate notions of
users or groups, just plain roles and the ability to make one role the member of
another role and have it inherit the latter role's privileges.

As `admin`, let's start by creating the `read_access` role. Note that it has no
login privilege:

```sql
create role read_access;
```

From there, let's give it read access to all the tables:

```sql
grant select on all tables in schema public to read_access;
```

Finally, let's grant membership of `read_access` to `some_user`:

```sql
grant read_access to some_user;
```

`some_user` can now read from any table in the public schema:

```
some_user@some_db=> select * from nums;
 id │ val
════╪═════
  1 │  10
  2 │  20
  3 │  30
  4 │  40
(4 rows)
```

Given the current changes above let's list the access privileges we've got using
`\dp` in psql:

```
some_user@some_db=> \dp
                              Access privileges
 Schema │ Name │ Type  │  Access privileges   │ Column privileges │ Policies
════════╪══════╪═══════╪══════════════════════╪═══════════════════╪══════════
 public │ nums │ table │ admin=arwdDxtm/admin↵│                   │
        │      │       │ read_access=r/admin  │                   │
(1 row)
```

Back at `admin`, suppose we add a new table:

```
admin@some_db=# create table foo(a int);
CREATE TABLE
```

If we try to read from the table using `some_user`, we'll get an error:

```
some_user@some_db=> select * from foo;
ERROR:  42501: permission denied for table foo
LOCATION:  aclcheck_error, aclchk.c:2843
```

What we should have done after granting `read_access` permission to read from
all tables is also give `read_access` permission to read from all future tables
created by `admin`:

```sql
grant select on all tables in schema public to read_access;
alter default privileges for role admin
  grant select on tables to read_access;
```

From
[docs](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html):
"ALTER DEFAULT PRIVILEGES allows you to set the privileges that will be applied
to objects created in the future. (It does not affect privileges assigned to
already-existing objects.) Privileges can be set globally (i.e., for all objects
created in the current database), or just for objects created in specified
schemas".

Since `some_user` is a member of `read_access`, they can use `set role` to set
the current user to `read_access`:

```
some_user@some_db=> set role read_access;
SET
some_user@some_db=> select session_user, current_user;
 session_user │ current_user
══════════════╪══════════════
 some_user    │ read_access
(1 row)

some_user@some_db=> reset role;
RESET
```

Finally, if we no longer want `some_user` as a member of `read_access`, we can
revoke the membership:

```sql
revoke read_access from some_user;
```
