---
layout: post
title:  "Hangling missing values in Timeseries datasets"
date:   2023-07-27 12:00:00 +0000
tag: ["duckdb", "sql", "timeseries", "python"]
categories: Python
excerpt_separator: <!--start-->
---

Last observation carried forward, median, linear interpolation, using the median
etc.

<!--start-->

## Overview

There are a couple of strategies that can be used to fill missing numeric values
for timeseries:

- using the last value to fill forwards (Last observation carried forward)
- using the next value to fill backwards
- using an arbitrary expression such as the median
- linear interpolation
- filling in a specific value

Some databases (notably Timescale) avail these strategies natively. For the rest
of the masses, it has to be implemented either through UDFs (user defined
functions) or some hairy SQL. In the case of DuckDB though, it doesn't have to
be too convoluted since we can either use Polars or pyarrow-based UDFs. Let's
explore both methods.

## Some sample data

First, some sample data:

```python
import duckdb

duckdb.sql("create table tbl (dt date, val int)")
duckdb.sql(
    """
    insert into tbl(dt, val) values
    ('1970-01-01', 1    ),
    ('1970-01-02', null ),
    ('1970-01-03', null ),
    ('1970-01-04', null ),
    ('1970-01-05', 5    ),
    ('1970-01-06', null ),
    ('1970-01-07', null ),
    ('1970-01-08', 8    );
    """
)
```

## Using Polars

[Polars](https://github.com/pola-rs/polars) does have methods for filling in
missing data.

Let's use the `.pl()` method on DuckDB's python client to output a Polars method
then fill in the missing values using various strategies:

```python
import polars as pl

df = duckdb.sql("select dt, val from tbl").pl()
missing_vals = pl.col("val")
filled = df.with_columns(
    missing_vals.fill_null(strategy="forward").alias("forward"),
    missing_vals.fill_null(strategy="backward").alias("backward"),
    missing_vals.interpolate().alias("interpolated"),
    missing_vals.fill_null(pl.median("val")).alias("with_median"),
    missing_vals.fill_null(pl.lit(10)).alias("with_literal_val_10"),
)
```

This outputs:

```
┌────────────┬──────┬─────────┬──────────┬──────────────┬─────────────┬─────────────────────┐
│ dt         ┆ val  ┆ forward ┆ backward ┆ interpolated ┆ with_median ┆ with_literal_val_10 │
│ ---        ┆ ---  ┆ ---     ┆ ---      ┆ ---          ┆ ---         ┆ ---                 │
│ date       ┆ i32  ┆ i32     ┆ i32      ┆ i32          ┆ f64         ┆ i32                 │
╞════════════╪══════╪═════════╪══════════╪══════════════╪═════════════╪═════════════════════╡
│ 1970-01-01 ┆ 1    ┆ 1       ┆ 1        ┆ 1            ┆ 1.0         ┆ 1                   │
│ 1970-01-02 ┆ null ┆ 1       ┆ 5        ┆ 2            ┆ 5.0         ┆ 10                  │
│ 1970-01-03 ┆ null ┆ 1       ┆ 5        ┆ 3            ┆ 5.0         ┆ 10                  │
│ 1970-01-04 ┆ null ┆ 1       ┆ 5        ┆ 4            ┆ 5.0         ┆ 10                  │
│ 1970-01-05 ┆ 5    ┆ 5       ┆ 5        ┆ 5            ┆ 5.0         ┆ 5                   │
│ 1970-01-06 ┆ null ┆ 5       ┆ 8        ┆ 6            ┆ 5.0         ┆ 10                  │
│ 1970-01-07 ┆ null ┆ 5       ┆ 8        ┆ 7            ┆ 5.0         ┆ 10                  │
│ 1970-01-08 ┆ 8    ┆ 8       ┆ 8        ┆ 8            ┆ 8.0         ┆ 8                   │
└────────────┴──────┴─────────┴──────────┴──────────────┴─────────────┴─────────────────────┘
```

We can then query the result back within DuckDB:

```python
duckdb.sql(
    """
    select
        regexp_extract(name, 'avg_(\\w+)', 1) as strategy,
        round(avg, 2) as avg
    from (
        unpivot (
        select
            avg(val) as avg_original,
            avg(forward) as avg_forward,
            avg(backward) as avg_backward,
            avg(interpolated) as avg_interpolated,
            avg(with_median) as avg_with_median,
            avg(with_literal_val_10) as avg_with_literal_val_10
        from filled
        ) on columns(*)
        into name name value avg
    )
    """
).show()
```

This gives:

```
┌─────────────────────┬────────┐
│      strategy       │  avg   │
│       varchar       │ double │
├─────────────────────┼────────┤
│ original            │   4.67 │
│ forward             │   3.38 │
│ backward            │   5.63 │
│ interpolated        │    4.5 │
│ with_median         │   4.88 │
│ with_literal_val_10 │    8.0 │
└─────────────────────┴────────┘
```

## Using PyArrow-based UDFs

[Recently](https://duckdb.org/2023/07/07/python-udf.html) DuckDB introduced
arrow-based UDFs. This can be an alternative to using Polars for filling NULL
values:

Let's set up a couple of UDFs:

```python
from duckdb.typing import *

import pyarrow as pa
import pyarrow.compute as pc

# define the UDFs
udfs = [
    ("fill_null_with_0", lambda vals: pc.fill_null(vals, 0)),
    ("fill_null_backward", lambda vals: pc.fill_null_backward(vals)),
    ("fill_null_forward", lambda vals: pc.fill_null_forward(vals)),
    ("fill_null_with_approx_median", lambda vals: pc.fill_null(vals, pc.approximate_median(vals))),
]

# register the UDFs
for (name, udf) in udfs:
    duckdb.create_function(
        name,
        udf,
        [INTEGER],
        INTEGER,
        type="arrow",
    )
```

After defining and registering the UDFs, we can now use them directly within
SQL:

```
duckdb.sql(
    """
    select list(val) as vals from tbl union all
    select list(fill_null_with_0(val)) from tbl union all
    select list(fill_null_forward(val)) from tbl union all
    select list(fill_null_backward(val)) from tbl union all
    select list(fill_null_with_approx_median(val)) from tbl
    """
).show()
```

This prints:

```
┌─────────────────────────────────────────┐
│                  vals                   │
│                 int32[]                 │
├─────────────────────────────────────────┤
│ [1, NULL, NULL, NULL, 5, NULL, NULL, 8] │
│ [1, 0, 0, 0, 5, 0, 0, 8]                │
│ [1, 1, 1, 1, 5, 5, 5, 8]                │
│ [1, 5, 5, 5, 5, 8, 8, 8]                │
│ [1, 5, 5, 5, 5, 5, 5, 8]                │
└─────────────────────────────────────────┘
```

## Polars + PyArrow UDFs + DuckDB

Nothing's stopping us from using Polars within UDFs though. Since
pyarrow.compute doesn't have linear interpolation for filling NULLs, we can use
Polars instead to create a Timescale-esque `interpolate` function:

```python
def interpolate(vals):
    missing_vals = pl.from_arrow(vals)  # convert to polars series
    filled = missing_vals.interpolate()  # interpolate
    return filled.to_arrow()  # convert back to arrow fmt and return

duckdb.create_function(
    "interpolate", interpolate, [INTEGER], INTEGER, type="arrow"
)

duckdb.sql("select dt, val, interpolate(val) as filled from tbl").show()
```

This outputs:

```
┌────────────┬───────┬────────┐
│     dt     │  val  │ filled │
│    date    │ int32 │ int32  │
├────────────┼───────┼────────┤
│ 1970-01-01 │     1 │      1 │
│ 1970-01-02 │  NULL │      2 │
│ 1970-01-03 │  NULL │      3 │
│ 1970-01-04 │  NULL │      4 │
│ 1970-01-05 │     5 │      5 │
│ 1970-01-06 │  NULL │      6 │
│ 1970-01-07 │  NULL │      7 │
│ 1970-01-08 │     8 │      8 │
└────────────┴───────┴────────┘
```

## References/Further Reading

- [Missing Data - Polars Guide](https://pola-rs.github.io/polars-book/user-guide/expressions/null/#missing-data-metadata)
- [DuckDB with Polars](https://duckdb.org/docs/guides/python/polars.html)
- [From Waddle to Flying: Quickly expanding DuckDB's functionality with Scalar
  Python UDFs](https://duckdb.org/2023/07/07/python-udf.html)
