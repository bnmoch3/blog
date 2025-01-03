+++
title = "Timeseries and ASOF Joins"
date = "2024-11-29"
summary = "Pairing up timeseries data when the timestamps don't match exactly (in Pandas, Polars, DuckDB, Postgres & QuestDB)"
tags = ["Timeseries", "SQL", "Python", "PostgreSQL", "DuckDB"]
type = "post"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "sql-asof-joins"
+++

## Overview

An ASOF join is a kind of join that matches rows from one table with the
_closest_ row from another table per a given column (usually timestamps or date
values). It's necessary since related events might not happen exactly at the
same time or be recorded with the same timestamp (different clocks used), or
even sampled at the same rate. But in order to get full context, we need to pair
them up for further upstream processing and analysis.

For example, metrics might be scraped at a given rate but the logs being
generated are more bursty and dependent on external events. We might then want
to pair up a log entry with the closest metrics for that node that were captured
right before the log was emitted.

The most common form of asof joins is the left outer variety whereby only rows
that are less than or equal to a given row on the right are considered. To
phrase it differently, match an event on the left with one on the right that
happened either exactly at the same time or just before. If we don't get a
match, we fill in NULLS (left join).

This post is partly an overview of how different databases/libraries present
asof joins, and also a tour of importing Apache Arrow-based data into these
systems (from zero-copy to good old-fashioned CSV).

## Setting up the data

Alright, let's start with some data to play around with. This demo data is
sourced from
[QuestDB's documentation](https://questdb.io/docs/reference/sql/join/#asof-join),
specifically the section on asof joins. It consists of bids and asks for a
single instrument (just to keep things simple).

```python
bids = [
    ("2019-10-17T00:00:00.000000Z", 100),
    ("2019-10-17T00:00:00.100000Z", 101),
    ("2019-10-17T00:00:00.300000Z", 102),
    ("2019-10-17T00:00:00.500000Z", 103),
    ("2019-10-17T00:00:00.600000Z", 104),
]

asks = [
    ("2019-10-17T00:00:00.100000Z", 100),
    ("2019-10-17T00:00:00.300000Z", 101),
    ("2019-10-17T00:00:00.400000Z", 102),
]
```

Next, let's convert the lists into Arrow Tables since it makes it easier to
interface with most of systems I'll be using to run asof joins.

```python
import datetime as dt
import pyarrow as pa

schema = pa.schema(
    [
        pa.field("ts", pa.timestamp("us", tz="UTC"), nullable=False),
        pa.field("size", pa.uint64(), nullable=False),
    ]
)

to_batch = lambda entries, schema: pa.record_batch(
    [
        pa.array((t[i] for t in entries), type=t)
        for i, t in enumerate(schema.types)
    ],
    schema=schema,
)

to_arrow_table = lambda entries, schema: pa.Table.from_batches(
    [to_batch(entries, schema)]
)

parse_ts = lambda ts: dt.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%fZ")

with_timestamps_parsed = lambda rows: ((parse_ts(ts), n) for (ts, n) in rows)

asks = to_arrow_table(list(with_timestamps_parsed(asks)), schema)
bids = to_arrow_table(list(with_timestamps_parsed(bids)), schema)
```

A couple of details worth noting:

- the generator objects have to be list-ified before being passed to
  `to_arrow_table` since they'll be be iterated over several times for each
  column.
- the timestamps are in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)
  format with a fractional component for the seconds and timezone data (the Z
  means its UTC i.e. Zero offset from UTC)
- Python's `dt.datetime.strptime` seems to discard the timezone info. Not a big
  issue in this case, yet.
- It would have been more efficient to parse the timestamp strings using
  [`pyarrow.compute.strptime`](https://arrow.apache.org/docs/python/generated/pyarrow.compute.strptime.html)
  but it doesn't support fractional seconds. Check this
  [github issue](https://github.com/apache/arrow/issues/20146) for more details.

With the data all set up, let's do some querying:

## DuckDB

Querying an Arrow table from DuckDB is quite easy: as long as the table is in
scope, DuckDB's Python client will pick it up automatically. Just to be a bit
little fancy, I've added the Arrow tables as views.

```
import duckdb

duckdb.sql(
    """
    create view asks as select ts at time zone 'UTC' as ts, size from asks_tbl;
    create view bids as select ts at time zone 'UTC' as ts, size from bids_tbl;
    """
)
duckdb.sql(
    """
    select
        b.ts as ts_bid,
        a.ts as ts_ask,
        b.size as bid,
        a.size as ask
    from bids b
    asof left join asks a on b.ts >= a.ts
    order by ts_bid asc
    """
).show()
```

As expected, this outputs:

```
┌───────────────────────┬───────────────────────┬────────┬────────┐
│        ts_bid         │        ts_ask         │  bid   │  ask   │
│       timestamp       │       timestamp       │ uint64 │ uint64 │
├───────────────────────┼───────────────────────┼────────┼────────┤
│ 2019-10-17 00:00:00   │ NULL                  │    100 │   NULL │
│ 2019-10-17 00:00:00.1 │ 2019-10-17 00:00:00.1 │    101 │    100 │
│ 2019-10-17 00:00:00.3 │ 2019-10-17 00:00:00.3 │    102 │    101 │
│ 2019-10-17 00:00:00.5 │ 2019-10-17 00:00:00.4 │    103 │    102 │
│ 2019-10-17 00:00:00.6 │ 2019-10-17 00:00:00.4 │    104 │    102 │
└───────────────────────┴───────────────────────┴────────┴────────┘
```

Since I borrowed the data and query from QuestDB, I'll also add the explanation
they included in their
[docs](https://questdb.io/docs/reference/sql/join/#asof-join):

> The result has all rows from the bids table joined with rows from the asks
> table. For each timestamp from the bids table, the query looks for a timestamp
> that is equal or prior to it from the asks table. If no matching timestamp is
> found, NULL is inserted.

For this section, I'm including both the `ts_bid` and `ts_ask` columns so that
you see that not all matches are 'exact'. For later examples the `ts_ask` column
is dropped.

## Pandas

It seems a lot of folks in the financial field favour dataframe-based
data-analysis over SQL. And Pandas, being one of the most used dataframe
library, does provide Asof joins via the `merge_asof` function:

```python
import pandas as pd

asks_df = asks_tbl.to_pandas()
bids_df = bids_tbl.to_pandas()

res = pd.merge_asof(
    bids_df,
    asks_df,
    on="ts",
    direction="backward",
    tolerance=pd.Timedelta("1s"),
)
print(res)
```

This prints:

```
                                ts  size_x  size_y
0        2019-10-17 00:00:00+00:00     100     NaN
1 2019-10-17 00:00:00.100000+00:00     101   100.0
2 2019-10-17 00:00:00.300000+00:00     102   101.0
3 2019-10-17 00:00:00.500000+00:00     103   102.0
4 2019-10-17 00:00:00.600000+00:00     104   102.0
```

A couple of details worth pointing out:

- Converting an Arrow table into a pandas dataframe is rather straight-forward.
  However, there are a couple of peculiarities to keep in mind given the data
  representation that Pandas uses. See
  [the Pandas Integration section](https://arrow.apache.org/docs/python/pandas.html)
  of the pyarrow docs.
- The timestamp fields must be sorted prior to `merge_asof`
- Pandas allows not just for "backwards" direction when getting the closest
  matches, but also for "forward" and "nearest" (closest absolute distance
  regardless of direction) directions.
- Pandas allows for tolerance (max range beyond which matches are left out). For
  example, if we set the tolerance to 1 millisecond (`pd.Timedelta("1ms")`),
  only the 2nd and third bids are paired with an ask:

```
                                ts  size_x  size_y
0        2019-10-17 00:00:00+00:00     100     NaN
1 2019-10-17 00:00:00.100000+00:00     101   100.0
2 2019-10-17 00:00:00.300000+00:00     102   101.0
3 2019-10-17 00:00:00.500000+00:00     103     NaN
4 2019-10-17 00:00:00.600000+00:00     104     NaN
```

## Polars

Polars is meant to be a faster alternative to Pandas (with IMO, a saner API). So
naturally, it too provides Asof joins:

```python
import polars as pl

asks_df = pl.from_arrow(asks_tbl).set_sorted("ts")
bids_df = pl.from_arrow(bids_tbl).set_sorted("ts")

res = bids_df.join_asof(
    asks_df,
    on="ts",
    strategy="backward",
    tolerance="1s",
).rename({"size": "bid", "size_right": "ask"})

print(res)
```

This outputs:

```
shape: (5, 3)
┌─────────────────────────────┬─────┬──────┐
│ ts                          ┆ bid ┆ ask  │
│ ---                         ┆ --- ┆ ---  │
│ datetime[μs, UTC]           ┆ u64 ┆ u64  │
╞═════════════════════════════╪═════╪══════╡
│ 2019-10-17 00:00:00 UTC     ┆ 100 ┆ null │
│ 2019-10-17 00:00:00.100 UTC ┆ 101 ┆ 100  │
│ 2019-10-17 00:00:00.300 UTC ┆ 102 ┆ 101  │
│ 2019-10-17 00:00:00.500 UTC ┆ 103 ┆ 102  │
│ 2019-10-17 00:00:00.600 UTC ┆ 104 ┆ 102  │
└─────────────────────────────┴─────┴──────┘
```

With regards to Polars:

- We have to indicate that the dataframes are sorted plus the column by which
  they are sorted (or sort them if they weren't). Otherwise Polars won't perform
  the asof join.
- Just like with Pandas, we can specify the strategy/direction and tolerance
- There are additional knobs for parallel query execution
- Arrow to Polars is zero-copy (for almost all data-types).
- As an aside, DuckDB provides direct and zero-copy output to Polars dataframes
  so we can use the view set up earlier to create dataframes. For details, see
  [this section](https://duckdb.org/docs/guides/python/polars) of the DuckDB
  docs.

## QuestDB

Back to QuestDB since this is where I first learned of ASOF joins. QuestDB is a
'Columnar time-series database with high performance ingestion and SQL
analytics'. More details can be found on its
[product page](https://questdb.io/).

So far, while everything has been within the same process, interaction with
QuestDB has to be over a network.

QuestDB supports various formats for ingesting data but its mostly optimized
for, (in terms of speed and convenience), 'live' tuple/row/event ingestion vs.
data-warehouse style bulk ingestion. I thought it would have a means for
ingesting Arrow record batches by now since iirc I saw some of their lead devs
discussing it but as of version 7.2, it only supports CSV. It's worth pointing
out that CSV is fraught with problems, it's easy to generate and easy to inspect
and modify via simple string manipulation, any text editor and CLI tools, but
that's where its advantages end. See
[The Absurdly Underestimated Dangers of CSV Injection](http://georgemauer.net/2017/10/07/csv-injection.html)
and
[Why You Don’t Want to Use CSV Files](https://haveagreatdata.com/posts/why-you-dont-want-to-use-csv-files/).

Okay then, let's (begrudgingly) insert the data using CSV:

```python
quest_db_schema = json.dumps(
    [
        {
            "name": "ts",
            "type": "TIMESTAMP",
            "pattern": "yyyy-MM-dd HH:mm:ss.U+Z",
        },
        {
            "name": "size",
            "type": "INT",
        },
    ]
)

params = urllib.parse.urlencode(
    {
        "atomicy": "abort",
        "durable": "true",
        "fmt": "json",  # get response as json
        "forceHeader": "true",
        "timestamp": "ts",
    }
)

host = "http://localhost:9000"
ingest_endpoint = f"{host}/imp?" + params

def send_csv_to_questdb(table, table_name):
    options = csv.WriteOptions(include_header=True)
    with io.BytesIO() as buf:
        csv.write_csv(table, buf, options)
        buf.seek(0)
        res = requests.post(
            ingest_endpoint,
            files={
                "schema": quest_db_schema,
                "data": (table_name, buf),
            },
        )
        return res

send_csv_to_questdb(asks_tbl, "asks")
send_csv_to_questdb(bids_tbl, "bids")
```

Now for the fun part, querying:

```
select bids.ts ts, bids.size as bid, asks.size as ask
from bids
asof join asks;
```

With psql, this is what I get as the output (as expected):

```
           ts               │ bid │ ask
════════════════════════════╪═════╪═════
 2019-10-17 00:00:00.000000 │ 100 │   ¤
 2019-10-17 00:00:00.100000 │ 101 │ 100
 2019-10-17 00:00:00.300000 │ 102 │ 101
 2019-10-17 00:00:00.500000 │ 103 │ 102
 2019-10-17 00:00:00.600000 │ 104 │ 102
(5 rows)
```

Notes:

- Given that QuestDB is all about timeseries data, I have to define the
  [designated timestamp column](https://questdb.io/docs/concept/designated-timestamp/).
  I can do it during query time but defining it when creating the table is more
  efficient and makes querying simpler (I don't have to specify the timestamp
  columns for the asof join). All the rows for the table table will then have to
  be sorted by the designated timestamp column.
- I've set the `atomicity` parameter to `abort` so that in case there are any
  errors in the data, QuestDB can forgo ingesting the entire csv rather than
  skipping the erroneous rows (which is the default behaviour).
- I probably should set `durable` parameter to `true` but it's overkill for this
  demo.
- Since I'm explicitly providing a header for the CSV, I might as well set
  `forceHeader` to `true` rather than let QuestDB infer it
- The `io.BytesIO()` fanfare is all to avoid having to write to disk then read
  the CSV back. The data isn't that huge, it can be kept entirely in memory.

QuestDB does provide other similar kinds of joins:

- `LT join`: Similar to ASOF but the timestamps from the right table that are
  matched have to be strictly less than those from the left table: equal
  timestamps are not considered.
- `SPLICE join`: If you consider an ASOF join as a left outer join, SPLICE is
  the full outer join equivalent.

## PostgreSQL

Lastly, we've got PostgreSQL. Unlike previous systems, Postgres doesn't have a
dedicated syntax/API for ASOF joins. But that doesn't mean it can't perform such
queries:

As usual, let's start by importing the data. Just like QuestDB, we have to do so
via CSV:

```python
import io

import psycopg2
import pyarrow.csv as csv

def send_csv_to_pg(cur, to_pg_table: str, from_arrow_table):
    options = csv.WriteOptions(include_header=False, delimiter="\t")
    with io.BytesIO() as buf:
        csv.write_csv(from_arrow_table, buf, options)
        buf.seek(0)
        cur.copy_from(buf, to_pg_table, sep="\t", columns=["ts", "size"])

with psycopg2.connect(dsn) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            create table asks( ts timestamptz not null, size int not null);
            create table bids( ts timestamptz not null, size int not null);
            """
        )
        send_csv_to_pg(cur, "asks", asks_tbl)
        send_csv_to_pg(cur, "bids", bids_tbl)
```

For querying, we could use a [left lateral join](/p/sql-lateral-joins):

```sql
select
    b.ts ts, b.size as bid, a.size as ask
from bids b
left join lateral (
    select a.size
    from asks a
    where b.ts >= a.ts
    order by a.ts desc
    limit 1
) as a on true
order by b.ts asc
```

Or we could use a correlated subquery (see Timescale's
[Implementing ASOF Joins in PostgreSQL and Timescale](https://www.timescale.com/blog/implementing-asof-joins-in-timescale/)
from where I got the idea, and as a bonus, Justin Jaffray's
[JOIN: The Ultimate Projection](https://justinjaffray.com/join-the-ultimate-projection/)
on how DBs _can_ decorrelate subqueries):

```
select
    b.ts ts,
    b.size as bid,
    (
        select a.size
        from asks a
        where b.ts >= a.ts
        order by a.ts desc
        limit 1
    ) as ask
from bids b
order by b.ts asc
```

Both versions give the same output, though the query plans might be different.
Also, we'll probably have to add some indexing for larger datasets: Pandas,
Polars and QuestDB do rely on the entries being sorted by their timestamps to
speed up processing asof joins.

```
            ts            │ bid │ ask
══════════════════════════╪═════╪═════
 2019-10-17 00:00:00+00   │ 100 │   ¤
 2019-10-17 00:00:00.1+00 │ 101 │ 100
 2019-10-17 00:00:00.3+00 │ 102 │ 101
 2019-10-17 00:00:00.5+00 │ 103 │ 102
 2019-10-17 00:00:00.6+00 │ 104 │ 102
(5 rows)
```

We can also use the flexibility of PG's (and DuckDB's) SQL to implement the
threshold and direction parameters that Pandas and Polars had. For example, to
do an asof with "nearest" direction and within a threshold of 10 milliseconds:

```sql
select
    b.ts ts,
    b.size as bid,
    a.size as ask
from bids b
left join lateral (
    select
        a.size,
        case
            when a.ts > b.ts then a.ts - b.ts
            else b.ts - a.ts
        end as threshold
    from asks a
    order by threshold asc
    limit 1
) as a on threshold <= '10 milliseconds'
order by b.ts asc
```

## Notable mentions

There are other systems that implement ASOF joins (e.g.
[Clickhouse](https://clickhouse.com/docs/en/sql-reference/statements/select/join#asof-join-usage)
and [QuasarDB](https://blog.quasar.ai/timeseries-what-are-asof-joins)) but even
if they don't, if they've got SQL, you can always use subqueries and/or lateral
joins to do the same. I'm particularly interested in Clickhouse, I just haven't
had a good reason to use it yet beyond curiosity; every dataset I've worked with
so far is DuckDB/SQLite sized. In future, I'd also love to go over the query
plans and optimizations made by DuckDB, Postgres and Timescale when evaluating
asof-style joins for larger datasets.

## References/Further Reading

- [DuckDB ASOF Join](https://duckdb.org/docs/guides/sql_features/asof_join.html)
- [QuestDB ASOF JOIN](https://questdb.io/docs/reference/sql/join/#asof-join)
- [Pandas merge_asof API documentation](https://pandas.pydata.org/docs/reference/api/pandas.merge_asof.html)
- [The hidden rules of pandas.merge_asof() - Angwalt](https://angwalt12.medium.com/the-hidden-rules-of-pandas-merge-asof-e67293a5318e)
- [polars.DataFrame.join_asof](https://pola-rs.github.io/polars/py-polars/html/reference/dataframe/api/polars.DataFrame.join_asof.html)
- [A Practical Comparison of Polars and Pandas - Florian Wilhelm](https://florianwilhelm.info/2021/05/polars_pandas_comparison_notebook/)
- [Implementing ASOF Joins in PostgreSQL and Timescale - James Blackwood-Sewell,
  Kirk Laurence Roybal](https://www.timescale.com/blog/implementing-asof-joins-in-timescale/)
- [All Data is Time-Series Data (With Examples) - Ajay Kulkarni, Ryan Booz,
  Attilla Toth](https://www.timescale.com/blog/time-series-data/)
- [[RFC] ASOF Join - Alexander Kuzmenkov - pgsql-hackers mailing list](https://www.postgresql.org/message-id/CALzhyqwuVz0FJZ-oCYQ9d%2ByrPrbF5a9HDyAjxuSUdgq8n7nshQ%40mail.gmail.com)
