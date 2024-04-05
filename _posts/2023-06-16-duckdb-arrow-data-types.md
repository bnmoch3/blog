---
layout: post
title:  "Programmatically creating a DuckDB table from an Arrow schema"
slug: duckdb-arrow-data-types
tag: ["duckdb", "arrow", "sql", "python"]
categories: "DuckDB Python"
excerpt_separator: <!--start-->
---

PyArrow lets you create an empty table. Use that instead of custom mappings to
create a DuckDB schema.

<!--start-->

DuckDB's python client already provides a straightforward API for interacting
with Arrow tables & record batches. For example, one can
[create and populate a table from Arrow](https://duckdb.org/docs/guides/python/import_arrow)
in one command without even having to define the SQL schema:

```python
import pyarrow as pa
import duckdb


data = [
    pa.array(["alice", "bob", "eve"]),
    pa.array([20, 22, 25]),
]
batch = pa.RecordBatch.from_arrays(data, ["name", "age"])
arrow_table = pa.Table.from_batches([batch])

duckdb.sql("create table if not exists users as select * from arrow_table")

duckdb.sql("select name, age > 18 as can_drive from users").show()
```

This prints:

```
┌─────────┬───────────┐
│  name   │ can_drive │
│ varchar │  boolean  │
├─────────┼───────────┤
│ alice   │ true      │
│ bob     │ true      │
│ eve     │ true      │
└─────────┴───────────┘
```

However, what if you only have the arrow schema definition but no data yet? The
simplest solution is to create an empty arrow table or record batch and then
feed it into DuckDB

```python
schema = pa.schema(
    [
        pa.field("name", pa.string(), nullable=False),
        pa.field("age", pa.uint8(), nullable=False),
    ]
)

arrow_table = schema.empty_table()

duckdb.sql("create table if not exists users as select * from arrow_table")

duckdb.sql("describe users").show()
```

This prints:

```
┌─────────────┬─────────────┬─────────┬─────────┬─────────┬───────┐
│ column_name │ column_type │  null   │   key   │ default │ extra │
│   varchar   │   varchar   │ varchar │ varchar │ varchar │ int32 │
├─────────────┼─────────────┼─────────┼─────────┼─────────┼───────┤
│ name        │ VARCHAR     │ YES     │ NULL    │ NULL    │  NULL │
│ age         │ UTINYINT    │ YES     │ NULL    │ NULL    │  NULL │
└─────────────┴─────────────┴─────────┴─────────┴─────────┴───────┘
```

The `not NULL` constraints will have to be added explicitly.

DuckDB's Python API does provide Python
[data types](https://duckdb.org/docs/api/python/types) that map directly to its
SQL types. So in theory you could do a `arrow field` -> name + `DuckDBPyType` ->
SQL DDL statement:

```
import pyarrow as pa
import duckdb

arrow_to_duckdb_types = {
    pa.bool_(): duckdb.typing.BOOLEAN,
    pa.uint8(): duckdb.typing.UTINYINT,
    pa.string(): duckdb.typing.VARCHAR,
}


def sql_columns(schema):
    for name in schema.names:
        t = schema.field(name).type
        r = arrow_to_duckdb_types[t]
        sql_fragment = f"{name} {r}"
        yield sql_fragment


table_name = "users"
ddl = f"create table {table_name} (" + ",".join(sql_columns(schema)) + ");"
duckdb.sql(ddl)
```

But this is error-prone plus you have to maintain the mapping yourself.
Therefore it's better to stick to the empty arrow table/record batch approach.
