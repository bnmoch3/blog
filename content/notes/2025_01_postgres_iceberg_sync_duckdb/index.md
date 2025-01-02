+++
title = "PostgreSQL to Iceberg Snapshot Sync (Using DuckDB)"
date = "2025-01-02"
summary = "Query PG using DuckDB, copy table data into iceberg"
tags = ["PostgreSQL", "DuckDB"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = true
slug = "postgres-iceberg-sync-duckdb"
+++

Why sync from Postgres to Iceberg: you want an analytics optimized snapshot of
your data to carry out OLAP-style queries on. This can be accomplished using
DuckDB plus a bit of glue code. Specifically, this post relies on the following
key features of DuckDB:

- DuckDB's ability to query and read data directly from Postgres via the
  [PostgreSQL Extension](https://duckdb.org/docs/extensions/postgres.html)
- DuckDB's ability to output Arrow data efficiently (see
  [DuckDB Quacks Arrow: A Zero-copy Data Integration between Apache Arrow and DuckDB](https://duckdb.org/2021/12/03/duck-arrow.html))

I'll also use Python and PyIceberg. For the iceberg catalog, I'll use sqlite.
Let's get right to it.

First, let's set up the catalog:

```python
import os

from pyiceberg.catalog.sql import SqlCatalog

warehouse_path = os.path.abspath("./warehouse")
os.makedirs(warehouse_path, exist_ok=True)

os.makedirs(warehouse_path, exist_ok=True)
catalog = SqlCatalog(
    "default",
    **{
        "uri": f"sqlite:///{warehouse_path}/catalog.db",
        "warehouse": f"file://{warehouse_path}",
    },
)
```

Next, let's set up duckdb and connect it to postgres:

```python
import duckdb

conn = duckdb.connect(":memory:")
db_name = os.getenv("PG_DATABASE")
pg = {
    "database": db_name,
    "user": os.getenv("PG_USER")
    "password": os.getenv("PG_PASSWORD"),
    "host": os.getenv("PG_HOST")
    "port": os.getenv("PG_PORT")
}

conn.execute("install postgres")
conn.execute("load postgres")
conn.execute(
    """attach 'host={} port={} dbname={} user={} password={}'
    as {} (type postgres, read_only)
    """.format(
        pg["host"],
        pg["port"],
        pg["database"],
        pg["user"],
        pg["password"],
        db_name,
    )
)
```

Let's retrieve the schemas in Postgres plus the tables within those schemas:

- we're using `postgres_query` which is a duckdb function that runs the query
  it's supplied with directly in postgres. Single quote strings have to be
  escaped by repeating the single quote twice
- in postgres, we can get the list of schemas via querying the
  `information_schema.schemata` view, e.g.
  `select * from information_schema.schemata`
- `pg_catalog`, `pg_toast`, `information_schema` are schemas internal to
  postgres that we need to filter out
- once we have a schema name, we can get the tables within that schema via
  querying the `pg_tables` system view

```python
# get schemas
pg_query = """
select schema_name
from information_schema.schemata
where schema_name not in (''pg_catalog'', ''pg_toast'', ''information_schema'')
 """
res = conn.sql(f"select * from postgres_query('{db_name}', '{pg_query}')")
schema_to_tables = {r[0]: [] for r in res.fetchall()}
for s in schema_to_tables:
    res = conn.sql(
        f"""
    select * from postgres_query('{db_name}',
        'select tablename from pg_tables where schemaname=''{s}''')"""
    )
    schema_to_tables[s] = [r[0] for r in res.fetchall()]
```

Finally, let's sync from Postgres to Iceberg. Note that the sync's being carried
out within a transaction:

```python
with conn.begin() as tx:
    for schema, tables in schema_to_tables.items():
        catalog.create_namespace(schema)
        for tbl_name in tables:
            full_tbl_name = f"{schema}.{tbl_name}"
            df = tx.sql(f"table {db_name}.{full_tbl_name}").arrow()
            print(df)
            table = catalog.create_table(full_tbl_name, schema=df.schema)
            table.append(df)
    tx.commit()
```
