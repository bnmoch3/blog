# PostgreSQL Schemas: Namespacing for Objects

Postgres offers schemas as a means for organizing objects (tables, views,
indexes etc) into separate namespaces. Worth noting that schemas here are
entirely different from the general notion of a schema in databases (DDL,
defining the table stuctures, data types, relationships, indexes etc). This post
will focus on the former, schemas as namespaces. I got interested in schemas
since I'm currently exploring various approaches for multi-tenancy in Postgres
(one of the approaches is setting up a schema for each customer). Let's start
with an overview:

## Overview of Schemas

Per a Postgres instance, we've got the following hierarchy:

1. **Databases**, which contain:
2. **Schemas**, which contain:
3. **Tables, Indexes, Views, Functions etc*** (database objects)

Let's start with the basics. First, create a database, then connect to it:

```sql
> create database hotel;
> \c hotel
```

Next, let's create a schema:

```sql
create schema app;
```

Lastly, some table:

```sql
create table hotel.app.bookings (id int primary key);
```

On querying this table, we get an error:

```
> select * from bookings;
ERROR:  42P01: relation "bookings" does not exist
LINE 1: select * from bookings;
                      ^
LOCATION:  parserOpenTable, parse_relation.c:1449
```

That's because of what PG calls the _schema search path_. From the
[docs](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH):

> ... tables are often referred to by unqualified names, which consist of just
> the table name. The system determines which table is meant by following a
> search path, which is a list of schemas to look in. The first matching table
> in the search path is taken to be the one wanted. If there is no match in the
> search path, an error is reported, even if matching table names exist in other
> schemas in the database.

Let's check our search path, which by default should return:

```
> show search_path;
   search_path
═════════════════
 "$user", public
(1 row)
```

From the docs: "The first element specifies that a schema with the same name as
the current user is to be searched. If no such schema exists, the entry is
ignored. The second element refers to the public schema that we have seen
already".

So Postgres first checks for the existence of `"$user".bookings`. I hadn't
created that schema so it moves on to check for `public.bookings` which does not
exist. Finally, it errors out.

One fix is to use the fully qualified name as we did when creating the table,
`database.schema.table`:

```
> select * from hotel.app.bookings;
```

The database part is superfluous, we don't need to add `hotel.<schema>.<table>`
since each Postgres connection is associated with one and only one database
which can be inferred by Postgres. Specifying the schema is necessary though for
disambiguation since a database can have multiple schemas.

Another fix is to alter the `search_path` and make our schema `app` the first
path where Postgres checks. This also lets us use unqualified names:

```
> set search_path to app,public;
> select * from bookings;
```

This is a per-session config, when we restart our client we'll have to set it
again. To make the config persist across future sessions:

```
> alter role <role> set search_path to app,public;
```

Also, some notes on the `public` schema:

- whenever we create a database, Postgres also creates a default schema for us,
  the `public` schema
- if we don't alter the default search path, then any time we create a database
  object, it will be placed in the `public` schema
- thanks to the `public` schema and the default search path, beginners can use
  Postgres without ever being cognizant of schemas
- there's nothing special about the `public` schema, we can drop it if we don't
  need it.

Given that schemas are namespaces, we can create the same table with the same
name but in a different schema entirely:

```
> create schema analytics;
> create table analytics.bookings as select * from app.bookings;
> select count(*) from analytics.bookings;
```

Which leads us to why Postgres gives us schemas, from the docs [1]:

- allow many users to use one database without interfering with each other
- organize database objects into logical groups to make them more manageable
- third-party applications can be put into separate schemas so they do not
  collide with the names of other objects

If need be, we can move tables from one schema to another:

```
> create table stats (count int);
/* oops, we meant for this table to be in the analytics schema */

> alter table app.stats set schema analytics;
```

Or rename schemas:

```
alter schema app rename to main;
```

This means we'll also have to sync our search path for both the current session
and future sessions (search_path still set to app then public):

```
> set search_path to main,public; /* current session */
> alter role <role> set search_path to main,public; /* future sessions */
```

Also we're not really using the public schema, let's drop it:

```sql
> drop schema public;
```

## References

1. [PG Docs - Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATTERNS)
2. [Using Postgres Schemas - Aaron Ellis](https://aaronoellis.com/articles/using-postgres-schemas)
