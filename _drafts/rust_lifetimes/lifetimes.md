# Lifetimes

## Quotes from Lifetime kata

For every type T, there are two types of references to it:

- &T: A shared reference (often called a shared borrow) of T. You can have as
  many of these as you'd like, but they do not allow you to modify the data they
  refer to.
- &mut T: A mutable reference (often called an exclusive borrow) of T. You can
  only have one of these at a time, but they allow you to modify the data they
  refer to.

Danglin reference: a reference to a value that no longer exists.

Rust referfence are guaranteed to always to refer to something that still exists
(i.e. has not been dropped/freed/gone out of scope);

- A neat way of thinking about dangling references from [Lifetimes kata](TODO):
  the _region_ of code where the reference is _live_ is larger than region where
  the value is live. This also applies to lifetimes since they can be defined as
  the region of code where a variable exists.

## Lifetime ellision

Lifetimes can be inferred in the following cases:

1. No output references
   - in this case, the lifetimes of the arguments do not need to relate to each
     other
2. Only once reference in the input
   - suppose you are returning a reference from a function. This reference can't
     be of a value that function owns otherwise it will be dangling reference.
     Therefore, the reference is derived/related to one of the input references.
     If there is only one input reference, the lifetime of the returned
     reference is inferred to be the same as the input.
   - If there are more than 1 output references in the above case, they all get
     the same lifetimes as the single input reference.
   - Additionally, if all the input references have the same lifetimes, the
     output reference is also assigned the same lifetime.

## Mutable references and containers

- go through this chapter again:
  https://tfpk.github.io/lifetimekata/chapter_4.html
- read on how rust 'extends' lifetimes
- when you have a function that takes in a `&mut Vec<&i32>` what lifetimes does
  it infer for both the container and the elements, does it infer the same
  lifetimes or different lifetimes.
- std::mem::swap(), will crichton

## Lifetimes on Structs and enums

- If a stuct or enum contains references, we need to specify their lifetimes

## Lifetimes on impls

- Consider the following:

```rust
struct Pair<'p> {
  x: &'p i32,
  x: &'p i32,
}

impl<'a> Pair<'a> {
  // ...
}
```

- I previously assumed that annotating the lifetime twice for `impl` felt
  repetitive hence unnecessary. However, from [lifetimekata], I learnt that the
  first part (`impl<'a>`) defines a lifetime `'a` but does not specify what that
  lifetime is. The second annotation (`Pair<'a>`) specifies that the references
  in `Pair<'p>` must live for the `'a'` lifetime.
- The third lifetime ellision rule: Given an `impl` block:
  > If there are multiple lifetime positions but one of them is `&self` or
  > `&mut self`, the lifetime of the borrow is assigned to all the ellided
  > output lifetimes - lifetimekata
- As lifetimekata further explains: if you take in many references in your
  > arguments, Rust will assume that any references you return come from `self`,
  > not any of those other input references.

## Static lifetimes

- `'static`
- `&'static str`
- const

## Placeholder lifetimes

- check out C7 of the lifetimes kata
- for the case, turns out, just as I had assumed earlier, there are cases where
  lifetime annotations for `impl` are superfluous/repetitive. For example,
  consider: TODO C7

## Lifetime bounds

- `where 'a: 'b`, i.e. a outlives b or whenever a reference with b is valid, one
  with a must also be valid.

## Misc

- Implement trait only for references of T

## Anonymous lifetimes

- tell compiler to guess the lifetime, and only works where there's one possible
  guess

## References

- Lifetime kata: https://tfpk.github.io/lifetimekata/
- The Rust borrow checker is annoying pt 2:
  https://runa.yshui.dev/lifetime-p2.html
- Difference between into_iter and iter:
  https://stackoverflow.com/questions/34733811/what-is-the-difference-between-iter-and-into-iter
- What are move semantics in Rust:
  https://stackoverflow.com/questions/30288782/what-are-move-semantics-in-rust
- Obscure Rust: reborrowing is a half-baked feature:
  https://haibane-tenshi.github.io/rust-reborrowing/
- Rust: A unique perspective:
  https://limpet.net/mbrubeck/2019/02/07/rust-a-unique-perspective.html
- Difference between references and pointers:
  https://ntietz.com/blog/rust-references-vs-pointers/
