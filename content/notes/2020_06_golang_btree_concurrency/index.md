+++
title = "Go data-structure tricks: google/Btree"
date = "2020-06-29"
summary = "A couple of interesting approaches to concurrency and memory allocation from the Go google/btree package"
tags = ["Golang"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "go-btree-data-structure"
+++

I've been studying B-Tree implementations in Golang of late and the first one I
came across was Google's B-Tree package. It's entirely in-memory and meant to
serve as a more efficient, drop-in replacement for the
[llrb](github.com/petar/gollrb) package, which implements a red-black tree.
Before going further, if you aren't familiar with B-Trees, the following
[video](https://www.youtube.com/watch?v=C_q5ccN84C8) (12 min) provides a great
introduction, wikipedia does too.

## Memory allocation optimization

The first optimization used is the `FreeList`. From the documentation, the
`FreeList` is described as follows:

> FreeList represents a free list of btree nodes. By default each BTree has its
> own FreeList, but multiple BTrees can share the same FreeList.

If you've dabbled in C/C++ before, the FreeList here is kind of similar to the
[Pool Allocation strategy](http://www.buildyourownlisp.com/chapter16_bonus_projects#pool_allocation),
which, in order to reduce the cost of mallocs and memory fragmentation, a huge
chunk of memory is pre-allocated. The programmer then manually slices the memory
up by themselves. So that this doesn't up as an ad-hoc re-implementation of
`malloc`, it requires that the application requests for memory in fixed size
blocks. Once the application is done with some block of the memory, it can be
stored back into a list, a free-list if you will, and made available for later
use

However, google/btree's FreeList diverges from the pool allocation strategy
quite a bit. For one, nodes are _not_ pre-allocated at the start, rather, the
FreeList fills up only when nodes are deleted, which occurs during during
merging. Since there isn't a pre-allocated pool, when the btree requests for a
new node (such as during splitting) and the free-list is empty, `new` is called
directly. However, if there is an unused node lying around, it's returned
instead:

```go
func (f *FreeList) newNode() (n *node) {
	f.mu.Lock()
	index := len(f.freelist) - 1
	if index < 0 {
		f.mu.Unlock()
		return new(node)
	}
	n = f.freelist[index]
	f.freelist[index] = nil
	f.freelist = f.freelist[:index]
	f.mu.Unlock()
	return
}
```

The number of nodes within a free-list is constrained to its capacity, as we see
in the `freeNode` method below.

```go
// freeNode adds the given node to the list, returning true if it was added
// and false if it was discarded.
func (f *FreeList) freeNode(n *node) (out bool) {
	f.mu.Lock()
	if len(f.freelist) < cap(f.freelist) {
		f.freelist = append(f.freelist, n)
		out = true
	}
	f.mu.Unlock()
	return
}
```

By default, this capacity is 32 but it can be tuned based on the application's
btree usage patterns. Constraining the length of the free-list seems to be a
security mitigation against errant usage. If it were unbounded, an attacker, or
simply faulty code, could simply insert numerous entries then delete most of
them, leaving maybe one or two entries. However, since all the deleted nodes are
added to the free-list, those chunks of memory remain unavailable for other
parts of the application even though the btree won't be using them any time
soon.

## Concurrency optimization

On concurrency, the approaches highlighted here might or might not be an
optimization depending on the application's usage patterns. The documentation
isn't quite specific on how one should handle concurrent access. The most it
mentions is the following:

> Write operations are not safe for concurrent mutation by multiple goroutines,
> but Read operations are.

In some way, this is great. From the source code, all reads proceed without any
locking involved. However the documentation doesn't quite specify how one should
synchronize or even organize writes, this seems to be left up to the end-user.

Given the way the code is structured, a single writer with multiple concurrent
readers will not work since it leads to data races. Just to confirm that this is
the case using Go's race detector, I wrote and ran a quick
[script](gist.github.com/nagamocha3000/53a16151b17215ff0c5dae37636f5d56), which
you can check out.

One option for synchronizing concurrent reads interleaved with writes is simply
to tack on readers-writer locks wherever necessary and call it a day.

A better option (that doesn't involve modifying the source-code directly or
wrapping each and every public method), utilizes the `Clone` method provided so
as to implement some hackish form of
'[snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation)'. From
the documentation:

> Clone clones the btree, lazily. Clone should not be called concurrently, but
> the original tree (t) and the new tree (t2) can be used concurrently once the
> Clone call completes.

Reads can use the original 'snapshot', and synchronized writes can go into the
new clone. Once the writes are complete, new reads then shift to the new clone.
Furthermore, given the way the `Clone` function is structured, every
modification that occurs in the _original_ is not visible to any clones made -
all that the clones view is the old 'snapshot' just before cloning took place.
This is possible since in actuality, a `Clone` results in 3 trees, the original
itself becomes a clone, and it now gets to 'share' its old nodes (as the actual
'original' tree) with the new clone. The old nodes thus are rendered immutable
since neither the original nor the clones own them.

However, I'm probably using the wrong term here since this approach doesn't
quite provide the guarantees of snapshot isolation. For example, if you have a
reference to and modify an `Item` that's currently stored within one of the
nodes, both the original and the clone will view this change.

Lastly, I'd like to highlight an interesting fork of google/btree,
[tidwall/btree](github.com/tidwall/btree), do check it out if you're interested.
That's all for now