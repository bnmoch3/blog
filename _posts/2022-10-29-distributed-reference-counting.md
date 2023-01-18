---
layout: post
title:  "Distributed Reference Counting"
category: Distributed Systems
excerpt_separator: <!--start-->
---

<!--start-->

## Reference counting basics

I'll go ahead and use the name of the thing to describe the thing: reference
counting refers to keeping track of the count of references to an object. It's
usually used in Automatic Memory Management whereby once the reference count of
an object reaches 0, the underlying resources for that object are freed. Python
uses reference counting therefore it might be a great place to see this
technique in action:\
`sys.getrefcount` is used to get the reference count of an object. Whenever an
object such as a list or a tuple is created, it starts out with a reference
count of 1. When it's passed to a function as an argument, the reference count
is incremented by 1, and that is why 2 is returned below.

```
>>> import sys
>>> t = (1,2,3)
>>> sys.getrefcount(t)
2
```

If we assign `t` to another variable, the reference count is incremented:

```
>>> t2 = t
>>> sys.getrefcount(t)
3
```

Finally, if we set `t2` to `None`, the number of references to the underlying
object is reduced by 1:

```
>>> t2 = None
>>> sys.getrefcount(t)
2
```

Once an object is deallocated, if it held references to other objects, the
reference count for those objects are in turn decremented and those objects may
be deallocated too if their reference counts reach 0 [1].

## Distributed Reference Counting

In some scenarios, it might be useful to extend reference counting to
distributed systems - for example, if we want to minimize data-movement for
large objects by passing references. This though introduces some new challenges
since the objects might not reside in the same address space or machine as the
reference[6].

A simple implementation for Reference Counting in a distributed context is to
use the same basic approach across nodes:

- Each object has an owner.
- Every creation of a new reference to this object, duplication and deletion of
  the reference requires an increment/decrement message to be sent to the owner
  of the object so that it can update the reference count [3]
- Obvious downsides: the network is not reliable: the increment/decrement
  messages can be dropped, duplicated or delivered out of order thus resulting
  in various inconsistencies. For example, an object's reference count being
  decremented to zero and getting deleted but then later on, an increment
  message being delivered for the same object.

## Weighted reference counting

A different variant for distributed reference counting is Weighted reference
counting [3,4,5]:

Objects have an associated weight that's first set to the total weight, usually
a power of two to simplify division.

```python
class WeightedRefCountedObject:
    DEFAULT_WEIGHT = 1 << 16
    def __init__(self, val: Any):
        self._val = val
        self._weight = self.DEFAULT_WEIGHT

    def drop_weight(self, amount:int):
        self._weight -= amount
        if self._weight == 0:
            del self._val

    def add_weight(self):
        self._weight += self.DEFAULT_WEIGHT
```

When the first reference to an object is created, its weight is initialized to
the object's total weight. Whenever this reference is cloned, half of the weight
goes to the new reference and half of the weight stays with the old reference.
This is an improvement over the basic counting approach since references can be
cloned upstream without having to coordinate with the owner (via increment
messages).

```python
class Reference:
    def __init__(self, obj: WeightedRefCountedObject, weight: Optional[int] = None):
        self._obj = obj
        if weight is None:
            self._weight = obj._weight
        else:
            self._weight = weight

    def clone(self) -> "Reference":
        halved_weight = self._weight >> 1
        self._weight = halved_weight
        return Reference(self._obj, halved_weight)

    def delete(self):
        self._obj.drop_weight(self._weight)
```

Whenever a reference is deleted, the underlying object's weight is decremented
by the reference's weight (decrement messages have to be sent to the object's
owner). Consequently, the weight of the object is always equal to the sum of all
the non-deleted references' weights.

```python
obj = WeightedRefCountedObject((1,2,3))
ref0 = Reference(obj)
ref1 = ref0.clone()
ref1.delete()
ref0.delete()
```

Since there are no increment messages (only decrement), this scheme is not
susceptible to inconsistencies that arise from out-of-order delivery of
messages. However it assumes that decrement messages are delivered reliably.

## Indirect reference counting

As we've seen, one advantage of weighted reference counting is that references
can be cloned upstream without having to coordinate with the object's owner.
This approach can be loosely ported back to basic reference counting via
indirect reference counting[7].\
Each reference keeps two fields:

- strong locator (indirect): points to the sender of the reference (could be the
  owner, or an intermediary)
- weak locator (direct): points to the owner of the object

The strong locator is used only for distributed garbage collection - cloning a
reference can be done without having to involve the owner[7]. When the receiver
deletes their reference, they send the message to the intermediate node; when
the receiver want to access the object, they use the weak locator instead.

## Reference Listing

Another alternative to basic reference counting is reference listing. In this
method, the owner of an object keeps a list of every client that holds a
reference to that object[7]. Clients send _insert_ and _delete_ messages rather
than increment/decrement messages. This increases fault-tolerance in a couple of
ways:

- insert/delete messages are idempotent in that clients can send them several
  times and owners can simply ignore superfluous messages.
- if an owner supposes that a reference is stale/dangling, it can ping the
  client to check if the client has crashed.

## References

1. Garbage Collector Design - Python Developer's Guide:
   [link](https://devguide.python.org/internals/garbage-collector/)
2. NeXeme: A Distributed Scheme Based on Nexus - Luc Moreau, David De Roure,
   Ian: Foster
   [pdf](https://link.springer.com/content/pdf/10.1007/BFb0002787.pdf)
3. Distributed Garbage Collection Algorithms - Stefan Brunthaler:
   [link](https://www.semanticscholar.org/paper/Distributed-Garbage-Collection-Algorithms-Brunthaler/66e5dc537ac205ee73c9d907620df2ec9646f139)
4. Reference counting - Weighted Reference Counting - Wikipedia:
   [link](https://en.wikipedia.org/wiki/Reference_counting#Weighted_reference_counting)
5. Weighted Reference Counting - jimsynz:
   [link](https://gist.github.com/jimsynz/bf0983f2d9fdc65554bcbe2a6c2042ea)
6. Distributed Garbage Collection - Memory Management Reference:
   [link](https://www.memorymanagement.org/glossary/d.html#term-distributed-garbage-collection)
7. A Survey of Distributed Garbage Collection Techniques - David Plainfoss, Marc
   Shapiro: [pdf](https://hal.inria.fr/hal-01248224/file/SDGC_iwmm95.pdf)
