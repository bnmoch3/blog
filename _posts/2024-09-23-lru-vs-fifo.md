---
layout: post
title:  "LRU vs FIFO (with Lazy Promotion and Quick Demotion)"
slug: lru-vs-fifo
tag: []
categories: "Cache Systems"
excerpt_separator: <!--start-->
---

Sprinkling some lazy promotion and quick demotion on FIFO

<!--start-->

Today's paper is
"[FIFO can be Better than LRU: the Power of Lazy Promotion and Quick Demotion](https://dl.acm.org/doi/10.1145/3593856.3595887)"
authored by Juncheng Yang and co. With FIFO, the oldest object in the cache is
the first one to be evicted; with LRU, it's the least recently used object The
advantages of FIFO over LRU were already teased out in their previous
[paper](https://www.usenix.org/conference/osdi20/presentation/yang), what we're
getting here is a much more extensive evaluation plus two new-ish techniques.

When analyzing cache efficiency, the two key metrics usually considered are
_miss ratio_ and _throughput_ (number of requests served per a given period).
With the latter metric, FIFO has the following advantages over LRU [1]:

- Less computation particularly on cache hits
- Fewer metadata to keep track of and update per object cached
- More scalable - less likely to be the bottleneck as number of threads
  increases

However, it's often assumed that plain FIFO has worse performance (higher miss
ratio) compared to LRU. The question then is how can this performance gap be
addressed. The authors propose two techniques: **lazy promotion** and **quick
demotion**.

To understand these 2 techniques, let's consider a generic cache. As users, we
can insert objects into the cache and remove them either explicitly or
implicitly via TTLs. Regardless of the underlying algorithm, all caches maintain
some internal notion or measurement for which objects are more valuable and
which ones are less valuable and can be evicted if need be. Whenever the cache
increases its valuation of some object, we say that the object has been
_promoted_; when the value is decreased, we say it's been _demoted_.

Let's consider textbook LRU. Whenever there's a cache hit, the object accessed
is moved to the head of the list. As such, LRU carries out promotion explicitly
(moving the object to the head) - demotion is implicit, passive and kind of
drawn-out (all other objects are shifted backwards).

The authors argue that we should gun for the opposite: lazy promotion and quick
demotion.

## Lazy Promotion

Let's start with Lazy Promotion. With plain FIFO, regardless of how popular an
object is, as newer objects get inserted, the popular object gets closer and
closer to eviction. We don't want to carry out some form of promotion with every
cache hit since it means we're doing more work per request hence we end up
handling fewer requests per second. Instead, we keep around some tiny metadata,
even a bit or two-bits that indicate the object is popular. Then when it's about
to get evicted, we instead re-insert it (i.e. promote it) and reset the
popularity metrics. In fact, if you took LRU, applied lazy promotion and instead
of a queue, you've got a circular buffer and a 'hand', you'd end up with
[Clock](https://en.wikipedia.org/wiki/Page_replacement_algorithm#Clock).

## Quick Demotion

Quick Demotion entails removing low value objects as soon as possible rather
than keeping them around in the cache. The authors make the following
observation: "Because demotion happens passively in most eviction algorithms, an
object typically traverses through the cache before being evicted. Such
traversal gives each object a good chance to prove its value to be kept in the
cache. However, cache workloads often follow Zipf popularity distribution with
most objects being unpopular ... We believe the opportunity cost of new objects
demonstrating their values is often too high: the object being evicted at the
tail of the queue may be more valuable than the objects recently inserted" [1].
I'd rephrase it as follows: newer objects are more likely to be of low value
compared to older objects hence caching algorithms should first consider newer
ones for eviction. Also, the authors point out that QD delivers the most gain
when the cache size is large, objects are short-lived and the underlying cache
algorithm is not quite efficient.

## Implementing QD

![Implementing quick demotion](/assets/images/caching/quick_demotion.svg)

The diagram above provides an overview of how QD can be implemented. A couple of
points worth adding: the main cache uses 90% of the space and the probationary
queue uses 10%. Also, the ghost queue stores as many entries as the main cache.
On configuring the size of the ghost queue, you'd have to assume all objects
have the same size; veering off from this assumption seems to be left as an
exercise for the dear reader :)
