+++
title = "Creating a DuckDB Table Function Extension"
date = "2025-01-14"
summary = "Alternatively: A DuckDB Table Function Extension Starter Code"
tags = ["DuckDB"]
type = "note"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "creating-duckdb-table-function-extension"
+++

This quick guide is intended for developers familiar with DuckDB and basic C++
who are interested in creating their own table producing DuckDB extensions. At
the very least, you should be familiar with the
[DuckDB Basic Extension Template](https://github.com/duckdb/extension-template).

Table producing functions are functions that can be called in the `FROM` part of
a query to generate tuples usually by reading from an external source. Probably
the most commonly used table function in DuckDB is the
[`read_csv` table function](https://duckdb.org/docs/data/csv/overview.html) - if
you've done CSV imports before then you've already encountered table functions.

DuckDB does let us extend its base functionality by creating our own extensions.
The DuckDB team provides a
[template](https://github.com/duckdb/extension-template) that authors can use as
a starting point. However, the template is for scalar functions. I couldn't find
a template for table functions on github that's why I wrote this post. Later on,
as I was searching online, I came across @grammaright's
[How to Make a DuckDB Extension for a Table Function?](https://blog.debug.sexy/duckdb/extension/dbms/2024/04/09/How-to-make-a-DuckDB-extension-for-a-table-function.html).
I'd suggest you start off from @grammaright's post since I'll be referencing it
a couple of times, both implicitly (my bad) and explicitly.

Before proceeding, I'd like to warn, I'm not a professional/experienced C++
developer, the last time I wrote C++ was back in college - please feel free to
point out any errors I've made in my writing or sample code so that this post
can be more useful. Also for future reference, the DuckDB version I'm using is
`v1.1.3 19864453f7`.

## Overview of Creating Table Function Extensions

Using a table function extension involves 2 steps:

1. Loading the extension
2. Calling the table function

For step 1, to make an extension 'loadable', we have to provide its name and a
`load` method which will be invoked to register the extension.

For step 2, calling a table function involves the following steps:

1. **Binding**:
   - On query processing, upon encountering the table function, DuckDB invokes
     its associated bind function
   - The bind function processes the input arguments. For example, in the
     `read_csv` function, the input argument is the CSV file path or set of CSV
     files paths
   - The bind function also defines the schema for the table (names and data
     types for the columns)
   - Finally, the bind function initializes the `FunctionData` object which
     holds the bind data
2. **Initializing Global State**:
   - DuckDB invokes the `init_global` before reading tuples from the table
   - `init_global` creates a `GlobalTableFunctionData` object
   - This object will hold the _global_ state that will be shared across worker
     threads
   - It goes without saying, concurrent access to the global state should be
     synchronized
   - The global state has a `MaxThreads` method which tells DuckDB the maximum
     number of worker threads that will be allocated for processing the table
     function
3. **Initializing Local State**:
   - Within each worker thread, the `init_local` function is invoked
   - `init_local` creates a `LocalTableFunctionState` object which holds the
     local state
4. **Invoking the Table Function**:
   - Within each worker thread, the table function is invoked one or more times
   - The table function has access to the bind data, local state and global
     state
   - The local state is local to the worker thread, no need to synchronize
     access to it
   - The table function produces tuples and informs DuckDB how many tuples it
     has generated
   - Once done, the table function sets the cardinality of its output to zero to
     indicate it is done producing tuples

When writing a table function extension, there are many ways to break up the
steps. Here's the order I used:

0. Think about what input arguments my table function will need and what will be
   the schema of its output
1. Define the bind data structure and bind function.
2. Define the global state structure and `init_global`
3. Define the local state structure and `init_local`
4. Define the table function
5. Define the overall Extension, including how its load function and arguments
   it will table

## Table Function Example: Fibonacci Sequence

As an example, we'll create a function that generates the fibonacci sequence.
Here's how it looks like in action:

```
D load fib;
D select *  from fibonacci(10);
┌────────┬────────┐
│   i    │   f    │
│ uint64 │ uint64 │
├────────┼────────┤
│      0 │      0 │
│      1 │      1 │
│      2 │      1 │
│      3 │      2 │
│      4 │      3 │
│      5 │      5 │
│      6 │      8 │
│      7 │     13 │
│      8 │     21 │
│      9 │     34 │
├────────┴────────┤
│     10 rows     │
└─────────────────┘
```

### Bind

Let's start with the bind data and bind function. For bind data, since the
function takes in the number of fibonacci values to produce, we'll hold it in
`max`:

```cpp
struct FibBindData : public TableFunctionData {
    uint64_t max;
};
```

Now for the bind function; it should be of type `table_function_bind_t` which
has the following definition
([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/945a96cd3fffc49b1522342f710b9b133f77107b/src/include/duckdb/function/table_function.hpp#L249)):

```cpp
typedef unique_ptr<FunctionData> (*table_function_bind_t)(
    ClientContext &context,
    TableFunctionBindInput &input,
    vector<LogicalType> &return_types,
    vector<string> &names
);
```

A couple of notes:

- `ClientContext` "holds information relevant to the current client session
  during execution" (from the code's comments,
  [src/include/duckdb/main/client_context.hpp](https://github.com/duckdb/duckdb/blob/945a96cd3fffc49b1522342f710b9b133f77107b/src/include/duckdb/main/client_context.hpp)).
  Client context includes stuff like transaction and table info and methods for
  e.g. querying
- `TableFunctionBindInput` includes the arguments the user provided in their
  query plus a bunch of other stuff
  ([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/function/table_function.hpp#L89))
- We use `&return_types` and `&names` to define the output schema

Here's the bind function for the fibonacci extension:

```cpp
unique_ptr<FunctionData> FibBind(
    ClientContext &context,
    TableFunctionBindInput &input,
    vector<LogicalType> &return_types,
    vector<string> &names)
{
    // retrieve the argument provided by the user
    auto max = IntegerValue::Get(input.inputs[0]);
    if (max < 0 || max > 93) { // max >= 0 && max <= 93, at 94 and above overflows
        throw BinderException("Invalid input: n must be between 0 and 93 (inclusive). "
                             "Values less than 0 are not allowed, and values greater than 93 exceed the maximum limit for 64-bit unsigned integers.");
	}

    auto bind_data = make_uniq<FibBindData>();
    bind_data->max = max;

    // schema
    return_types.push_back(LogicalType::UBIGINT);
    names.emplace_back("i");

    return_types.push_back(LogicalType::UBIGINT);
    names.emplace_back("f");

    return std::move(bind_data);
}
```

### Init Global

Our fibonacci table function will be single threaded so there really isn't much
to do here since we won't be using global state to coordinate across concurrent
worker threads. In fact, we don't even need to define a global state struct and
an init global function - the defaults work fine if we set init global to null
when initializing the extension.

However, for the sake of completion, I've included it here:

The struct that will hold global state is as follows:

```cpp
struct FibGlobalState : public GlobalTableFunctionState {
    FibGlobalState() {};
    ~FibGlobalState() override {}
    idx_t MaxThreads() const override { return 1; /* single threaded */ };
private:
    mutable mutex main_mutex;
};
```

The init global function has to be of type `table_function_init_global_t` which
has the following definition
([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/function/table_function.hpp#L108)):

```cpp
typedef unique_ptr<GlobalTableFunctionState> (*table_function_init_global_t)(
    ClientContext &context,
    TableFunctionInitInput &input
);
```

We've already encountered `ClientContext`.

As for `TableFunctionInitInput`
([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/function/table_function.hpp#L108)),
it's used for:

- passing the `bind_data` from the binding phase
- providing information about columns (`column_ids` and `projection_ids`) and
  filters for projection and filter pushdowns

Our init global function is as follows:

```cpp
unique_ptr<GlobalTableFunctionState> FibInitGlobal(
    ClientContext &context,
    TableFunctionInitInput &input)
{
    auto &bind_data = input.bind_data->Cast<FibBindData>();
    return make_uniq<FibGlobalState>();
}
```

### Init Local

The struct that will hold local state is as follows:

```cpp
struct FibLocalState : public LocalTableFunctionState {
public:
    uint64_t a; // prev fibonacci number
    uint64_t b; // curr fibonacci number
    uint64_t curr_index; // index

    FibLocalState() : a(0), b(1), curr_index(0) {}
};
```

The init local function has to be of type `table_function_init_local_t` which
has the following definition
([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/function/table_function.hpp#L254)):

```cpp
typedef unique_ptr<LocalTableFunctionState> (*table_function_init_local_t)(
    ExecutionContext &context,
    TableFunctionInitInput &input,
    GlobalTableFunctionState *global_state
);
```

A couple of notes:

- `ExecutionContext`
  ([src/include/duckdb/execution/execution_context.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/execution/execution_context.hpp#L19))
  can be used to access the `ClientContext` and thread-local context
- `TableFunctionInitInput`: we've already encountered this - it's one of the
  parameters for init global
- `GlobalTableFunctionState`: this is the global state that's initialized in
  init global

For our init local function, we've got:

```cpp
unique_ptr<LocalTableFunctionState> FibInitLocal(
    ExecutionContext &context,
    TableFunctionInitInput &input,
    GlobalTableFunctionState *global_state_p)
{
    return make_uniq<FibLocalState>();
}
```

### Table Producing Function

Now for the core of the extension - the table function. This should be of type
`table_function_t` which has the following definition
([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/function/table_function.hpp#L259)):

```cpp
typedef void (*table_function_t)(
    ClientContext &context,
    TableFunctionInput &data,
    DataChunk &output
);
```

A couple of notes:

- `ClientContext`: we've already encountered this in the bind function (as a
  parameter), init global (as a parameter) and init local (as part of
  `ExecutionContext`)
- `TableFunctionInput`
  ([src/include/duckdb/function/table_function.hpp](https://github.com/duckdb/duckdb/blob/e0d79a7eb019477b12976b33352a2370d48d2cad/src/include/duckdb/function/table_function.hpp#L150)):
  we use this to access the bind data, global state and local state. As
  mentioned earlier, bind data should be treated as read only.
- `DataChunk`
  ([src/include/duckdb/common/types/data_chunk.hpp](https://github.com/duckdb/duckdb/blob/b76b8f7b2b1fa7c2169fabecb31fecc3d8d381cd/src/include/duckdb/common/types/data_chunk.hpp)):
  this is the chunk in memory where we'll write the tuples we're producing (e.g.
  from parsing from a csv or parquet file) and also set the cardinality of our
  output

  Our fibonacci table function is as follows:

```cpp
static void FibFunction(
    ClientContext &context,
    TableFunctionInput &data_p,
    DataChunk &output)
{
    // get bind data, global state and local state
    auto &bind_data = data_p.bind_data->Cast<FibBindData>();
    auto &global_state = data_p.global_state->Cast<FibGlobalState>();
    auto &local_state = data_p.local_state->Cast<FibLocalState>();


    // determine how many rows to insert
    if (local_state.curr_index == bind_data.max){
         output.SetCardinality(0);
         return;
    }
    auto remaining = bind_data.max - local_state.curr_index;
    auto size = MinValue<idx_t>(remaining, STANDARD_VECTOR_SIZE);

    // set cardinality of output
    output.SetCardinality(size);


    // get columns
    auto ith_vals = FlatVector::GetData<uint64_t>(output.data[0]);
    auto fib_vals = FlatVector::GetData<uint64_t>(output.data[1]);

    idx_t i = 0;

    // first fibonacci value
    if (local_state.curr_index == 0) {
        ith_vals[0] = 0;
        fib_vals[0] = local_state.a;
        local_state.curr_index++;
        i++;
    }

    // second fibonacci value
    if (local_state.curr_index == 1 && i < size){
        ith_vals[1] = 1;
        fib_vals[1] = local_state.b;
        local_state.curr_index++;
        i++;
    }

    // fill columns
    for (; i < size; i++) {
        uint64_t next = local_state.a + local_state.b;
        local_state.a = local_state.b;
        local_state.b = next;
        fib_vals[i] = next;
        ith_vals[i] = local_state.curr_index;
        local_state.curr_index++;
    }
}
```

### Setting up the Extension

Everything above is brought together within the following class:

```cpp
class FibExtension : public Extension {
public:
    void Load(DuckDB &db) override;
    std::string Name() override;
    std::string Version() const override;
};
```

The method implementations are as follows:

```cpp
void FibExtension::Load(DuckDB &db) {
    TableFunction table_function(
        "fibonacci", // function name
        {LogicalType::INTEGER}, // function arguments
        FibFunction, // table function
        FibBind, // bind function
        FibInitGlobal, // init global function
        FibInitLocal // init local function
    );
    ExtensionUtil::RegisterFunction(*db.instance, table_function); // register
}

std::string FibExtension::Name() { return "fib"; } // extension name

std::string FibExtension::Version() const { return ""; }
```

## Exercises Left to the Reader

There's a lot more to table functions, we've just scratched the surface. If
you're interested, here's more stuff you can explore:

- Add named parameters to the function. E.g. for fibonacci, the starting numbers
  can be set via named parameters (0 and 1, 1 and 1, 1 and 2)
- Handle filter pushdown
- Handle projection pushdown
- Provide DuckDB with overall cardinality of the table the function will produce
- Provide DuckDB with scan progress (updates on how much the function has
  produced thus far)
- Add a statistics function?
- Pick an example that can be multi-threaded e.g. a FizzBuzz table function

## References

1. DuckDB source code: [repo](https://github.com/duckdb/duckdb)
2. DuckDB Extension Template:
   [repo](https://github.com/duckdb/extension-template)
3. [How to Make a DuckDB Extension for a Table Function? - @grammaright](https://blog.debug.sexy/duckdb/extension/dbms/2024/04/09/How-to-make-a-DuckDB-extension-for-a-table-function.html)
