---
layout: post
title:  "SQL: Grouping sets, Rollups & Cube"
date:   2023-06-22 12:00:00 +0000
tag: ["sql", "duckdb", "postgres"]
categories: sql
excerpt_separator: <!--start-->
---

<!--start-->

Let's motivate grouping sets with an example. Both the dataset and prompt are
sourced from
[pgexercises](https://pgexercises.com/questions/aggregates/fachoursbymonth3.html) -
an excellent resource for learning and practicing Postgres-flavoured SQL. I'll
also be using DuckDB (it's SQL is also Postgres-flavoured) along the way.

We've got a country club which has a couple of facilities such as tennis courts
and pool tables. We're using a database to keep track of members and bookings.
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
levels'.

The most straightforward approach then is to carry out the aggregations
separately then union them all together:

```sql
select
    facility,
    month,
    sum(slots) as slots
from bookings_2012
group by facility, month

union all

select
    facility,
    null,
    sum(slots) as slots
from bookings_2012
group by facility

union all

select
    null,
    null,
    sum(slots) as slots
from bookings_2012
group by facility


order by facility, month
```

Note that we use `union all` instead of `union` since we don't expect (or mind)
any duplicate rows.

This query could be made less verbose by using a
[CTE](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-cte/) -
again, credits to pgexercises:

```sql
with t as (
    select
        facility,
        month,
        slots
    from bookings_2012
)
select facilty,  month, sum(slots) from t group by facility, month
  union all
select facility, null,  sum(slots) from t group by facility
  union all
select null,     null,  sum(slots) from t
order by facility, month;
```

## Rollup

Better yet, the above query could be simplified by using `rollup`:

```sql
select
    facility,
    month,
    sum(slots)
from bookings_2012
group by rollup(facilty, month)
order by facility, month
```

With all three versions, we get the same result:

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
Therefore, with `facility, month` we get the levels in the following order:

- `(facility, month)`: sum the slots for each facility, month pair
- `(facility)`: sum the slots for each facility
- `()`: sum all slots

If we switch the order i.e. to `(month, facility)`, we get a result with the
following shape:

| Facility  | Month           | Slots |
| --------- | --------------- | ----- |
| August    | Tennis Court 2  | 483   |
|           | Badminton Court | 459   |
|           |                 | 942   |
| September | Tennis Court 2  | 588   |
|           | Badminton Court | 570   |
|           |                 | 1158  |
| Total     |                 | 2100  |

## Grouping set

Rollups are in fact syntactic sugar for the more generic `grouping sets` clause.
Therefore, `group by rollup(facility, month)` expands to:

```
group by grouping sets(
  (facility, month),
  (facility),
  (),
)
```

Grouping sets were added to SQL since with the plain group by, you can only
specify a single grouping to aggregate across.

However, as the previous example demonstrates you may need to aggregate across
multiple kinds of groups in parallel - hence `grouping sets` in SQL.

Grouping sets give as more flexibility. For example, if we don't need the year's
sum we can discard it:

```sql
select
    facility,
    month,
    sum(slots) as slots
from bookings_2012
group by grouping sets ((facility, month), (facility))
```

The result is:

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
└─────────────────┴───────────┴────────┘
```

## Cube

There's also `cube` which we can use to aggregate across all possible
permutations of the given columns and expressions (i.e. the powerset). For
example, from the Postgres docs, `group by cube(a,b,c)` is equivalent to:

```
grouping sets (
    ( a, b, c ),
    ( a, b    ),
    ( a,    c ),
    ( a       ),
    (    b, c ),
    (    b    ),
    (       c ),
    (         )
)
```

## grouping aggregate function

As an aside, consider the following case: if a column within that grouping set
has a null, it cannot be distinguished from the columns outside the group (since
those are also filled with nulls). Therefore, both Postgres and DuckDB provide
the `grouping` function. In duckdb, it also has the alias `grouping_id`. This
function takes in a group and returns 0 if that row is in the given group or 1
otherwise.

For example, given the following query:

```sql
select
    facility,
    month,
    grouping_id(month) as in_group_month,
    sum(slots)
from bookings_2012
group by grouping sets (facility, month)
order by facility, month
```

We get:

```sql
┌─────────────────┬───────────┬────────────────┬────────────┐
│    facility     │   month   │ in_group_month │ sum(slots) │
│     varchar     │  varchar  │     int64      │   int128   │
├─────────────────┼───────────┼────────────────┼────────────┤
│ Badminton Court │           │              1 │       1209 │
│ Tennis Court 2  │           │              1 │       1278 │
│                 │ August    │              0 │        942 │
│                 │ July      │              0 │        387 │
│                 │ September │              0 │       1158 │
└─────────────────┴───────────┴────────────────┴────────────┘
```

## In summary

Do check out the Postgres documentation for more details on `grouping sets`.
It's quite a neat addition to SQL that saves us from both verbose queries and
having to merge results client-side for certain kinds of reporting.

## References

1. PostgreSQL Exercises - Alisdair Owens:
   [pgexercises](https://pgexercises.com/questions/aggregates/fachoursbymonth3.html)
2. PostgreSQL Documentation - GROUPING SETS, CUBE and ROLLUP:
   [docs](https://www.postgresql.org/docs/15/queries-table-expressions.html#QUERIES-GROUPING-SETS)
3. DuckDB Documentation - GROUPING SETS:
   [link](https://duckdb.org/docs/sql/query_syntax/grouping_sets)
4. PostgreSQL GROUPING SETS:
   [Postgres Tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-grouping-sets/)
5. The Art of Postgres - Grouping Sets - Dimitri Fontaine
