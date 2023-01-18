# Scope, Ownership

- Variables in Rust do more than just hold data in the stack: they also own
  resources, e.g. Box<T> owns memory in the heap. Rust enforces RAII (Resource
  Acquisition Is Initialization), so whenever an object goes out of scope, its
  destructor is called and its owned resources are freed.
- The notion of a destructor in Rust is provided through the Drop trait. The
  destructor is called when the resource goes out of scope. This trait is not
  required to be implemented for every type, only implement it for your type if
  you require its own destructor logic.
- Because variables are in charge of freeing their own resources, resources can
  only have one owner. This also prevents resources from being freed more than
  once.
- A lifetime is a construct the compiler (or more specifically, its borrow
  checker) uses to ensure all borrows are valid. Specifically, a variable's
  lifetime begins when it is created and ends when it is destroyed. While
  lifetimes and scopes are often referred to together, they are not the same.
- Take, for example, the case where we borrow a variable via &. The borrow has a
  lifetime that is determined by where it is declared. As a result, the borrow
  is valid as long as it ends before the lender is destroyed. However, the scope
  of the borrow is determined by where the reference is used.
- Consider the snippet below. `print_refs` takes two references to `i32` which
  have different lifetims `'a` and `'b`. These two lifetimes must both be at
  least as long as the function `print_refs`. Any input which is borrowed must
  outlive the borrower. In other words, the lifetime of `four` and `nine` must
  be longer than that of `print_refs`.

```rust
fn print_refs<'a, 'b>(x: &'a i32, y: &'b i32) {
  println!("x is {} and y is {}", x, y);
}

fn main() {
  let (four, nine) = (4, 9);
  print_refs(&four, &nine);
}
```

- Consider the snippet below: `failed_borrow` is a function which takes no
  arguments, but has a lifetime parameter `'a`. Attempting to use the lifetime
  `'a` as an explicit type annotation inside the function will fail because the
  lifetime of `&_x` is shorter than that of `y`. A short lifetime cannot be
  coerced into a longer one.

```rust
fn failed_borrow<'a>() {
    let _x = 12;
    let y: &'a i32 = &_x; // ERROR: 
}
fn main() {
  failed_borrow();
}
```

- Ignoring elision, function signatures with lifetimes have few constraints:
  - any reference must have an annotated lifetime
  - any reference being returned must have the same lifetme as an input or be
    `static`: Consider:
    ```rust
    fn pass_x<'a, 'b> (x: &'a i32, _: &'a i32) -> &'a i32 { x }
    ```
    The return value must have either lifetime `'a` or `'b`
- Methods and trait methods are annotated similarly to functions
- Annotation of lifetimes in structs and enums are also similar to functions.
- A longer lifetime can be coerced into a shorter one so that it works inside a
  scope it wouldn't work in. Consider the following:
  ```rust
  fn multiply<'a>(first: &'a i32, second: &'a i32) -> i32 {
    first * second
  }

  fn choose_first<'a: 'b, 'b>(first: &'a i32, _: &'b i32) -> &'b i32 {
    first
  }

  fn main() {
    let first = 10;
    {
      let second = 20;
      println!("product: {}", multiply(&first, &second));
      println!("first: {}", choose_first(&first, &second));
    }
  }
  ```
  - `first` has a longer lifetime than `second`.
  - In `multiply`, Rust infers a lifetime that is as short as possible. The two
    references are then coerced into that lifetime.
  - In `choose_first`, `<'a: 'b, 'b>` reads as lifetime `'a` is at least as long
    as `'b`. `first` is coerced to lifetime `&'b` on return.
