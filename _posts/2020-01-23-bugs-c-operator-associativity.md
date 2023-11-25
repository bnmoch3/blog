---
title: "Bugs From ignoring C Operator Associativity"
slug: bugs-c-operator-associativity
description: "Mistakes were made"
category: Misc
tags: ["C"]
---

This is a quick post and it's here more or less to serve as a reminder to
myself, in case I make the same mistake again.

A while ago, I required a hash table for a LISP interpreter in C that I was
working on as part of the book _Build Your Own Lisp_ by Daniel Holden. Rather
than go straight for a library, I opted for
[this tutorial](https://github.com/jamesroutley/write-a-hash-table) so that I
could also learn more about how open-addressed hash-tables work.

For the sake of it, I wrote some tests with randomized inputs just to make sure
everything is set. And the tests failed horribly. Two key bugs emerged:

- Some keys kept on being indexed into the same slot over and over again despite
  that slot being already taken. The program then entered into an infinite loop.
  This is exactly the kind of problem double-hashing is designed to solve but in
  my case, it was failing horribly
- Other keys were being hashed into a negative integer which when used to access
  a slot in the underlying array resulted in a segmentation fault.

The culprits were these two functions below. When given a string, the current
number of slots (or buckets) in the hash-table and our current attempt at
finding an empty slot (starts at 0), `ht_get_hash` returns an integer which
serves as the slot index. It uses `ht_hash` to calculate this index:

```c
static const int HT_PRIME_1 = 151;
static const int HT_PRIME_2 = 163;

static int ht_hash(const char *str, const int a, const int m) {
    long hash = 0;
    const int len_str = strlen(str);
    for (int i = 0; i < len_str; i++) {
        hash += (long)pow(a, len_str - i + 1) * str[i];
        hash = hash % m;
    }
    return (int)hash;
}

int ht_get_hash(const char *str, const int num_buckets, const int attempt) {
    const int hash_a = ht_hash(str, HT_PRIME_1, num_buckets);
    const int hash_b = ht_hash(str, HT_PRIME_2, num_buckets);
    return (hash_a + (attempt * (hash_b + 1))) % num_buckets;
}
```

I was so convinced that the author had made some mistake somewhere in the
`ht_hash` function or even in `ht_get_hash` that I was just about to submit an
issue/bug report. Before doing so though, I ended spending a significant amount
of time reading data-structure books and watching lectures on youtube so as to
get a handle of open-addressing and double-hashing. Everything I came across
confirmed that the author was right as ever. The only factor left was that it
was I instead who made the mistake somewhere. Going through Routley's code line
by line, I identified my error in the following line:

```c
hash += (long)pow(a, len_str - i + 1) * str[i];
```

It was supposed to be:

```c
hash += (long)pow(a, len_str - (i + 1)) * str[i];
```

Moral of the story, ignore
[operator associativity (and even precedence)](https://www.programiz.com/c-programming/precedence-associativity-operators)
at your own peril.
