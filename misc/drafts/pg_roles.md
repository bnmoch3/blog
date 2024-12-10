# PostgreSQL: Managing Roles, Attributes and Privileges

Postgres handles DB access permissions through roles which can own database
objects (tables, sequences, functions, schemas etc) and grant/revoke access
privileges to these objects to/from other roles [1]. Also, roles can be assigned
membership to other roles - the 'parent' roles serves as a 'group' and members
assigned to that parent role inherit all the privileges and permissions of the
parent.

Let's explore roles in Postgres.

I've got an `admin` role already set up. Let's add a new role `some_user`:

```
create role some_user with password 'some_password';
```

Now let's list all the roles in currently in the database:

```sql
select rolname from pg_roles;
```

This outputs:

```sql
           rolname
═════════════════════════════
 admin
 pg_checkpoint
 pg_create_subscription
 pg_database_owner
 pg_execute_server_program
 pg_maintain
 pg_monitor
 pg_read_all_data
 pg_read_all_settings
 pg_read_all_stats
 pg_read_server_files
 pg_signal_backend
 pg_stat_scan_tables
 pg_use_reserved_connections
 pg_write_all_data
 pg_write_server_files
 postgres
 some_user
```

You can see `some_user`, the role we created, at the bottom. The roles with the
prefix 'pg_' are
[predefined roles](https://www.postgresql.org/docs/current/predefined-roles.html).
From the docs: "PostgreSQL provides a set of predefined roles that provide
access to certain, commonly needed, privileged capabilities and information.
Administrators... can GRANT these roles to users and/or other roles in their
environment, providing those users with access to the specified capabilities and
information". As an example, if `pg_read_all_settings` is granted to a role, it
lets that role read all the configuration variables. For more details on each
predefined role, check out
[this section of the Docs](https://www.postgresql.org/docs/current/predefined-roles.html).

There's also another way of listing roles we've created when using psql, via
`\du`:

```
admin@admin=# \du
                             List of roles
 Role name │                         Attributes
═══════════╪════════════════════════════════════════════════════════════
 admin     │ Superuser, Create role, Create DB
 postgres  │ Superuser, Create role, Create DB, Replication, Bypass RLS
 some_user │ Cannot login
```

This gives us the role names plus attributes. We'll get to role attributes soon
enough.

While still within psql, let's get the role we're currently using:

```
admin@admin=# select current_user, session_user;
 current_user │ session_user
══════════════╪══════════════
 admin        │ admin
(1 row)
```

We used the following functions:

- `current_user`: this retrieves current role/user against which permissions
  will be checked
- `session_user`: this retrieves the original role/user that initiated the
  current database connection (see Docs section on
  [System Information Functions](https://www.postgresql.org/docs/9.1/functions-info.html))

To change the current role/user, we can use `set role`; `session_user` remains
unchanged:

```
admin@admin=# set role some_user;
SET
admin@admin=> select session_user, current_user;
 session_user │ current_user
══════════════╪══════════════
 admin        │ some_user
(1 row)

admin@admin=> reset role;
RESET
```

If `some_user` is a member of a group such as `read_access`, it can always carry
out `set role` to that parent role even if `some_user` is not a superuser.

If we want to change the `session_user` too, we use `set session authorization`.
However, to run this command, we must be a superuser:

```
admin@admin=# set session authorization some_user;
SET
some_user@admin=> select session_user, current_user;
 session_user │ current_user
══════════════╪══════════════
 some_user    │ some_user
(1 row)

some_user@admin=> reset session authorization;
RESET
```

Next, let's create a test database as admin:

```sql
create database some_db;
```

Then, in a separate shell, let's try to connect to the database using
`some_user`:

```
psql -h localhost -p 5432 -U some_user -d some_db
```

This fails with the following error:

```
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: \
FATAL:  role "some_user" is not permitted to log in
```

This brings us to
[**Role Attributes**](https://www.postgresql.org/docs/current/role-attributes.html)
which I earlier alluded to. These are capabilities or permissions assigned to a
role itself (i.e. set at the role level and cut across the entire DB). When we
ran `\du` in psql, the second column `Attributes` had all the roles' respective
attributes.

Role Attributes are contrasted with
[**Privileges**](https://www.postgresql.org/docs/current/ddl-priv.html) which
are capabilities or permissions a role has over specific database objects. We'll
get to privileges later on.

The permission to login is an attribute that has to be given to a role. We could
have assigned it at definition as follows:

```sql
create role some_user with login password 'some_password';
```

However, since `some_user` already exists, we'll have to alter the role to add
the login attribute:

```sql
alter role some_user with login;
```

Here are all the role attributes available
[as per the Postgres 17 docs](https://www.postgresql.org/docs/current/role-attributes.html):

- **login**: can connect to the DB server and log in
- **superuser**: can bypass all permission checks, except the right to log in
- **createdb**: can create database
- **createrole**: can create another role. However, does not imply the role can
  create superusers or replication users. Also does not imply a role with
  `createrole` attribute can grant or revoke `replication` and `bypassrls`
  privileges
- **replication**: can initiate streaming replication
- **password**: set password that client can use to authenticate for login with
  role
- **noinherit**: disable inheriting privileges from groups (roles) the given
  role is a member of
- **bypassrls**: can bypass row-level security
- **connection limit**: sets the maximum concurrent connections a role can make,
  default is no limit (-1)

Let's try to create a table as `some_user` whilst we've connected to `some_db`:

```
some_user@some_db=> create table nums(id serial primary key, val int);
ERROR:  42501: permission denied for schema public
LINE 1: create table nums(id serial primary key, val int);
                     ^
LOCATION:  aclcheck_error, aclchk.c:2843
```

We get an error. Recall that the owner of the database `some_db` is `admin` and
that by default, Postgres creates the schema `public` for a database. The error
message is pretty straightforward, `admin` needs to give permission to
`some_user` to create a table within the `public` schema.

For the time being, the admin can create the table directly:

```
admin@some_db=# create table nums(id serial primary key, val int);
CREATE TABLE
```

And insert some values:

```sql
admin@some_db=# insert into nums(val) values (10),(20),(30);
INSERT 0 3
```

Back at `some_user`'s session, let's try to select values from the `nums` table:

```
some_user@some_db=> select * from nums;
ERROR:  42501: permission denied for table nums
LOCATION:  aclcheck_error, aclchk.c:2843
```

Again, another error.

Which brings us to
[privileges](https://www.postgresql.org/docs/current/ddl-priv.html), permissions
granted over individual database objects by the owner.

`admin` is the owner of `some_db`. Let's list all the databases in our system
plus their respective owners:

```sql
select datname db, pg_catalog.pg_get_userbyid(d.datdba) owner
from pg_catalog.pg_database d
order by 1;
```

Which gives:

```
    db     │  owner
═══════════╪══════════
 admin     │ admin
 postgres  │ postgres
 some_db   │ admin
 template0 │ postgres
 template1 │ postgres
```

Within `some_db`, admin also owns the `nums` table plus the associated
`nums_id_seq` sequence for the`id` column:

```
admin@some_db=# \d
            List of relations
 Schema │    Name     │   Type   │ Owner
════════╪═════════════╪══════════╪═══════
 public │ nums        │ table    │ admin
 public │ nums_id_seq │ sequence │ admin
```

Using the `\dn` command in psql, we can view all the schemas we got plus their
respective owners:

```psql
admin@some_db=# \dn
      List of schemas
  Name  │       Owner
════════╪═══════════════════
 public │ pg_database_owner
```

We've got `public` schema. It is owned by `pg_database_owner`, one of the
predefined roles we came across earlier. `pg_database_owner` is a 'group' role for
which the owner of the database, `admin` in our case, is added to as a member
when the database is getting created. Check out this blog post,
[New Public Schema Permissions in PostgreSQL 15](https://www.enterprisedb.com/blog/new-public-schema-permissions-postgresql-15)
from EnterpriseDB to see why Postgres uses what seems to be an indirect way to
set the owner of a database's public schema.

Btw, to get what query a psql command 'expands' to, use `\set ECHO_HIDDEN` as
detailed
[here](https://andrewtimberlake.com/blog/2015/05/view-the-sql-query-behind-psql-commands).

Let's start by allowing `some_user` to read from the `nums` table:

```
admin@some_db=# grant select on nums to some_user;
GRANT
```

If we go to `some_user`'s session, we can now read from `nums` table:

```
some_user@some_db=> select * from nums;
 id │ val
════╪═════
  1 │  10
  2 │  20
  3 │  30
```

What about allowing `some_user` to insert into `nums`:

```
admin@some_db=# grant insert on nums to some_user;
GRANT
```

However, `some_user` still can't insert:

```
some_user@some_db=> insert into nums(val) values (40);
ERROR:  42501: permission denied for sequence nums_id_seq
LOCATION:  nextval_internal, sequence.c:652
```

Recall that the `nums` table has an `id` primary key column which gets its
default value from the `nums_id_seq` sequence. Let's give `some_user` permission
to update the sequence value for `nums_id_seq`:

```
admin@some_db=# grant update on nums_id_seq to some_user;
GRANT
```

`some_user` can now populate the `id` field using the sequence:

```
some_user@some_db=> insert into nums(val) values (40);
INSERT 0 1
some_user@some_db=> select * from nums;
 id │ val
════╪═════
  1 │  10
  2 │  20
  3 │  30
  4 │  40
```

It also makes sense to give `some_user` permission to read the current value of
the `nums_id_seq` if they need to:

```
admin@some_db=# grant select on nums_id_seq to some_user;
GRANT
```

Now `some_user` can also read the current value:

```
some_user@some_db=> select currval('nums_id_seq');
 currval
═════════
       4
```

The `update` privilege is fine-grained and can be granted per column. For
example, what if we want to allow `some_user` to update `val` but not `id`:

```
admin@some_db=# grant update(val) on nums to some_user;
GRANT
```

At `some_user`, we can now carry out the following update:

```
some_user@some_db=> update nums set val=41 where id=4;
UPDATE 1
```

But we can't modify the `id` column:

```
some_user@some_db=> update nums set id=1000 where id=1;
ERROR:  42501: permission denied for table nums
LOCATION:  aclcheck_error, aclchk.c:2843
```

We can also allow `some_user` to create their own objects on `some_db`'s
`public` schema:

```
admin@some_db=# grant create on schema public to some_user;
GRANT
```

Now, `some_user` can create their own table, which is what we were trying to do
previously:

```
some_user@some_db=> create table foo(a int);
CREATE TABLE
```

Listing the relations, we see that the owner of `foo` is `some_user`:

```
admin@some_db=# \d
              List of relations
 Schema │    Name     │   Type   │   Owner
════════╪═════════════╪══════════╪═══════════
 public │ foo         │ table    │ some_user
 public │ nums        │ table    │ admin
 public │ nums_id_seq │ sequence │ admin
(3 rows)
```

Since `some_user` _owns_ `foo`, they don't need any further permissions from
`admin` to insert data, read, delete from it, update, truncate or drop from the
table:

```
some_user@some_db=> insert into foo values (42);
INSERT 0 1
some_user@some_db=> select * from foo;
 a
════
 42
(1 row)

some_user@some_db=> update foo set a=43 where a=42;
UPDATE 1
some_user@some_db=> truncate foo;
TRUNCATE TABLE
some_user@some_db=> drop table foo;
DROP TABLE
some_user@some_db=> create table foo(a int); -- create table again
CREATE TABLE
```

From the docs, here are all the available privileges:

- **select**: can select from all columns of a table or table-like objects such
  as materialized views. Can also be restricted to specific columns. Necessary
  as a pre-condition for non-trivial update, delete or merge procedures
- **insert**: can insert new rows to a table. Can be restricted to specific
  columns, the unauthorized columns will be populated using the default values
- **update**: can update all or specific columns of a table
- **delete**: can delete row(s) of a table
- **truncate**: can truncate the table
- **references**: can refer to any or specific columns of a table when creating
  foreign keys to that table
- **trigger**: can create triggers on that table
- **create**
  - for databases: can create schemas, install trusted extensions
  - for schemas: can create objects within that schema
  - for tablespaces: can create tables, indexes, temporary files within the
    tablespace
- **connect**: can connect to the database
- **temporary**: can create temporary tables
- **execute**: can call functions or procedures
- **usage**:
  - for schemas: can look up objects within the schema
  - for sequences: can use `currval` and `nextval` functions
  - checks docs for additional details on how usage relates to procedural
    languages, types, domains, foreign data wrappers, foreign servers
- **set**: can set a server config parameter
- **alter system**: can configure a server parameter using `alter system`
- **maintain**: can carry out system maintenance tasks such as vacuum and
  analyze

Let's change ownership of the `nums` table to `some_user`:

```
admin@some_db=# alter table nums owner to some_user;
ALTER TABLE
```

Suppose we wanted to delete `some_user` from the system:

```
admin@some_db=# drop role some_user;
ERROR:  2BP01: role "some_user" cannot be dropped because some objects depend on it
DETAIL:  privileges for schema public
owner of sequence nums_id_seq
owner of table nums
owner of table foo
LOCATION:  DropRole, user.c:1297
```

We get an error. From the docs section on
[dropping roles](https://www.postgresql.org/docs/current/role-removal.html):
"Because roles can own database objects and can hold privileges to access other
objects, dropping a role is often not just a matter of a quick DROP ROLE. Any
objects owned by the role must first be dropped or reassigned to other owners;
and any permissions granted to the role must be revoked".

Here's how we'll go about dropping `some_user` then since they own some database
objects (`nums`, `nums_id_seq`, `foo`) and have privileges granted to them in
the `public` schema:

1. We'll revert the ownership of `nums` and `nums_id_seq` back to `admin` since
   we want to keep that table
2. From there we'll drop everything else owned by `some_user` such as the table
   `foo`, and revoke the permissions granted to them on `public` schema
3. Finally we'll delete `some_user`

```
admin@some_db=# alter table nums owner to admin;
ALTER TABLE
admin@some_db=# drop table foo;
DROP TABLE
admin@some_db=# revoke all on schema public from some_user;
REVOKE
admin@some_db=# drop role some_user;
DROP ROLE
```

If we've got lots of objects and permissions we're dealing with, going through
them one by one before dropping a role will be cumbersome. Postgres provides us
a faster way:

1. Drop the objects owned by `some_user` we don't want to retain
2. Reassign the rest to another user such as `admin` in one sweep using the
   `reassign owned by` command
3. Drop all the privileges granted to `some_users` in one sweep using the
   `drop owned by` command
4. Drop the role itself

Assuming we want to keep all objects owned by `some_user`, we're going to skip
the first step, then we can carry out step 2 to 4 as follows:

```
reassign owned by some_user to admin;
drop owned by some_user;
drop role some_user;
```

For more details on dropping roles, check the PG docs section on
[Dropping Roles](https://www.postgresql.org/docs/current/role-removal.html).

That's all for now.

## References

1. [PG Docs - Database Roles](https://www.postgresql.org/docs/current/user-manag.html)
2. [PG Docs - Privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
3. [Securing your PostgreSQL DB with Roles & Privileges - Romario López](https://rlopzc.com/posts/securing-your-postgresql-db-with-roles--privileges/)
