---
layout: post
title:  " Notes on 'A large scale analysis of hundreds of in-memory cache clusters at Twitter'"
slug: large-scale-analysis-caching-twitter
tag: []
categories: "Cache Systems"
excerpt_separator: <!--start-->
---

TTLs are prevalent, object sizes are small, metadata overhead can be large,
object sizes change, FIFO is better than LRU, you've got to address memory
fragmentation

<!--start-->

The following are my key take-aways from the paper "[A large scale analysis of
hundreds of in-memory cache clusters at
Twitter]"(https://www.usenix.org/conference/osdi20/presentation/yang) authored
by Juncheng Yang, Yao Yue and K.V Rashmi.

I find the paper worth reading for three reasons: First, I'm currently
interested in caching systems and one of the authors, Juncheng Yang, has done
some great research on the caching (check out [s3-fifo](https://s3fifo.com/) and
[sieve](https://cachemon.github.io/SIEVE-website/)). Secondly, based on the
title of the paper, I'm expecting to learn other metrics and means for
evaluating cache systems beyond miss ratio - they might come in handy when I'm
carrying out evaluations for my own systems. And third, the next paper I'll work
through is
[Segcache](https://www.usenix.org/conference/nsdi21/presentation/yang-juncheng);
it's written by the same authors, so I'm treating this paper as an extended
'motivation' section for segcache, or to put it differently, this paper is the
"why" and the segcache one is the "how".

Back to the paper. The goal of the authors is to "significantly further the
understanding of real-world cache workloads by collecting production traces from
153 in-memory cache clusters at Twitter, sifting through over 80 TB of data, and
sometimes interpreting the workloads in the context of the business logic behind
them".

In brief, here are my key take-aways:

## TTL Usage Is Prevalent:

TTLs are prevalent in the "real world" yet often ignored in academic research.

Programmers tend to use TTLs for 3 purposes:

- Bounding inconsistency: With TTLs, programmers ensure that cached inconsistent
  versions are not kept around forever whenever writes/updates fail and once
  they expire, the current version will be retrieved and the cache will be
  consistent with the source of truth such as the database. Usually, updating
  the cache tends to be on a best-effort basis since adding retries slows stuff
  down
- Implicit Deletion: Certain objects such as rate limiters are only valid within
  a given time period. TTLs relieve clients the burden of having to issue an
  explicit delete operation
- Periodic Refresh: I'm guessing this usage is specific to Twitter - certain
  kinds of data (e.g. recommending who to follow based on your most recent
  activity) needs to be as fresh possible but computing it is expensive -
  setting TTLs to certain values ensures balancing of freshness and efficient
  usage of computational resources. Maybe I'm missing something but I'm curious
  why coordinating freshness and compute usage couldn't be pushed to the
  database/map-reduce system.

Why should system researchers and even industry pay attention to TTLs? Glad you
asked: objects that have expired but are yet to be evicted take up memory that
might otherwise be used to cache other objects. In fact, as the authors note:
"efficiently removing expired objects from cache needs to be prioritized over
cache eviction". Therefore it's worth exploring efficient algorithms &
data-structures for organizing and expiring TTL-bound objects.

## Write-Heavy Workloads are Common

Cache usage is not purely read-heavy, for certain settings, writes encompass a
significant chunk of the workload. On a similar note, caches aren't just used as
stores for database results, they're also used for transient data (rate
limiters, deduplication etc) and for computation and stream processing.

## FIFO is better than LRU

We've seen that we need to pay attention to TTLs. That doesn't mean we ignore
cache eviction algorithms entirely. LRU is usually the go-to - easy to
understand and widely implemented. What about FIFO? Now, unless the cache size
is very very very small, the authors observe that FIFO's performance (miss
ratio) is quite similar to LRU. What makes FIFO worth opting for is that it's
easier to implement, it's faster, more amenable to concurrent access and
requires tracking and updating less metadata size per object. In my previous
post on [Anti-Caching](https://bnm3k.github.io/blog/anti-caching), we saw how
LRU overhead has to be accounted for and worked around. Juncheng Yang and co.
have a better proposal, ditch LRU entirely (if your cache size is large enough
for your workload) and switch to FIFO.

Speaking of object metadata sizes:

## Object Size

Majority of objects tend to be small. With lots of tiny objects getting cached,
the size of the metadata kept around for each object starts adding up. Therefore
it's worth exploring methods for minimizing object metadata overhead. For
example, given that Clock Replacement approximates LRU's behaviour, some systems
opt for clock since it requires less metadata to keep and around and update per
object.

## Key Size vs Value Size

On the same note, the authors observe that "compared to value size, key size can
be large in some workloads. For 60% of the workloads, the mean key size and mean
value size are in the same order of magnitude". Also programmers tend to prepend
namespaces to key IDs, eg `NS1:NS2:...:id`. Both observations mean it's worth
exploring key compression methods. I would consider
[FSST](https://dl.acm.org/doi/10.14778/3407790.3407851) for key compression -
it's a lightweight string-specific compression scheme that supports efficient
equality checks.

## Memory Fragmentation & Object Size Distribution

A key consideration of caching is to use memory efficiently - if we had infinite
memory, then we wouldn't have to worry about eviction or even expiring TTL-bound
objects. Sadly, as any economist would tell you, resources are scarce and so is
memory.

Relying purely on heap memory allocators such as Jemalloc "can cause large and
unbounded external memory fragmentation". As such, some caches use custom memory
management that are tuned better for their workloads. For example, Twitter's
caches used slab memory allocators - objects are categorized into various
classes based on their size and objects within the same size class occupy the
same set of slabs. If object size distribution remains static across some given
period, this approach works quite well and minimizes fragmentation. However, the
authors observe that this isn't always the case. For example, tweets from German
users tend to be larger in size than tweets from Japanese users (is Japanese
language more succinct? idk). Therefore at certain hours the consequent values
cached tend to be larger than at other times. Now, if more slabs are locked into
a given class size and we don't have a way to track object size distribution
changes and migrate slabs across size classes, then we end up with poor usage of
memory. This problem has been identified and addressed to some extent in
industry - the question that remains is, can we do better?

## Request Rates and Hot Keys

Cache request rates spiking does not necessarily mean it's related to hot keys
(a common assumption which in turn informs cache designs and usage). It might be
caused by other factors, such as a bug or user change behaviour.

## Miss Ratio Stability

From the paper: "a cache with a low miss ratio most of the time, but sometimes a
high miss ratio is less useful than a cache with a slightly higher but stable
miss ratio". Also, "extremely low miss ratios tend to be less robust, which
means the corresponding backends have to be provisioned with more margins". All
this is to say, cache systems that are predictable make work easier for
operators and it's worth paying attention to the live production aspects of
caches, not just the theoretical bits.

That's it for now, do stay tuned for my overview of the segcache paper.
