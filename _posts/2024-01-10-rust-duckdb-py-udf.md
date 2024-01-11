---
layout: post
title:  "Vectorized DuckDB UDFs with Rust and Python FFI"
slug: rust-duckdb-py-udf
tag: ["Rust", "Python", "DuckDB"]
category: "Python"
excerpt_separator: <!--start-->
---

Implementing vectorized UDFs in Rust that you can use in DuckDB, with a little
help from Arrow

<!--start-->

The title's quite a mouthful but the gist of this post is how to implement
Vectorized UDFs in Rust that you can use within DuckDB, specifically its Python
API.

Assuming you're already familiar with DuckDB Python UDFs and Rust-Python FFI
(using PyO3), I'll get straight to the implementation. Otherwise, these two
posts are great starting points:

- [From Waddle to Flying: Quickly expanding DuckDB's functionality with Scalar Python UDFs - DuckDB Blog](https://duckdb.org/2023/07/07/python-udf.html):
  goes over how to implement basic UDFs in Python and using them within SQL
- [Rust-Python FFI - Haixuan Xavier Tao
  Haixuan Xavier Tao](https://dora.carsmos.ai/blog/rust-python/): goes over how
  to create a rust library that you can call from Python

We'll be implementing a UDF that takes in a string and returns its length. This
is rather basic on purpose so that it can serve as a template for more complex
and useful UDFs. This will involve the following steps:

1. Set up a mixed python-rust project using
   [Maturin](https://www.maturin.rs/project_layout).
2. Implement the function in Rust. Since it's vectorized, it'll take in an
   arrow-based vector of UTF-8 strings and return a vector of U32
3. Register the function with `pyarrow.compute`
4. Create a wrapper function F that calls the UDF via `pyarrow.compute`
5. Register the wrapper with DuckDB via the Python API
6. Use the UDF within SQL

I'll skip the setting up part since the Maturin introductory material is more
detailed. Other than reading through the rust arrow documentations, it's
probably the hardest part:

As for implementation, here's the rust function:

- we're using [eyre](https://docs.rs/arrow/latest/arrow/pyarrow/) for error
  handling, as recommended in the Rust-FFI post
- Retrieving the underlying string array should be zero-copy, the rust arrow
  module provides [helpers](https://docs.rs/arrow/latest/arrow/pyarrow/) for
  converting back and forth from PyArrow
- Other than that, it's pretty straightforward

```rust
#[pyfunction]
fn get_str_len<'a>(py: Python, a: &PyAny) -> Result<Py<PyAny>> {
    let arraydata =
        arrow::array::ArrayData::from_pyarrow(a).context("Could not convert arrow data")?;

    // get string lengths
    let strs = StringArray::from(arraydata);
    let lengths_arr = {
        let mut arr_builder = arr::UInt32Builder::with_capacity(strs.len());
        strs.iter().for_each(|v| {
            if let Some(s) = v {
                arr_builder.append_value(s.len() as u32);
            } else {
                arr_builder.append_null();
            }
        });
        arr_builder.finish()
    };
    let output = lengths_arr.to_data();

    output
        .to_pyarrow(py)
        .context("Could not convert to pyarrow")
}
```

Next, add the function to the module so we can call it from Python:

```rust
#[pymodule]
fn udf(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(get_str_len, m)?)?;
    Ok(())
}
```

Maturin simplifies a lot of the stuff. Once we've built the library, we can call
it from python as follows:

```
>>> import udf
>>> import pyarrow as pa
>>> udf.get_str_len(pa.array(["foo", "bar"]))
<pyarrow.lib.UInt32Array object at 0x7fb4406e1d80>
[
  3,
  3
]
>>>
```

Next, let's register it with `pyarrow.compute`. Note that we're registering it
as a vectorized function. The UDF API for pyarrow is still experimental and all
that's documented so far is for scalar functions, setting up vectorized
functions remains undocumented:

```python
import udf
import pyarrow as pa
import pyarrow.compute as pc

pc.register_vector_function(
    lambda ctx, x: udf.get_str_len(x),  # function
    "my_str_len",  # name
    {  # doc
        "summary": "gets string length",
        "description": "Given a string 'x' returns the length of x",
    },
    {
        "x": pa.string(),  # input
    },
    pa.uint32(), # output
)
```

Finally, let's create a wrapper function and register that with DuckDB:

```
import duckdb
import duckdb.typing as t

def my_str_len_udf(x: pa.lib.ChunkedArray):
    return pc.call_function("my_str_len", [x])

conn = duckdb.connect(":memory:")
conn.create_function(
    "my_str_len", my_str_len_udf, [t.VARCHAR], t.UINTEGER, type="arrow"
)
```

We can now use the UDF within SQL:

```
conn.sql("create table test(s varchar)")
conn.sql("insert into test values ('foo'), ('bar'), (NULL), ('barx')")
res = conn.sql("select s, my_str_len(s) as l  from test")
print(res)
```

This outputs:

```
┌─────────┬────────┐
│    s    │   l    │
│ varchar │ uint32 │
├─────────┼────────┤
│ foo     │      3 │
│ bar     │      3 │
│ NULL    │   NULL │
│ barx    │      4 │
└─────────┴────────┘
```

DuckDB will call `my_str_len` with chunks of 2048 strings at a time.

While this is a decent starting point, there are a couple of details that I need
to iron out:

- Memory management: Rust manages its memory different from Python - I get the
  inkling I've missed some detail
- Skip registering the UDF with `pyarrow.compute`: this part seems unnecessary;
  registering the udf directly with DuckDB should be feasible, it's just a
  matter of figuring out which parts of the Rust Arrow Library to use
