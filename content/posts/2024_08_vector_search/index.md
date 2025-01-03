+++
title = "Vector Indexing and Search with DuckDB & FastEmbed"
date = "2024-08-03"
summary = "Using DuckDB for vector/semantic search"
tags = ["DuckDB", "RAG"]
type = "post"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "vector-search-duckdb-fastembed"
+++

## Overview

This post goes over using DuckDB for vector/semantic search. The embeddings are
generated using a [FastEmbed](https://github.com/qdrant/fastembed)-based UDF.
The model used for embedding is
[BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) which
can be run locally (FastEmbed handles the downloading and setting up). To speed
up embeddings, I used GPU-based generation which is 3 times faster than the
CPU-based counterpart as per some benchmarks I ran.

## Dataset

The dataset that we'll be carrying out search over is derived from
[Postgres Weekly](https://postgresweekly.com/issues). Each week PG Weekly
publishes a 'weekly email roundup of Postgres news and articles'. Unfortunately,
they don't provide search for previous editions so we'll have to handle that
part ourselves.

Let's skip over the nitty-gritties (downloading the issues, cleaning up,
parsing, etc). The entries in each issue are stored in the `entries` table. This
table has the following schema (columns not referenced in this post are omitted,
for simplicity).

```sql
create table entries(
    id integer primary key,
    title varchar not null,
    content varchar,
    tag varchar
);
```

## Generating Embeddings

From there, let's get the model:

```python
from fastembed import TextEmbedding

name = "BAAI/bge-small-en-v1.5"
model = TextEmbedding(model_name=name, providers=["CUDAExecutionProvider"])
model_description = model._get_model_description(name)
dimension = model_description["dim"]
```

The model's dimension is 384, we'll need it when setting up the schema for
emebeddings and querying too.

Next, let's connect to DuckDB:

```python
import duckdb

db_path = "./pg_weekly.db"
conn = duckdb.connect(db_path)
```

From there, let's create a UDF which we will use to generate emebeddings within
DuckDB. The function is vectorized - it takes a vector of string and returns a
vector of embeddings.

```python
import duckdb.typing as t
import numpy as np
import pyarrow as pa

def embed_fn(documents):
    embeddings = model.embed(documents.to_numpy())
    return pa.array(embeddings)

conn.create_function(
    "embed",
    embed_fn,
    [t.VARCHAR],
    t.DuckDBPyType(list[float]),
    type="arrow",
)
```

I opted for a UDF out of familiarity though I think it's unnecessary: I have a
hunch that querying all the data from the database into the client, carrying out
the embeddings generation then bulk inserting should be faster than using a UDF
but I'll have to test it out first.

From there, let's create the table to store the embeddings and insert them.
Everything from here will be carried out within a transaction, just in case
something goes wrong>

```sql
conn.execute("begin")
```

For the emebeddings table:

```python
conn.execute(
    f"""
create or replace table embeddings(
    entry_id int unique not null,
    vec FLOAT[{dimension}] not null,

    foreign key(entry_id) references entries(id)
);
""",
)
```

We have to build the string rather than pass the `dimension` as an argument
since DDL statements don't allow for parametrized queries - at least in this
case.

As for the generation:

```python
conn.execute(
    """
    insert into embeddings by name
    (select
        id as entry_id,
        embed(title || '\n' || coalesce(content, '')) as vec
    from entries)
    """
)
```

The `content` column might have null values hence the `coalesce` - null
propagates resulting in the entire string being null which in turn errors out
during embedding.

## Vector Indexing

DuckDB now offers native
[vector indexing](https://duckdb.org/2024/05/03/vector-similarity-search-vss.html),
let's use it rather than relying on an external library, or worse, an entire
service.

First let's load the extension and configure it to allow for persisting vector
indexes:

```python
conn.load_extension("vss")
conn.execute("set hnsw_enable_experimental_persistence = true")
```

From there, let's create the index:

```python
conn.execute(
    """
    create index entries_vec_index on embeddings
    using hnsw(vec)
    with (metric = 'cosine');
"""
)
```

Finally, we can commit the transaction:

```python
conn.execute("commit")
```

Update: With the version of DuckDB (v1.0.0 1f98600c2c) I used at the time of
writing this post, the index doesn't get picked up by the query planner for some
reason, probably a bug, so this step can be discarded. For further discussion on
this, please check [my post](/p/vss-duckdb-caveats) particularly the section on
cosine similarity.

## Vector Search

With the index in place, we can now carry out vector similarity search quite
efficiently:

```python
search_term = "postgres performance monitoring"

query_embedding = list(model.query_embed(search_term))[0]

search_results = conn.execute(
    f"""
    select
        title
    from entries e
    join embeddings em on e.id = em.entry_id
    order  by array_cosine_similarity(vec, $1::FLOAT[{dimension}]) desc
    limit 10
   """,
    [query_embedding],
)

for v in search_results.fetchall():
    print(v)
```

I'm tempted to also make they query embedding a UDF too but for now, this will
do.
