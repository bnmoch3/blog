---
layout: post
title:  "DuckDB JIT Compiled UDFs with Numba"
slug: duckdb-jit-udfs-numba
tag: ["DuckDB", "Python"]
categories: "DuckDB Python"
excerpt_separator: <!--start-->
---

JIT compiling your vectorized UDFs with Numba. Plus pure SQL is plenty fast if
you can figure out how to write it

<!--start-->

DuckDB's Python API supports extending of core functionality with user-defined
functions (UDFs). This comes quite in handy when we've got use-cases for which
DuckDB does not provide built-in functions. To demonstrate the utility of UDFs,
I'll pick a rather contrived problem: we've got a list of pairs of geographical
points (latitude, longitude) - we need to compute the
[haversine distance](https://en.wikipedia.org/wiki/Haversine_formula) between
all the pairs then get the average distance. Here's the schema of the table:

```
> create table points from select * from 'data/points.parquet';
> describe points;
┌─────────────┬─────────────┬─────────┬─────────┬─────────┬───────┐
│ column_name │ column_type │  null   │   key   │ default │ extra │
│   varchar   │   varchar   │ varchar │ varchar │ varchar │ int32 │
├─────────────┼─────────────┼─────────┼─────────┼─────────┼───────┤
│ x0          │ DOUBLE      │ YES     │         │         │       │
│ y0          │ DOUBLE      │ YES     │         │         │       │
│ x1          │ DOUBLE      │ YES     │         │         │       │
│ y1          │ DOUBLE      │ YES     │         │         │       │
└─────────────┴─────────────┴─────────┴─────────┴─────────┴───────┘
```

`(x0,y0)` is the start and `(x1,y1)` is the end. The x values are longitudes and
the y values are latitudes.

## Python-Native UDFs

Since DuckDB does not have a built-in haversine function, we'll have to define
one ourselves:

```python
import math

def _calc_haversine_dist(x0, y0, x1, y1):
    # x -> longitude
    # y -> latitude
    EARTH_RADIUS = 6372.8  # km

    p0_latitude = math.radians(y0)
    p1_latitude = math.radians(y1)

    delta_latitude = math.radians(y0 - y1)
    delta_longitude = math.radians(x0 - x1)

    central_angle_inner = (math.sin(delta_latitude / 2.0)) ** 2 + math.cos(
        p0_latitude
    ) * math.cos(p1_latitude) * (math.sin(delta_longitude / 2.0) ** 2)

    central_angle = 2.0 * math.asin(math.sqrt(central_angle_inner))

    distance = EARTH_RADIUS * central_angle
    return distance

import duckdb
from duckdb.typing import DOUBLE

conn = duckdb.connect("points.db")
conn.create_function(
    "haversine_dist",
    _calc_haversine_dist,
    [DOUBLE, DOUBLE, DOUBLE, DOUBLE],
    DOUBLE,
    type="native",
    side_effects=False,
)
```

There are two kinds of UDFs: scalar UDFs which produce single values that are
filled into a column, and table UDFs that produce rows which are gathered into a
table. The one defined just above is a scalar UDF.

From there we can use it within SQL, invoking it just like we would for any
built-in function:

```sql
select 
  avg(haversine_dist(x0,y0,x1,y1)) as avg_dist
from points
```

## Speeding up Python-Native UDFs with Numba

Unfortunately, its performance leaves a lot to be desired, that is compared to a
custom script. A good piece of advice is to profile the code and figure out
where the bottleneck is. I'll skip this advice and simply assume that it's slow
because of the quote-unquote python interpreter overhead, particularly at the
`_calc_haversine_dist`.

Luckily, we've got a tool that can speed up computation-heavy procedures in
Python: [Numba](https://numba.readthedocs.io/en/stable/). From its docs, Numba
is described as 'a just-in-time compiler for Python that works best on code that
uses NumPy arrays and functions, and loops'. Let's apply it to
`_calc_haversine_dist` and see if it's up to the task:

```python
from numba import jit

_calc_haversine_dist_py_jit = jit(nopython=True, nogil=True, parallel=False)(
    _calc_haversine_dist
)
```

In almost all usages of Numba that you'll see out there, `jit` is applied as a
decorator - my non-standard usage of invoking it as a function is to make it
clear that we're creating a new compiled function. Also I'll be reusing
`_calc_haversine_dist` in other contexts later on so I want to keep it as is.

`nopython=True` prevents Numba from falling back into object mode in cases where
Numba does not 'understand' a data type. Since all our inputs and outputs are
numeric, Numba should be able to handle them natively without any error, setting
`nopython` to True is more of a sanity check. `nogil=True` ensures that upon
invocation the function does not hold the GIL since we don't need it - allowing
for actual parallelism. Finally with `parallel=False`, we don't want Numba to
manage parallelism for us - that's left for DuckDB and it's query executor since
it'll have better info on how much resources we need and will schedule the
operations better given it's cognizant of the upstream operators such as `avg`
in our case.

Does the JIT-compiled alternative provide any performance benefits - let's see
the results. As an aside, I carried out all the benchmarks using
[hyperfine](https://github.com/sharkdp/hyperfine) and picked the best time -
with all the best practices applied. The dataset has 10,000,000 entries.

![chart](/assets/images/duckdb_numba_udfs/py_native.svg)

Unfortunately, the performance benefit is negligible (26.7 seconds for no JIT vs
23.443 with JIT). As explained in [1], usage of Python-native UDFs incurs the
overhead of translating DuckDB values into Python objects and vice versa. That
is why the JIT scalar version doesn't improve performance much.

## Vectorized JIT UDFs

To mitigate against this overhead, DuckDB offers a third kind of UDFs -
vectorized UDFs. These take in inputs as vectors and produce outputs as vectors.
They also allow for zero-copy between the database and client code (no
translation overhead); additionally, systems-wise, they benefit from improved
cache locality.

For vectorized UDFs, DuckDB uses the [Arrow](https://arrow.apache.org/) format
to provide inputs and take the output.

Let's convert the haversine UDFs above from scalar into vectorized. I'll skip
non-JIT vectorized functions and head straight to the JIT version since in my
benchmarks across other datasets and problems, vectorized non-JIT versions ended
up performing even worse than their scalar equivalents, sometimes by a factor
of 5.

Numba comes with built-in support for Numpy arrays. In order to provide
Arrow-based arrays as input, we have to extend Numba's typing layer. Uwe Korn
provides [3] a different approach for passing Arrow-based arrays to JIT
functions but I'll skip it for now. Instead, I'll take advantaged of `pyarrow`'s
Arrow to Numpy zero-copy.

Let's start with the function:

```python
import numpy as np

@jit(nopython=True, nogil=True, parallel=False)
def _calc_haversine_dist_vectorized(x0, y0, x1, y1, out, len_):
    # x -> longitude
    # y -> latitude
    EARTH_RADIUS = 6372.8  # km

    for i in range(len_):
        p0_latitude = np.radians(y0[i])
        p1_latitude = np.radians(y1[i])

        delta_latitude = np.radians(y0[i] - y1[i])
        delta_longitude = np.radians(x0[i] - x1[i])

        central_angle_inner = np.square(np.sin(delta_latitude / 2.0)) + np.cos(
            p0_latitude
        ) * np.cos(p1_latitude) * np.square(np.sin(delta_longitude / 2.0))
        central_angle = 2.0 * np.arcsin(np.sqrt(central_angle_inner))

        distance = EARTH_RADIUS * central_angle
        out[i] = distance
```

A good rule of thumb whenever one's using numpy is to avoid explicit for-loops
and rely on numpy's built-in vectorized functions. With Numba though, we're more
than encouraged to use such for-loops. Numba in turn receives these procedures
and compiles them into relatively efficient procedures, taking advantage of all
the optimizations that LLVM provides.

As for registering the UDF, the only change we'll make is telling DuckDB that
we're providing it an "arrow" type UDF rather than a "native" one. We've also
got to convert the inputs into numpy arrays using the `to_numpy` method before
invoking `_calc_haversine_dist_vectorized`:

```python
def haversine_dist_udf(x0, y0, x1, y1):
    len_ = len(x0)
    out = np.empty((len_,))
    _calc_haversine_dist_vectorized(
        *tuple(v.to_numpy() for v in (x0, y0, x1, y1)),
        out=out,
        len_=len_,
    )
    return pa.array(out)

conn.create_function(
    "haversine_dist",
    haversine_dist_udf,
    [DOUBLE, DOUBLE, DOUBLE, DOUBLE],
    DOUBLE,
    type="arrow",
)
conn = duckdb.connect("points.db")
sql = f"""
select
  avg(haversine_dist(x0,y0,x1,y1)) as avg_dist
from points
"""
res = conn.sql(sql).fetchall()
print(f"avg={res[0][0]}")
```

The code looks almost C-like: we're "allocating" the output buffer in the
`np.empty((len,_))` line, plus we're passing the length of the arrays as one of
the parameters. `_calc_haversine_dist_vectorized` returns a numpy array which is
zero-copied into an arrow array that DuckDB expects.

And for the performance, here's what we get:

![chart](/assets/images/duckdb_numba_udfs/vec_numba.svg)

A near 9X improvement with the vectorized version taking 2.998 seconds vs the
26.7 seconds that the native scalar UDF takes!

## Comparison with Rust-based UDFs

I've [previously detailed](https://bnm3k.github.io/blog/rust-duckdb-py-udf) how
one can implement such vectorized UDFs in Rust and invoke them via FFI. If you
know enough Rust, the hardest part at least for me is setting up and configuring
maturin and pyO3 (aka the build and integration steps), plus making sure I can
import the package in Python (environment stuff). Writing the function should be
quite straight-forward:

```rust
// imports ...

fn calc_haversine_dist(x0: f64, y0: f64, x1: f64, y1: f64) -> f64 {
    // x -> longitude
    // y -> latitude
    const EARTH_RADIUS: f64 = 6372.8; // km
    let radians = |d| (d * std::f64::consts::PI) / 180.0;
    let square = |x| x * x;

    let p0_latitude = radians(y0);
    let p1_latitude = radians(y1);

    let delta_latitude = (y0 - y1).to_radians();
    let delta_longitude = (x0 - x1).to_radians();

    let central_angle_inner = square((delta_latitude / 2.0).sin())
        + p0_latitude.cos() * p1_latitude.cos() * square((delta_longitude / 2.0).sin());
    let central_angle = 2.0 * central_angle_inner.sqrt().asin();

    let distance = EARTH_RADIUS * central_angle;
    return distance;
}

// register above function into the py module
```

I'm using this method just to see how well the Numba-JIT version compares to the
Rust-based version. The results are quite pleasing since the Rust-based
versiontakes 2.566 seconds vs the 2.998 seconds the the JIT version took:

![chart](/assets/images/duckdb_numba_udfs/vec_numba_rust.svg)

Now, I do enjoying using Rust every now and then but for quick development,
Numba does provide some bang for our buck. If there are some concerns about
having to bundle the entirety of Numba as a dependency for other users, Numba
can also AOT compile the function into a distributable module and be kept as a
development or build-time dependency.

## SQL Functions

Both the JIT and Rust-based vectorized UDFs provide decent performance but
there's nothing quite like good old-fashioned SQL.

StackOverflow user TautrimasPajarskas was kind enough to provide a
[pure SQL-based approach](https://stackoverflow.com/a/72730460) for calculating
the haversine distance . Its performance blows all other approaches out of the
water. Here's the query in all its glory:

```sql
with distances as (
    select
        2 * 6335
            * asin(sqrt(
                pow(sin((radians(y1) - radians(y0)) / 2), 2)
                + cos(radians(y0))
                * cos(radians(y1))
                * pow(sin((radians(x1) - radians(x0)) / 2), 2)
            )) as dist
    from points
)
select
    avg(dist) as avg_dist
from distances
```

On benchmarking, it clocks in at 347.9 milliseconds:

![chart](/assets/images/duckdb_numba_udfs/pure_sql.svg)

Only issue I had with the pure SQL approach was that the final value veered a
bit off from all other answers, I'm guessing because of DuckDB's re-ordering of
floating-point operations. To be fair, this isn't their fault per se since SQL
by definition is not imperative.

## Export entire dataset to Numpy

There is yet another approach. DuckDB's Python API let's as efficiently export
the entire dataset into numpy. From there we can carry out the entire
computation at the client's side. The performance isn't quite bad as we'll see
but I often hesitate relying on such approaches for a couple of reasons [1]:

- Performance and Resource Usage: DuckDB can adjust its execution strategy based
  on the metadata it keeps around. If the dataset is small, DuckDB will use
  fewer threads. If the dataset can't fit entirely in memory, DuckDB will
  definitely do a better job buffering the needed working set than I can.
- Integration with SQL: while average is a simple operation that can be done in
  the client's side, for more complex upstream operations such as window
  queries, CTEs or joins, I'd prefer to keep everything within SQL via UDFs and
  have DuckDB figure out the execution

With that being said, let's see how we can leverage Numba for computation. Numba
does provide a means for parallelization (which I had to ensure is off with the
`parallel=False` parameter). By default, it will use a simple built-in
`workqueue` for the threading layer but if OpenMP is present, it'll use that
instead. I opted for OpenMP since it's faster.

First, let's export all the points into numpy via the `fetchnumpy` method:

```python
sql = f"""
select x0,y0,x1,y1
from points
"""
as_np = duckdb.sql(sql).fetchnumpy()
```

Next let's set up the functions:

```python
from numba import float64, vectorize, jit, threading_layer

spec = [float64(float64, float64, float64, float64)]
get_dist_parallel = vectorize(spec, nopython=True, target="parallel")(
    _calc_haversine_dist
)

@jit(nopython=True, nogil=True)
def get_avg(nums):
    return np.mean(nums)

def calc(args) -> float:
    dists = get_dist_parallel(*args)
    avg = get_avg(dists)
    return avg
```

Now for the computation:

```python
args = tuple(as_np[c] for c in ("x0", "y0", "x1", "y1"))
res = calc(args)
print(res)
```

Performance-wise, this is faster than using the vectorized UDFs though it's
still not as fast as the pure-SQL approach:

If you've got an Nvidia GPU plus all the relevant drivers and libraries
installed, Numba also let's you use CUDA quite easily by just changing the
`target`:

```python
get_dist_cuda = vectorize(spec, target="cuda")(_calc_haversine_dist)
dists = get_dist_cuda(*args)
avg = get_avg(dists)
```

Performance-wise, in my machine, it's similar to the OpenMP CPU-based version
(1.803 seconds for CUDA vs 1.715 for OpenMP):

![chart](/assets/images/duckdb_numba_udfs/export_to_numpy.svg)

I didn't use GPU-based UDFs for the vectorized functions since I cannot directly
control the size of chunks DuckDB feeds into the UDFs: the sizes DuckDB defaults
to work for CPU based vectorized UDFs but are rather small for the GPU
equivalent ones thus resulting in high copy overhead to and fro the device,
relative to the time spent on computation. Also there's definitely ways to
improve the CUDA version for which I'll look into in the future.

## Conclusion

To sign off, here are all the benchmarking results in one graph.

![chart](/assets/images/duckdb_numba_udfs/all.svg)

Here are the raw values for reference:

```python
entries = {
    "Python Native UDF": 26.701,  # seconds
    "Python Native UDF - Numba JIT": 23.443,  # seconds
    "Vectorized UDF Numba JIT": 2.998,  # seconds
    "Vectorized UDF Rust-based": 2.566,  # seconds
    "Pure SQL": 347.9,  # ms
    "Export to Numpy - OpenMP": 1.715,  # seconds
    "Export to Numpy - CUDA": 1.803,  # seconds
}
```

And here's the [code](https://github.com/bnm3k/duckdb-udf-numba-jit).

There's of course the bane of SQL - handling NULLs within the UDFs, which I
skipped in the interest of time and simplicity.

## References

1. [From Waddle to Flying: Quickly expanding DuckDB's functionality with Scalar
   Python UDFs - Pedro Holanda, Thijs Bruineman and Phillip Cloud - DuckDB Team](https://duckdb.org/2023/07/07/python-udf.html)
2. [A ~5 minute guide to Numba - Numba Documentation](https://numba.readthedocs.io/en/stable/user/5minguide.html)
3. [Use Numba to work with Apache Arrow in pure Python - Uwe Korn](https://uwekorn.com/2018/08/03/use-numba-to-work-with-apache-arrow-in-pure-python.html)
