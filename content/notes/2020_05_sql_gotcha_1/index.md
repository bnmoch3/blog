+++
title = "SQL gotcha: now() vs 'now'"
date = "2020-05-27"
summary = "Make sure you're using the correct defaults when defining columns"
tags = ["SQL", "PostgreSQL"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "sql-gotcha-now"
+++

Here's something new I learnt from [Korban's](https://korban.net/postgres/book/)
Postgres course on handling time and temporal values.

When adding a default value for a timestamp column, there's a huge difference
between `now()` and `'now'` or even `'now()'`. The first one should be familiar,
if a timestamp value is not provided, the transaction timestamp (ie the time at
the start of the transaction) is inserted instead. However, the last two are the
same, and in most cases, probably not the intended default value: they return
the timestamp value at the time the table was created.

Consider the following table, keeping in mind the default values for both
`created_at` and `updated_at`

```sql
begin;

select now(); 
--  2020-05-27 16:41:34.208137

create table users(
    user_id serial primary key,
    username varchar(15),
    created_at timestamp default now(),
    updated_at timestamp default 'now()'
);

commit;
```

Now, on inserting a couple of items, we see how the `updated_at` column ends up
defaulting to the wrong value, unless, of course, it's what was really intended:

```sql
insert into users(username) values('Alice') returning now();
--  2020-05-27 16:41:53.857192 
--  2020-05-27 16:41:53.857192 (created_at) ✔️
--  2020-05-27 16:41:34.208137 (updated_at) ❌ 
--  2020-05-27 16:41:34.208137 (table creation timestamp)

insert into users(username) values('Bob') returning now();
--  2020-05-27 16:42:09.170153 
--  2020-05-27 16:42:09.170153 (created_at) ✔️
--  2020-05-27 16:41:34.208137 (updated_at) ❌
--  2020-05-27 16:41:34.208137 (table creation timestamp)
```