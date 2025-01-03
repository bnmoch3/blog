+++
title = "Some Notes on Vector Indexing in DuckDB"
date = "2024-08-06"
summary = "Once you've indexed your vectors for similarity search, be sure to check your query plans, just in case the DB decides to opt for a sequential scan"
tags = ["DuckDB", "RAG"]
type = "post"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "vss-duckdb-caveats"
+++

## Overview

DuckDB
[recently added vector indexing](https://duckdb.org/2024/05/03/vector-similarity-search-vss)
which is great for those of us that are tipping our toes into the current AI
field, but still like the warm comfort of good-old fashioned SQL (and
embedded/[serverless](https://www.sqlite.org/serverless.html) databases).

The VSS index is meant to speed up search - DuckDB already provides
similarity/distance functions and vector/array data types, so strictly speaking,
it is a nice-to-have feature rather than a must-have, especially when you've got
a few (1000s rather than millions) documents and can brute force your way
without slowing things down, as was my case.

Once you've added the vector index, it's worth checking that the DB actually
uses the index, specifically for the queries you wanted to speed up, and that
they actually run faster.

This post goes over a bunch of vector search SQL queries and their associated
query plans. Here's a quick and very hand-wavey primer for those that aren't
used to reading query plans:

- Each "box" or rather node is a step or action that the database undertakes
  while processing the query. An action can be something like, Order By (which
  entails sorting rows based on some criteria) or Projection (which entails
  picking some or all of the columns and leaving out the rest)
- Usually a query plan is tree-like or DAG-like but all the query plans we'll be
  going over today are somewhat linear (i.e. one step then the next step and so
  on)
- In OLAP databases such as DuckDB, indexing isn't really that important since
  most queries are going to be scanning the entire table regardless (rather than
  selecting one or two rows to carry out transactions on)
- However, for some specialized cases such as full-text search or vector
  similarity search, indexing is still quite important in OLAP DBs.
- In our case, once we've got vector indexing in place, we need to look out for
  nodes in the query plan where the DB is performing an index scan
  (`HNSW_INDEX_SCAN`) indicating that it's not brute-forcing its way via a
  sequential scan (`SEQ_SCAN`).

Let's start with some test data then create the index. The first thing to keep
in mind with vector indexing in DuckDB is ALWAYS load the extension before
running the queries - duckdb won't warn you if you don't, it'll simply opt for
sequential scan:

```sql
--  snippet below borrowed from the DuckDB docs, with some modifications
load vss;

create table tbl (id integer primary key, vec float[3]);

insert into tbl
select a, array_value(a, a+1,a+2)
from range(1, 1000) ra(a);

create index idx on tbl using hnsw (vec);
```

## Limit Clause is Necessary for Index Scan

Without the limit clause, DuckDB opts for a sequential scan - which is the
correct move. This should go without saying (specifically for top-K queries) but
is still worth mentioning:

Let's do an [explain](https://duckdb.org/docs/guides/meta/explain.html) to get
the query plan.

When omitting the `limit` clause:

```sql
explain
select * from tbl
order by array_distance(vec, [1, 2, 3]::float[3]) asc;
```

we end up with a sequential scan:

```bash
> duckdb < snippet.sql

┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│          ORDER_BY         │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│          ORDERS:          │
│           #2 ASC          │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│array_distance(vec, [1.0, 2│
│         .0, 3.0])         │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         SEQ_SCAN          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│            tbl            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 0           │
└───────────────────────────┘
```

Bringing back the limit clause:

```sql
explain
select * from tbl
order by array_distance(vec, [1, 2, 3]::float[3]) asc
limit 10;
```

And the database opts for an index scan:

```bash
> duckdb < snippet.sql

┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│            NULL           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│      HNSW_INDEX_SCAN      │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│tbl (HNSW INDEX SCAN : idx)│
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 10          │
└───────────────────────────┘
```

All good so far.

## Window Queries & Vector Search

With regards to vector search, there are cases where window queries come quite
in handy, such as when carrying out
[Reciprocal Rank Fusion](/p/hybrid-search-rrf).

However, getting DuckDB to opt for an index scan in such cases is rather hard.

Let's start off with the following query:

```sql
select
    id,
    rank() over(
        order by array_distance(vec, [1, 2, 3]::float[3]) asc
    ) as rank,
from tbl;
```

It returns every tuple. Since where clauses cannot contain values from window
functions, we need to wrap it in a CTE so as to get the top ranking rows:

```sql
with res as (
    select
        id,
        rank() over(
            order by array_distance(vec, [1, 2, 3]::float[3]) asc
        ) as rank,
    from tbl
)
select * from res
where rank <= 10;
```

However, we end up with a sequential scan:

```bash
> duckdb < snippet.sql
┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #2            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│           FILTER          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│        (rank <= 10)       │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 0           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
│             #2            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│           WINDOW          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│   RANK() OVER (ORDER BY   │
│ array_distance(vec, [...  │
│    .0]) ASC NULLS LAST)   │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         SEQ_SCAN          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│            tbl            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 0           │
└───────────────────────────┘
```

Don't quote me on this but we can rely on the implicit fact that the window
clause orders the rows for us so we can plug in the `limit` clause without
having an explicit `order by`:

```sql
explain
select
    id,
    rank() over(
        order by array_distance(vec, [1, 2, 3]::float[3]) asc
    ) as rank,
from tbl
limit 10;
```

However, this does not help much, the db still does a sequential scan for this
case.

Back to CTEs: by rewriting it a bit differently, we can get the DB to use an
index scan:

```sql
with t as (
    select id, vec
    from tbl
    order by array_distance(vec, [1, 2, 3]::float[3]) asc
    limit 10
)
select
    id,
    rank() over(
        order by array_distance(vec, [1, 2, 3]::float[3]) asc
    ) as rank
from t
```

The above query's plan is:

```bash
> duckdb < snippet.sql

┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            rank           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
│             #2            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│           WINDOW          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│   RANK() OVER (ORDER BY   │
│ array_distance(vec, [...  │
│    .0]) ASC NULLS LAST)   │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│            NULL           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│      HNSW_INDEX_SCAN      │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│tbl (HNSW INDEX SCAN : idx)│
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 10          │
└───────────────────────────┘
```

What if we move the limit clause to the 'outside':

```sql
with t as (
    select id, vec
    from tbl
    order by array_distance(vec, [1, 2, 3]::float[3]) asc
)
select
    id,
    rank() over(
        order by array_distance(vec, [1, 2, 3]::float[3]) asc
    ) as rank
from t
limit 10 -- it's now here
```

That takes us back to sequential scan, unfortunately:

```bash
> duckdb < snippet.sql
┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│           LIMIT           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            rank           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
│             #2            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│           WINDOW          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│   RANK() OVER (ORDER BY   │
│ array_distance(vec, [...  │
│    .0]) ASC NULLS LAST)   │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│          ORDER_BY         │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│          ORDERS:          │
│           #2 ASC          │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│array_distance(vec, [1.0, 2│
│         .0, 3.0])         │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         SEQ_SCAN          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│            tbl            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 0           │
└───────────────────────────┘
```

## Cosine Similarity

As for cosine similarity, it seems there's a bug (I'm on version v1.0.0
1f98600c2c just in case you're reading this from the future and it's already
fixed). DuckDB only does an index scan precisely for the case we're least likely
to consider i.e. the 'furthest' vectors.

Let's repeat the same steps but with cosine as the metric option:

```sql
create table tbl (id integer primary key, vec float[3]);
insert into tbl select a, array_value(a, a+1,a+2) from range(1, 1000) ra(a);

load vss;
create index idx on tbl using hnsw (vec) with (metric='cosine');

explain
select * from tbl
order by array_cosine_similarity(vec, [1, 2, 3]::float[3]) desc
limit 10;
```

On running, the db does a sequential scan. Note that we have to use `desc`
above, i.e. order from largest similaty score to lowest then pick the top K.
Cosine similarity scores range from 1 to -1 with values similar to the query
embedding being closer to 1.

```bash
> duckdb < snippet.sql

┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│           TOP_N           │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           Top 10          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│          #2 DESC          │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│array_cosine_similarity(vec│
│     , [1.0, 2.0, 3.0])    │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         SEQ_SCAN          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│            tbl            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│          EC: 999          │
└───────────────────────────┘
```

Let's switch to `asc` i.e. order from the least similar to the most similar:

On making the switch:

```sql
explain
select * from tbl
order by array_cosine_similarity(vec, [1, 2, 3]::float[3]) asc
limit 10;
```

we get the following plan:

```bash
> duckdb < snippet.sql

┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│            NULL           │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│      HNSW_INDEX_SCAN      │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│tbl (HNSW INDEX SCAN : idx)│
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           EC: 10          │
└───────────────────────────┘
```

Yay for index scan, but I don't think 'furthest' queries are that common.

What about switching to cosine distance instead of cosine similarity:

```sql
explain
select * from tbl
order by (1 - array_cosine_similarity(vec, [1, 2, 3]::float[3])) asc
limit 10;
```

We still get a sequential scan:

```bash
> duckdb < snippet.sql

┌─────────────────────────────┐
│┌───────────────────────────┐│
││       Physical Plan       ││
│└───────────────────────────┘│
└─────────────────────────────┘
┌───────────────────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             #0            │
│             #1            │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│           TOP_N           │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           Top 10          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│           #2 ASC          │
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         PROJECTION        │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│(1.0 - array_cosine_similar│
│ ity(vec, [1.0, 2.0, 3.0]))│
└─────────────┬─────────────┘
┌─────────────┴─────────────┐
│         SEQ_SCAN          │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│            tbl            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│             id            │
│            vec            │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│          EC: 999          │
└───────────────────────────┘
```

## Alternatives - BYOI (Bring Your Own Index)

The kinks in DuckDB's vector indexing will eventually get ironed out. In the
meantime, if need be, nothing stops us from bringing in vector indexing library
such as [hnswlib](https://github.com/nmslib/hnswlib) - aided by the fact that
DuckDB has efficient and straighforward ways of interfacing with data formats
such as numpy and arrow:

```python
with duckdb.connect(":memory:") as conn:
    conn.execute(
        """
    create table tbl (id integer primary key, vec float[3]);

    insert into tbl
    select a, array_value(a, a+1,a+2)
    from range(1, 1000) ra(a);
    """
    )

    dimension = 3
    num_elements = conn.sql("select count(*) from tbl").fetchone()[0]

    # create 'external' index
    index = hnswlib.Index(space="cosine", dim=dimension)
    index.init_index(max_elements=num_elements, ef_construction=200, M=20)

    data = conn.sql("select id, vec from tbl").fetchnumpy()
    index.add_items(data["vec"].tolist(), data["id"])

    index.set_ef(50)  # ef should always be greater than k

    # carry out search
    query_embedding = np.array([1, 2, 3], dtype=np.float32)
    ids, distances = index.knn_query(query_embedding, k=10)
```
