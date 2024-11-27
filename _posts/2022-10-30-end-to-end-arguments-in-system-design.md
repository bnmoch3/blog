---
layout: post
title:  "End-to-End Arguments in System Design"
slug: end-to-end-arguments-in-system-design
tag: ["Distributed Systems"]
category: Distributed Systems
excerpt_separator: <!--start-->
---

Paper Review

<!--start-->

The classic paper
['End-to-End arguments in System Design'](https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf)
presents the end-to-end argument, a design principle that states functionality
should be moved "closer to the application that uses the function" i.e. at the
endpoints.

> The function in question can completely and correctly be implemented only with
> the knowledge and help of the application standing at the end points of the
> communication system. Therefore, providing that questioned function as a
> feature of the communication system itself is not possible.

This is because:

> functions placed at low levels of a system may be redundant or of little value
> compared with the cost of providing them at that low level.

In a layered system, there are various levels where functionality can be
implemented:

- at the communication subsystem
- by the client (endpoints)
- the client jointly coordinating with the lower levels
- redundantly at each level

Some of these functionalities include:

- message sequencing (FIFO)
- message deduplication
- guaranteed message delivery
- detecting node failures
- detecting message corruption (checksumming)
- retries
- encryption
- effectively once execution of an operation (e.g. via idempotency and/or
  deduplication) [4]
- e.t.c

The authors are not entirely against implementing functionalities at lower
levels, just that we shouldn't expect (and burden) these levels with capturing
and reliably guaranteeing all the different kinds of requirements that our
applications have. Implementing some functionality in the lower layers can be
useful for optimizing performance (in some carefully evaluated cases). However,
we should proceed with caution since applications that don't need that
functionality still have to pay for it. Furthermore, certain functionalities
require information that can only be surfaced at the endpoints.

## Reference

1. End-To-End Arguments In System Design - Saltzer, Reed, Clark:
   [pdf](https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf)
2. Paper Summary: End-to_end Arguments in System Design - Dominik Tornow:
   [post](https://temporal.io/blog/paper-summary-end-to-end-arguments-in-system-design)
3. End-to-End arguments in System Design - The Morning Paper - Adrian Coyler:
   [post](https://blog.acolyer.org/2014/11/14/end-to-end-arguments-in-system-design/)
4. The End-to-End Arguments for Databases - Designing Data-Intensive
   Applications - Martin Kleppmann - Book
