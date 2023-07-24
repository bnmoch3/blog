# Wrangling JSON with DuckDB

## References/Further Reading

- [Shredding Deeply Nested JSON, One Vector at a Time](https://duckdb.org/2023/03/03/json.html)

## Setting up the data

### Ingesting from CSV using pyarrow

Let's insert the events data into the databases, I'll be using pyarrow's CSV
module:

```python
import duckdb
import pyarrow as pa
import pyarrow.csv as csv

conn = duckdb.connect("events.db")
opts = csv.ReadOptions(
    column_names=[
        "event_id",
        "event_type",
        "event_public",
        "repo_id",
        "payload",
        "repo",
        "user_id",
        "org",
        "created_at",
    ]
)
events_csv = csv.read_csv("datasets/gh-events.csv", read_options=opts)
conn.sql("create table events as select * from events_csv")
```

Here's the schema we get:

```
describe events;

┌──────────────┬─────────────┬─────────┬─────────┬─────────┬───────┐
│ column_name  │ column_type │  null   │   key   │ default │ extra │
│   varchar    │   varchar   │ varchar │ varchar │ varchar │ int32 │
├──────────────┼─────────────┼─────────┼─────────┼─────────┼───────┤
│ event_id     │ BIGINT      │ YES     │         │         │       │
│ event_type   │ VARCHAR     │ YES     │         │         │       │
│ event_public │ VARCHAR     │ YES     │         │         │       │
│ repo_id      │ BIGINT      │ YES     │         │         │       │
│ payload      │ VARCHAR     │ YES     │         │         │       │
│ repo         │ VARCHAR     │ YES     │         │         │       │
│ user_id      │ BIGINT      │ YES     │         │         │       │
│ org          │ VARCHAR     │ YES     │         │         │       │
│ created_at   │ TIMESTAMP_S │ YES     │         │         │       │
└──────────────┴─────────────┴─────────┴─────────┴─────────┴───────┘
```

### Alternative: DuckDB's CSV ingestion

We could also have used DuckDB's `read_csv_auto`. I used pyarrow out of habit.
For CSV, DuckDB has its advantages over pyarrow's. For example, it's able to
detect that `event_public` is boolean and empty strings in `org` are null.

```sql
create table events as
select * from read_csv_auto('datasets/gh-events.csv');
```

### Handling low-cardinality string columns

`event_type` has low-cardinality:

```sql
select count(distinct event_type) from events;

-- 14
```

Let's convert it into an enum counting on DuckDB's feature for casting enums to
varchar whenever necessary.

```sql
begin;

create type EVENT_TYPE as enum(
    select distinct event_type from events);

alter table events
    alter column event_type
    set data type EVENT_TYPE;

commit;
```

### Boolean values

`event_public` column should be boolean instead of varchar, since it consists of
't' and 'f' values:

```sql
alter table events
    alter event_public set data type BOOLEAN;
```

No need to wrap this within a transaction since all the necessary changes can be
done within a single statement.

## Checking that JSON is valid

DuckDB provides the `json_valid` to check if values are valid json. Given that
`org`, `repo` and `payload` should be json columns, let's check how many values
are in fact valid json:

```sql
pivot (
    select
        'repo_invalid' as col,
        count(*) as c
    from events
    where json_valid(repo) <> True

    union all

    select
        'payload_invalid' as col,
        count(*) as c
    from events
    where json_valid(payload) <> True

    union all

    select
        'org_invalid' as col,
        count(*) as c
    from events
    where json_valid(org) <> True
)
on col using first(c)
```

This results in:

```
┌─────────────┬─────────────────┬──────────────┐
│ org_invalid │ payload_invalid │ repo_invalid │
│    int64    │      int64      │    int64     │
├─────────────┼─────────────────┼──────────────┤
│       89272 │               0 │            0 │
└─────────────┴─────────────────┴──────────────┘
```

It seems `org` has a couple of non-json values. Let's get a sample:

```sql
select org
from events
where json_valid(org) <> True
using sample 5 rows;
```

This gives:

```
┌─────────┐
│   org   │
│ varchar │
├─────────┤
│         │
│         │
│         │
│         │
└─────────┘
```

Seems either there's a lot of empty strings, whitespace or newlines I'm not
quite sure.

Let's get rid of the whitespace (replace with empty strings):

```sql
update events
    set org = trim(org)
    where json_valid(org) <> True;
```

Next, let's set all the empty strings to NULL:

```sql
update events
    set org=NULL
    where org = '';

select count(*) from events where org is NULL; -- 89272
```

## JSON data type

DuckDB provides a JSON logical type. Given that `org`, `repo` and `payload` are
`VARCHAR`, converting them to JSON does not alter them as per the docs, all that
happens is they're parsed and validated.

Still, let's convert them to JSON, it doesn't hurt.

Ideally, I'd love to use this `alter` statement, but as of v0.8.1 it does not
work:

```sql
alter table events
    alter column repo set data type JSON using json(repo);
```

So we have to use this 'workaround':

```sql
begin;

alter table events add column temp JSON;
update events set temp = json(repo);
alter table events drop repo;
alter table events rename temp to repo;

commit;
```

Rinse and repeat for the `payload` and `org` columns.
