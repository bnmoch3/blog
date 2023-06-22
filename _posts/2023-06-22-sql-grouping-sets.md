---
layout: post
title:  "SQL: Grouping sets, Rollups & Cube"
date:   2023-06-22 12:00:00 +0000
tag: ["sql", "duckdb", "postgres"]
categories: misc
excerpt_separator: <!--start-->
---

<!--start-->

Let's motivate grouping sets with an example. Both the dataset and prompt are
sourced from
[pgexercises](https://pgexercises.com/questions/aggregates/fachoursbymonth3.html) -
an excellent resource for learning and practicing Postgres-flavoured SQL. I'll
also be using DuckDB (it's SQL is also Postgres-flavoured) along the way.

We've got a country club which has a couple of facilities such as tennis courts,
pool tables. We're using a database to keep track of members and bookings.
Members (and guests, at a slightly higher rate) can book facilities. The
duration for a given booking is kept track of using a `starttime` and the number
of half-hour `slots`.

We want to know:

- For each facility:
  - the number of slots booked for the entire month
  - the number of slots booked for the entire year (2012)
- The total number of slots booked across the entire country club for that year

In other words, the result should have the following shape:

| Facility        | Month     | Slots |
| --------------- | --------- | ----- |
| Tennis Court 2  | August    | 483   |
|                 | September | 588   |
|                 |           | 1071  |
| Badminton Court | August    | 459   |
|                 | September | 579   |
|                 |           | 1029  |
| Total           |           | 2100  |

As you can observe, we are aggregating across multiple hierarchies or 'zoom
levels' as phrased in the pgexercises discussion section.

The most straightforward approach then is to carry out the aggregations
separately then union them all together:

```sql
select
    facid,
    extract('month' from starttime) as month,
    sum(slots) as slots,
from bookings b
where b.starttime >= '2012-01-01' and starttime < '2013-01-01'
group by b.facid, extract('month' from starttime)

union all

select
    facid,
    null,
    sum(slots) as slots,
from bookings b
where b.starttime >= '2012-01-01' and starttime < '2013-01-01'
group by facid,

union all

select
    null,
    null,
    sum(slots) as slots,
from bookings b
where b.starttime >= '2012-01-01' and starttime < '2013-01-01'


order by facid asc nulls last, month asc nulls last
```

Note that we use `union all` instead of `union` since we don't expect (or mind)
any duplicate rows.

This query could be made less verbose by using a
[CTE](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-cte/) -
again, credits to pgexercises:

```sql
with t as (
    select
        facid,
        extract('month' from starttime) as month,
        slots
    from bookings b
    where b.starttime >= '2012-01-01' and starttime < '2013-01-01'
)
select facid, month, sum(slots) from t group by facid, month
union all
select facid, null,  sum(slots) from t group by facid
union all
select null,  null,  sum(slots) from t
order by facid asc nulls last, month asc nulls last
```

## Rollup

Better yet, the above query could be simplified by using `rollup`:

```sql
select
    facid,
    extract('month' from starttime) as month,
    sum(slots)
from bookings
where starttime >= '2012-01-01' and starttime < '2013-01-01'
group by rollup(facid, month)
order by facid asc nulls last, month asc nulls last
```

With all three version, we get the same result:

```
┌─────────────────┬───────────┬────────┐
│    facility     │   month   │ slots  │
│     varchar     │  varchar  │ int128 │
├─────────────────┼───────────┼────────┤
│ Tennis Court 2  │ August    │    483 │
│ Tennis Court 2  │ September │    588 │
│ Tennis Court 2  │           │   1071 │
│ Badminton Court │ August    │    459 │
│ Badminton Court │ September │    570 │
│ Badminton Court │           │   1029 │
│                 │           │   2100 │
└─────────────────┴───────────┴────────┘
```

Rollup is used to aggregate across levels in the order they are passed.
Therefore, with `facid, month` we get the levels in the following order:

- `(facility, month)`: sum the slots for each facility, month pair
- `(facility)`: sum the slots for each facility
- `()`: sum all slots

If we switch the order i.e. to `(month, facility)`, we get a result with the
following shape:
