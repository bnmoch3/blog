# Kill a PostgreSQL Connection

Let's create a user with maximum connection limit of 1:

```sql
create role some_user
  with login password 'some_password'
  connection limit 1;
```

Suppose someone has already connected to `some_db` with role `some_user`
elsewhere, if we try to make another connection we'll get the following error:

```
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: \
FATAL:  too many connections for role "some_user"
```

If we really really want to go through with this connection and can't close the
other connection directly, we'll have to use the `pg_terminate_backend` system
administration function via a superuser.

It's worth noting that each connection in Postgres is associated with a process.
To get the PID of our current connection's process, we use the `pg_backend_pid`
function:

```
> select pg_backend_pid();

 pg_backend_pid
════════════════
          34038
```

Now, let's list all the current connections:

```sql
select
    usename,  -- user name
    datname, -- database name
    backend_type,
    pid, -- process ID
    state,
    client_addr,
    client_port,
    client_hostname
from pg_stat_activity
```

This outputs:

```
  usename  │ datname │         backend_type         │  pid  │ state  │ client_addr │ client_port │ client_hostname
═══════════╪═════════╪══════════════════════════════╪═══════╪════════╪═════════════╪═════════════╪═════════════════
 some_user │ some_db │ client backend               │ 33507 │ idle   │ 127.0.0.1   │       43512 │ ¤
 admin     │ admin   │ client backend               │ 34038 │ active │ ¤           │          -1 │ ¤
 ¤         │ ¤       │ autovacuum launcher          │   815 │ ¤      │ ¤           │           ¤ │ ¤
 postgres  │ ¤       │ logical replication launcher │   816 │ ¤      │ ¤           │           ¤ │ ¤
 ¤         │ ¤       │ checkpointer                 │   800 │ ¤      │ ¤           │           ¤ │ ¤
 ¤         │ ¤       │ background writer            │   801 │ ¤      │ ¤           │           ¤ │ ¤
 ¤         │ ¤       │ walwriter                    │   814 │ ¤      │ ¤           │           ¤ │ ¤
```

We can see the `some_user` is connected to `some_db` and the pid of its
connection is 33507.

Let's kill it:

```sql
select pg_terminate_backend(33507);
```

Alternatively, we could make the above query more reusable and avoid hardcoding
the PID (which changes with each new connection):

```sql
select pg_terminate_backend(pid)
from pg_stat_activity
where usename = 'some_user';
```

We can now finally log in using another connection:

```
psql -h localhost -p 5432 -U some_user -d some_db
```
