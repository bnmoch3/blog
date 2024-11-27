# Notes on Ownership and Borrowing in Rust

## Rust in Action

- Within Rust, ownership relates to cleaning values when these are no longer
  needed. For example, when a function returns, the memory holding its local
  variables needs to be freed.
- _A value's lifetime is the period when accessing that value is valid
  behaviour_. A function's local variables live until the function returns,
  while global variables might live for the life of the program.
- _To borrow a value means to access it_... Its meaning is used to emphasize
  that while values can have a single owner, it's possible for many parts of the
  program to share access to those values.
- Movement within Rust code referes to movement of ownership, rather than the
  movement of data. _Ownership_ is a term used within the Rust community to
  refer to the compile-time process that checks every use of a value is valid
  and that every value is destroyed cleanly.
- Every value in Rust is _owned_
- Formally, primitive types are said to posses _copy semantics_ whereas all
  other types have move _move semantics_.
- When values go out of scope or their lifetimes end for some other reason,
  their destructors are called. A _destructor_ is a function that removes traces
  of the value from the program by deleting references and freeing memory... An
  implication of this system is that values cannot outlive their owner.
- Four general strategies can help with ownership issues:
  - Use references where full ownership is not required.
  - Duplicate the value.
  - refactor the code to reduce the number of long-lived objects.
  - wrap your data in a type designe to assist with movement issues.
- Borrows can be read-only or read-write. Only one read-write borrow can exist
  at any one time.
- Rust supports a feature known as interior mutability, which enables types to
  present themselves as immutable even when their values can change over time.
