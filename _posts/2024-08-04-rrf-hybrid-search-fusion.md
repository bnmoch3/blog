---
layout: post
title:  "Combining Lexical and Semantic Search with Reciprocal Rank Fusion"
slug: hybrid-search-rrf
tag: ["DuckDB", "RAG"]
categories: "DuckDB RAG"
excerpt_separator: <!--start-->
---

Best of both worlds sort of thing

<!--start-->

After experimenting around with lexical/keyword vs semantic search, I became
curious if there was a way to combine both in some way. Since I've been using
[FastEmbed](https://github.com/qdrant/fastembed) for generating and querying
embeddings, I ended up stumbling upon one of their blog post,
[Hybrid Search with FastEmbed & Qdrant](https://qdrant.github.io/fastembed/examples/Hybrid_Search/).
The method they highlight is called _Reciprocal Rank Fusion_, RRF. The original
[paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) provides the
definitive description but in brief RRF entails combining the rankings (rather
than scores) from different search algorithms so as to assign its own _hybrid_
score. RRF does not strictly need to be used with semantic search and lexical
search, you can use it to combine scores from 2,3 or more semantic search
approaches, or lexical search approaches, all it cares about is the derived
ranks.

DuckDB stores my embeddings, vector index and full-text search index, so I'd
prefer if I could carry out as much of the RRF within SQL, both for simplicity
and efficiency - the method used in the Qdrant approach involves a lot of
client-side imperative computation so it doesn't quite cut it.

A bit of searching here and there led me to some sample code from the
[pgvector team](https://github.com/pgvector/pgvector-python/blob/master/examples/hybrid_search_rrf.py)
that fits the bill. It is SQL-based, albeit Postgres-flavoured. With some very
very minor adjustments here and there, I was able to adopt it for my particular
case though all credits belong to the pgvector team.

For lexical search, I derive the scores as follows, nothing too fancy. Of note,
I use window queries to assign the rank in descending order. The `null last`
part is superfluous since that's the default behaviour though I prefer making it
explicit:

```sql
select
    id as entry_id,
    rank() over (
        order by fts_main_entries.match_bm25(id, $1) desc nulls last
    ) as rank
from  entries
```

Semantic search based on vector similarity is similar. Unlike FTS, it does not
produce null scores for documents that aren't entirely irrelevant so I didn't
add the `nulls last` clause in the window clause

```sql
select
    entry_id,
    rank() over(
        order by array_cosine_similarity(vec, $2::FLOAT[{dimension}]) desc
    ) as rank
from embeddings
```

Now for the fun part, combining both scores using RRF. A search result might
appear in the lexical part or the semantic part or both, that's why the
`full outer join` is there, to ensure the row is kept regardless of whether it's
from both sides or just one of them. It's also why we've got the `coalesce`,
null propagation can mess up the calculation so in case there's a null, coalesce
assigns a default score of 0. The 60 constant is somewhat of a magic number that
the authors of the RRF paper derive experimentally - it can be configured to
some other value though.

```sql
select
    coalesce(l.entry_id, s.entry_id) as entry_id,
    coalesce(1.0 / (60 + s.rank), 0.0) +
    coalesce(1.0 / (60 + l.rank), 0.0) as score
from lexical_search l
full outer join  semantic_search s using(entry_id)
order by score desc
limit 20
```

Bringing in all the snippets, we end up with:

```sql
with lexical_search as (
    select
        id as entry_id,
        rank() over (
            order by fts_main_entries.match_bm25(id, $1) desc nulls last
        ) as rank
    from  entries
),
semantic_search as (
    select
        entry_id,
        rank() over(
            order by array_cosine_similarity(vec, $2::FLOAT[{dimension}]) desc
        ) as rank
    from embeddings
)
select
    coalesce(l.entry_id, s.entry_id) as entry_id,
    coalesce(1.0 / (60 + s.rank), 0.0) +
    coalesce(1.0 / (60 + l.rank), 0.0) as score
from lexical_search l
full outer join  semantic_search s using(entry_id)
order by score desc
limit 20
```

I didn't add the limit clauses in the sub queries particularly the one for
semantic search - I'm being optimistic here that DuckDB's query optimizer will
figure it out. Though as always, it's best to check the query plan and ensure
we're ending up with an index scan rather than a sequential scan

## RRF using Polars

Here's how to calculate RRF using Polars, for comparison's sake. I'll post the
snippets bit by bit with explanations then post the whole code at a go.

Suppose `search_results` consists of PyArrow tables and each table has an `id`
column for the document ID and a `score` column for the score assigned by the
search/retrieval algorithm. The higher the score the 'closer'/more relevant the
document is to the query.

To convert a pyarrow table to a polars dataframe:

```python
df = pl.from_arrow(tbl)
```

To assign a rank to a document based on its score. This snippet also drops the
`score` column since once we have the rank we don't need the score (for RRF)

```python
df
.with_columns(
    pl.col("score")
    .rank(method="dense", descending=True)
    .alias("rank")
)
.drop("score")
```

To 'gather' all the rankings into a single dataframe, use `pl.concat` which
takes in an iterator/list of dataframes

```python
df = pl.concat(
    pl.from_arrow(tbl)
    .with_columns(
        pl.col("score")
        .rank(method="dense", descending=True)
        .alias("rank")
    )
    .drop("score")
    for r in search_results
)
```

Next, group all the rows and gather the different rankings into a list:

```python
df = df.agg(pl.col("rank").alias("ranks"))
```

If we print the dataframe at this point, we might get something similar to:

```
shape: (5, 2)
┌──────┬───────────┐
│ id   ┆ ranks     │
│ ---  ┆ ---       │
│ u32  ┆ list[u32] │
╞══════╪═══════════╡
│ 2104 ┆ [2, 3]    │
│ 2256 ┆ [1, 1]    │
│ 2056 ┆ [3, 2]    │
└──────┴───────────┘
```

Finally to calculate the RRF score:

```python
df = df.with_columns(
    (
        1
        / pl.col("ranks")
        .list.eval(pl.element() + K)
        .list.sum()
    ).alias("score")
)
.drop("ranks")
```

If we print the dataframe at this point, we might get something similar to:

```
shape: (5, 2)
┌──────┬───────────┐
│ id   ┆ score     │
│ ---  ┆ ---       │
│ u32  ┆ f64       │
╞══════╪═══════════╡
│ 2104 ┆ 0.007692  │
│ 2256 ┆ 0.008197  │
│ 2056 ┆ 0.008065  │
│ 2168 ┆ 0.007937  │
│ 2174 ┆ 0.0078125 │
└──────┴───────────┘
```

We can then sort by score then pick the top K matches.

I find chaining everything together more elegant rather than breaking it up into
different segments. Therefore, the above code can be rewritten as follows:

```python
df = (
    pl.concat(
        pl.from_arrow(tbl)
        .with_columns(
            pl.col(r.col())
            .rank(method="dense", descending=True)
            .alias("rank")
        )
        .drop("score")
        for tbl in search_results
    )
    .group_by("id")
    .agg(pl.col("rank").alias("ranks"))
    .with_columns(
        (
            1
            / pl.col("ranks")
            .list.eval(pl.element() + K) # by default K is 60
            .list.sum()
        ).alias("score")
    )
    .drop("ranks")
)
```

And that's how to calculate RRF using polars. I find the SQL more beautiful and
understandable, though the Polars dataframe style computation is more flexible.
The SQL one can only fuse two results - to add more means rewriting the entire
query. The Polars one on the other hand won't need any rewriting
