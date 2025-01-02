+++
title = "Archiving Time-Series Data from PostgreSQL into Parquet"
date = "2024-11-15"
summary = "Keeping your database lean"
tags = ["Timeseries", "PostgreSQL"]
type = "post"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "pg-parquet-archive-timeseries"
+++

With time-series and real-time analytics, we usually query recent data rather
than _all_ the data at a go. This means we don't have to index or even store
_all_ the data in the online/main database. Instead, we can retain let's say
data from the past 30 days and archive the rest to remote storage and only query
it when needed.

In this post I will be going over some approaches for archiving timeseries data
from Postgres. The archival file format I'll be using is parquet due to its
ubiquity in the big-data analytics space. I have reviewed the compression
advantages of parquet in a previous blog post
([Parquet + Zstd: Smaller faster data formats](/blog/parquet-zstd)) if you're
interested. Also, as a bonus, I'll show how you can query across both recent
data and archived data.

## Setup

First, let's set up the database plus some test data. Here's the main table:

```sql
create table iot_data(
    device_id varchar,
    ts timestamptz,
    value real
);
```

As for the entries, we'll generate 4 days worth of data. The folks at timescale
have a great series on generating synthetic timeseries data
([link here](https://www.timescale.com/blog/how-to-create-lots-of-sample-time-series-data-with-postgresql-generate_series/)) -
I borrowed some techniques from them customizing it a bit so I can quickly
eyeball any mistakes I make in my queries solely by looking at the output:

```sql
insert into iot_data(device_id, ts, value)
select
    'dev-'|| d as device_id,
    ts,
    (30 * (extract(isodow from ts)  - 1) + 10) + ((d-1) * 10) + random() as value
from
    generate_series(
        date(now()) - '4 days'::interval,
        date(now()) - '1 second'::interval,
        '1 second'::interval
    ) ts,
    generate_series(1,3) d
order by ts asc, device_id asc;
```

Let's now archive some data:

## Any Language + Postgres Client + Parquet Writer

The most basic approach is to use a language of our choice, connect to Postgres
via a client library, read the data that we want to archive then write it to a
parquet file. If the data fits into memory, we can read it all in one go,
otherwise, we'll have to read it row-by-row as we write.

This approach is the most flexible since we can use the languages and tooling
we're most comfortable with as long as there are Postgres client and parquet
libraries for that language.

Here's a demonstration of the approach using Go (credits to @johnonline35 for
[pg-archiver](https://github.com/johnonline35/pg-archiver/tree/main) which also
served as the inspiration for this post). For the client library, I'll be using
@jackc's [pgx](https://github.com/jackc/pgx) library and for the parquet
library, I'll be using @xtongsys's
[parquet-go](https://github.com/xitongsys/parquet-go/tree/master) library. I'll
also assume that the data doesn't fit in memory so I'll be writing it row by
row.

First, let's read the data from Postgres:

```go
type iotEntry struct {
	deviceID  string
	timestamp time.Time
	value     float32
}

func readRows(ctx context.Context, date time.Time, onRow func(*iotEntry) error) error {
	conn, err := pgx.Connect(ctx, os.Getenv("PG_URL"))
	if err != nil {
		return fmt.Errorf("unable to connect to db: %w\n", err)
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `
        select device_id, ts, value
        from iot_data
        where
            ts >= $1 and
            ts < $1 + '1 day'::interval
        `, date)
	if err != nil {
		return fmt.Errorf("QueryRow failed: %w\n", err)
	}
	defer rows.Close()
	var e iotEntry
	_, err = pgx.ForEachRow(rows, []any{&e.deviceID, &e.timestamp, &e.value}, func() error {
		return onRow(&e)
	})
	if err != nil {
		return fmt.Errorf("read rows failed: %w\n", err)
	}
	return nil
}
```

The above function takes in a `date` parameter since we'll be archiving data
day-by-day. There is also an `onRow` callback that will be called for each row
retrieved. This give the caller the option to buffer all the rows before writing
to parquet or chunk-by-chunk or even row-by-row. We could make the `readRows`
more ergonomic by having it return an iterator but this will do for now.

At the caller (for `readRows`) the parquet writer is set up as follows:

```go
func run() error {
	ctx := context.Background()
	dateString := "2024-11-12"
	date, err := time.Parse("2006-01-02", dateString)
	if err != nil {
		return err
	}
	filename := fmt.Sprintf("output/iot_data_%s.parquet", dateString)
	fw, err := local.NewLocalFileWriter(filename)
	if err != nil {
		return fmt.Errorf("on create local file writer: %w\n", err)
	}
	pw, err := writer.NewParquetWriter(fw, new(ParquetFile), 1)
	if err != nil {
		fw.Close()
		return fmt.Errorf("on create parquet writer: %w\n", err)
	}
	defer fw.Close()
	pw.RowGroupSize = 1024 * 1024
	pw.PageSize = 8 * 1024              //8K
	pw.CompressionType = parquet.CompressionCodec_ZSTD

	err = readRows(ctx, date, func(e *iotEntry) error {
		return pw.Write(e.ToParquet())
	})
	if err != nil {
		return err
	}
	if err = pw.WriteStop(); err != nil {
		return fmt.Errorf("close parquet writer: %w\n", err)
	}
	if err = fw.Close(); err != nil {
		return fmt.Errorf("close file: %w\n", err)
	}
	return nil
}
```

In the above snippet, here's where we're writing to the parquet file:

```go
err = readRows(ctx, date, func(e *iotEntry) error {
	return pw.Write(e.ToParquet())
})
```

One of the most important configuration is `pw.CompressionType` - without
compression, parquet files can be quite large depending on the schema.

We've also got the code for making `iotEntry` writable into a parquet file:

```go
func (e *iotEntry) ToParquet() ParquetFile {
	return ParquetFile{
		DeviceID:  e.deviceID,
		Timestamp: e.timestamp.UnixMicro(),
		Value:     e.value,
	}
}

type ParquetFile struct {
	DeviceID  string  `parquet:"name=device_id, type=BYTE_ARRAY, convertedtype=UTF8, encoding=PLAIN_DICTIONARY"`
	Timestamp int64   `parquet:"name=ts, type=INT64, convertedtype=TIMESTAMP_MICROS"`
	Value     float32 `parquet:"name=value, type=FLOAT"`
}
```

Notice the `encoding=PLAIN_DICTIONARY` configuration we've got above for
`DeviceID`. The cardinality of that field is 3 (we're only tracking 3 devices).
Therefore it's more space efficient to dictionary encode the device ID strings
plus database and dataframe engines that can take advantage (of the encoding)
process queries hitting that field faster.

On to the next approach.

## ConnectorX - Faster Data Loading from Databases into Dataframes

This 2nd approach for archival is similar to the first but we'll be using
[ConnectorX](https://github.com/sfu-db/connector-x) - a library born out of a
research project for accelerating data loading from DBs into dataframes. The
library is only available for Python and Rust, let's use Python for brevity's
sake after all that Golang verbosity:

```python
import os
import connectorx as cx
import polars as pl

pg_url = os.environ["PG_URL"]
date = "2024-11-12"
data_load_query = """
    select device_id, ts, value
    from iot_data
    where
        ts >= '{0}'::date and
        ts < '{0}'::date + '1 day'::interval
    """.format(date)
df = cx.read_sql(pg_url, data_load_query, return_type="polars")
df.write_parquet(
    f"output/iot_data_{date}.parquet",
    compression="zstd",
    row_group_size=1024 * 1024,
)
```

For the dataframe library, I've opted for Polars since it ships with an in-built
parquet writer. A couple of details worth noting: I used string composition
instead of a parameterized query since I couldn't figure out how to pass
parameters via ConnectorX - probably it doesn't support this feature yet or it
hasn't been documented so watch out for SQL injection! That aside, ConnectorX
offers the `partition_on` and `partition_num` options which lets us do parallel
data loading and should be faster in theory. However, it currently only supports
partitioning on numerical non-null columns. Once support for timestamp columns
is added, loading timeseries data should be faster.

## DuckDB

There's also DuckDB which has in-built support for reading directly from
Postgres
([PostgreSQL Extension](https://duckdb.org/docs/extensions/postgres.html)).
Combining this feature with DuckDB's
[parquet support](https://duckdb.org/docs/data/parquet/overview.html), we get:

```sql
attach 'dbname=db user=user host=localhost'
    as pg (type postgres, read_only);

set variable date = '2024-11-14'::date;

copy (
    select device_id, ts, value
    from pg.public.iot_data
    where
        ts >= getvariable('date') and
        ts < getvariable('date') + '1 day'::interval
)
to 'output/iot_data_2024-11-14.parquet'
(format 'parquet', compression 'zstd', row_group_size 1048576)
```

I like this approach since I only have one dependency to install plus I can use
it across most languages or even via a standalone script in the terminal.

As an aside, we can take advantage of DuckDB's PostgreSQL support to query
across both archived data and recent data that's in Postgres. Let's assume the
recent data starts at '2014-11-15'. From there, we'll create a view that
'unifies' all the data:

```sql
set variable pg_start = '2024-11-15'::date;

create view iot_data_v as (
    -- recent data from postgres
    select device_id, value, ts
    from pg.public.iot_data
    where ts >= getvariable('pg_start')

    union all

    -- archived data
    select device_id, value, ts
    from read_parquet("output/iot_data_*.parquet")
);
```

Note that we're using a wildcard at `read_parquet` above so as that we can read
in all the archived parquet files.

From there, downstream queries can use the view relation, without having to
worry about what's in Postgres and what's in the archive:

```sql
select
    device_id,
    avg(value)
from iot_data_v
group by device_id
```

We do loose timezone information for the `ts` column when archiving to parquet
so when unifying the data into a single view, we'll have to handle the
associated discrepancies that arise.

## PG-Parquet Postgres Extension

For the last archival approach, we've got the
[pg_parquet](https://github.com/CrunchyData/pg_parquet) extension developed by
the CrunchyData folks. Unlike previous methods, this will output the parquet
file at the database server which means we'll have to figure out a way to move
the files into the archival destination (e.g. via scp).

Installing the extension can also be quite convoluted if you haven't played
around with [pgrx](https://github.com/pgcentralfoundation/pgrx) before.

That aside, copying the data into parquet is quite straightforward:

```sql
create extension pg_parquet;

copy (
  select device_id, value, ts
  from iot_data
  where ts >= '2024-11-14'::date
  group by device_id
)
to '/tmp/iot_data_2024-11-14.parquet' (format 'parquet', compression 'zstd')
```

Also worth pointing out, pg_parquet supports writing out directly to S3.

That's all for today.
