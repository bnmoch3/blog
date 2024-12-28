+++
title = "Arrays, Constraints & Immutable Functions"
date = "2024-12-28"
summary = "Tightening what kinds of values array columns can hold using constraints and immutable functions"
tags = ["PostgreSQL", "SQL"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = true
slug = "pg-arrays-constraints-immutable-functions"
+++

TIL you can use immutable functions in Postgres check constraints. I learnt this
from Sehrope Sarkuni's PGConfig NYC 2021 talk:
"[Advanced Postgres Schema Design...](https://www.youtube.com/watch?v=lkWiyEe2RUQ)".

From the Postgres docs, immutable functions:

> cannot modify the database and always returns the same result when given the
> same argument values; that is, it does not do database lookups or otherwise
> use information not directly present in its argument list

When coupled with check constraints on arrays, they let us 'tighten' the kind of
values an array column can take in.

Let's use an example; suppose we've got a table where we're storing room IDs and
the days of the week those rooms are available (Monday is 1, Sunday is 7):

```sql
create table room(
    id int primary key,
    available int[] not null
);
```

The first constraint we'll add is that values in the array have to be within 1
and 7:

```sql
create function array_contains_valid_iso_days(int[]) returns bool
language sql immutable as
$$
    select not exists (select 1 from unnest($1) x where x < 1 or x > 7);
$$;

alter table room add constraint room_ck_valid_iso_days
  check(array_contains_valid_iso_days(available) is true);
```

The following insertion will fail, since 8,9 and 10 don't represent a valid day
of the week:

```
> insert into room(id,available) values (1,'{8,9,10}');

ERROR:  23514: new row for relation "room" violates check constraint "room_ck_valid_iso_days"
DETAIL:  Failing row contains (1, {8,9,10}).
SCHEMA NAME:  public
TABLE NAME:  room
CONSTRAINT NAME:  room_ck_valid_iso_days
LOCATION:  ExecConstraints, execMain.c:2039
```

This insertion will work though:

```sql
insert into room(id,available) values (1,'{{1,2},{3,4}}');
```

So the next constraint has to be on dimensions, entries must have only 1
dimension. After deleting the previous row (with multi-dimensional days), let's
add the following constraint:

```sql
alter table room add constraint room_ck_array_dim_1
  check(array_ndims(available)=1);
```

Arrays allow for duplicate values. In our case though, it does not make sense
for a day to be repeated more than once:

```sql
insert into room(id,available) values (2,'{1,2,2,2,4}');
```

Let's add a constraint that ensures all values of the array are unique (there
are no duplicate days of the week):

```sql
create function array_has_no_duplicates(int[]) returns bool
language sql immutable as
$$
    select count(*) = count(distinct e) from unnest($1) as e;
$$;

alter table room add constraint room_ck_no_duplicates
    check(array_has_no_duplicates(available) is true);
```

Finally, though not necessary, we can add a constraint to ensure the values are
sorted (I got this directly from Sarkuni's slides):

```sql
create or replace function array_sort(int[]) returns int[]
language sql immutable as
$$
    select array_agg(e order by e) from unnest($1) as e
$$;

alter table room add constraint room_ck_is_sorted
    check(array_sort(available) = available);
```
