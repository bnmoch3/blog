# Rust by example

```rust
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]
```

## Introduction

- Rust's module system comprises:
  - paths: a way of naming an item, such as a struct, function or module
  - modules & use: let's you control the organization, scope and privacy of
    paths.
  - crates: tree of modules that prodice a library/executable
  - packages: cargo feature that lets you build, test and share crates

## Modules

- A module is a collection of items: functions, structs, traits, `impl` blocks
  and other modules.
- main purpose:
  - hierarchically split code into logical units
  - manage visibility(public/private) between them.
- By default, the items in a module have private visibility but this can be
  overriden with the `pub` modifier.
- Items in modules default to private visibility unless the `pub` modifier is
  used:
  ```rust
  mod my_mod {
      fn private_fn() {
          println!("called my_mod::private_fn()")
      }
      pub fn public_fn() {
          println!("called my_mod::public_fn()")
      }
  }

  fn main() {
      my_mod::public_fn();

      // ERROR: function `private_fn` is private
      // my_mod::private_fn();
  }
  ```
- Items can access other items in the same module, even when private:
  ```rust
  mod my_mod {
      fn private_fn() {
          println!("called my_mod::private_fn()")
      }

      pub fn access_private_fn() {
          println!("called my_mod::access_private_fn");
          private_fn()
      }
  }
  ```
- Modules can be nested

  ```rust
  mod my_mod {
      pub mod nested {
          fn private_fn() {
              println!("called my_mod::nested::private_fn()")
          }

          pub fn public_fn() {
              println!("called my_mod::nested::public_fn()")
          }
      }
  }

  fn main() {
      my_mod::nested::public_fn()
  }
  ```
- Functions declared using `pub(in path)` syntax are only visible within the
  given path. `path` must be a parent or ancestor module.
  ```rust
  mod my_mod {
      pub fn access_nested_fn() {
          println!("called my_mod::access_nested_fn");
          nested::nested_fn();
      }

      pub mod nested {
          pub(in crate::my_mod) fn nested_fn() {
              println!("called my_mod::nested::nested_fn()")
          }
      }
  }

  fn main() {
      my_mod::access_nested_fn();
      // my_mod::nested::nested_fn() // ERROR
  }
  ```
- Functions declared using `pub(self)` syntax are only visible within the
  current module, which is the same as leaving them private:
  ```rust
  mod my_mod {
      pub fn access_nested_fn() {
          println!("called my_mod::access_nested_fn");
          // nested::nested_fn(); // ERROR
      }

      pub mod nested {
          pub(self) fn nested_fn() {
              println!("called my_mod::nested::nested_fn()")
          }
      }
  }
  ```
- Functions declared using `pub(super)` syntax are only visible within the
  parent module:
  ```rust
  mod m1 {
      pub mod m2 {
          pub mod m3 {
              pub(super) fn some_function() {
                  println!("some function")
              }
          }

          fn access_some_function() {
              println!("m2::access_some_function");
              m3::some_function()
          }
      }
      fn access_some_function() {
          println!("m1::access_some_function");
          // m3::some_function() // ERROR
      }
  }
  ```
- Structs have an extra level of visibility with their fields. Visibility
  defaults to private and can be overriden with the pub modifier. Visibility
  only matters when a struct is accessed from outside teh module where it is
  defined.
  ```rust
  mod m1 {
      pub struct Point {
          x: f64,
          y: f64,
      }
      impl Point {
          pub fn new(x: f64, y: f64) -> Point {
              Point { x, y }
          }
      }
  }

  fn main() {
      // let p = m1::Point { x: 1.0, y: 1.0 }; // ERROR, field x and y are private
      let p = m1::Point::new(1.0, 1.0);
  }
  ```
- The `use` declaration can be used to bind a full path to a new name for easier
  access. The `as` keyword can be used to bind imports to a different name. Note
  that `use` only creates the shortcut for the particular scope in which the
  `use` occurs.
  ```rust
  mod m1 {
      pub mod m2 {
          pub mod m3 {
              pub fn some_function() {
                  println!("called m1::m2::m3::some_function()")
              }
              pub fn some_other_function() {
                  println!("called m1::m2::m3::some_other_function()")
              }
          }
      }
  }

  fn main() {
      m1::m2::m3::some_function();
      use m1::m2::m3::{some_function, some_other_function};
      some_function();
      some_other_function();

      use m1::m2::m3::some_function as different_name_same_function;
      different_name_same_function()
  }
  ```
- `pub use` is used to re-export names i.e. bring an item into scope but also
  make that item available for others to bring into their scope. Consider the
  following in `foo.rs`:
  ```rust
  mod bar {
      pub mod quz {
          pub fn some_function() {
              println!("foo::bar::some_function()")
          }
      }
  }

  pub use crate::foo::bar::quz::some_function;
  ```
  In `main.rs`, we can now use `some_function`:
  ```rust
  mod foo;

  fn main() {
      foo::some_function();
      println!("main");
  }
  ```
- To bring in multiple items defined in the same crate or module, use brackets:
  ```rust
  use std::{cmp::Ordering, io};
  ```
  In the case where one of the statements is a subpath of the other, use `self`:
  ```rust
  use std::io::{self,Write};
  // instead of
  use std::io;
  use std::io::Write;
  ```
  To bring in all public items defined in a path into scope, use the glob
  operator:
  ```rust
  use std::collections::*;
  ```

- The `super` and `self` keywords can be used in the path to remove ambiguity
  when accessing items. The `self` keyword refers to the current module scope.
  It can also be used to access nested modules within the current scope. The
  `super` keyword refers to the parent scope
  ```rust
  fn some_function() {
      println!("called some_function()")
  }
  mod m1 {
      pub fn some_function() {
          super::some_function();
          println!("called m1::some_function()");
      }
      pub mod m2 {
          pub fn some_function() {
              super::some_function();
              println!("called m1::m2::some_function()");
              self::m3::some_function();
          }
          pub mod m3 {
              pub fn some_function() {
                  println!("called m1::m2::m3::some_function()")
              }
          }
      }
  }

  fn main() {
      m1::m2::some_function()
      // called some_function()
      // called m1::some_function()
      // called m1::m2::some_function()
      // called m1::m2::m3::some_function()
  }
  ```
- Modules can be mapped to a file/directory hierarchy. Consider the following
  ```
  .
  ├── foo
  │   ├── bar.rs
  │   └── quz.rs
  ├── foo.rs
  └── main.rs
  ```
  Lookup is as follows: in `main.rs`, if we declare `mod foo`, the compiler
  looks up for the module's code in the following order:
  - inline
  - in `src/foo.rs`
  - in `src/foo/mod.rs`
- In `foo.rs`, we have the following. The `mod` declarations looks for the files
  named `bar.rs` and `quz.rs` insider the `foo` directory and inserts their
  contents into modules named `foo` and `bar` respectively.
  ```rust
  pub mod bar;
  mod quz;

  pub fn foo_function() {
      println!("[foo.rs] foo()");
      quz::quz_function();
  }
  ```
  In `main.rs`, we have the following. Similarly, the `mod` declaration looks
  for a file named `foo.rs` and inserts its contents inside a a module named
  `foo` under this scope. Note that since `quz` was declared as a private module
  in `foo`, we cannot call `quz_function` directly.
  ```rust
  mod foo;

  fn main() {
      foo::foo_function();
      foo::bar::bar_function();
      // foo::quz::quz_function(); // ERROR quz is a private module
  }
  ```
- Suppose we add another file `bar.rs` such that the hierarchy is as follows:
  ```
  .
  ├── bar.rs
  ├── foo
  │   └── bar.rs
  ├── foo.rs
  └── main.rs
  ```
  `bar.rs` has the following content:
  ```rust
  pub fn bar_function() {
        println!("[bar.rs] haha another bar_function()");
  }
  ```
  From `main.rs` we can invoke either `bar_function` as follows:
  ```rust
  mod foo;
  mod bar;

  fn main() {
      bar::bar_function();
      foo::foo_function();
  }
  ```
  From `foo.rs`, we can invoke either `bar_function` as follows:
  ```rust
  pub mod bar;

  pub fn foo_function() {
      super::bar::bar_function();
      bar::bar_function();
  }
  ```

## Crates

- A crate is a compilation unit in Rust. It is the smallest amount of code that
  the rust compiler considers at a time.
- Crates can contain modules, and modules may be defined in other files that get
  compiled with the crate.
- There are two kinds of crates:
  - **binary crate**: programs that can be compiled into executables and ran.
    Each must have a main function.
  - **library crate**: defines functionality intended to be shared with multiple
    projects. Don't have a main function and don't compile to an executable.
- **crate root**: source file that the rust compiler starts from and makes up
  the root module of your create. For binary crates, this is usually
  `src/main.rs` and for library crates, this is usually `src/lib.rs`
- **package**: bundle of one or more creates that provides a set of
  functionality. A package contains a `Cargo.toml` that describes how to build
  those crates.
- A package can contains as many binary crates as you like but at most only one
  library crate.
- Whenever `rustc some_file.rs` is called, `some_file.rs` is treated as the
  crate file. If `some_file.rs` had mod declarations in it, then the contents of
  the module files are inserted in places where `mod` declarations in the crate
  file are found.
- Iow, modules don't get compiled individually, only crates get compiled
  individually.
- Crates can be compiled into a binary or a library.
- Consider the following file hierarchy:
  ```
  .
  ├── foo.rs
  └── main.rs
  ```
- In `foo.rs`, we have:
  ```rust
  pub fn foo_function() {
        println!("called foo_function()")
  }
  ```
- To compile it into a library:
  ```
  rustc --crate-type=lib foo.rs
  ```
  This results in a library prefixed with `lib*`:
  ```
  .
  ├── foo.rs
  ├── libfoo.rlib
  └── main.rs
  ```
  In `main.rs`, we have:
  ```rust
  fn main() {
      foo::foo_function();
  }
  ```
  To link the crate:
  ```
  rustc main.rs --extern foo=libfoo.rlib
  ./main
  ```
