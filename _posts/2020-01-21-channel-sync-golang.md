---
title: "Go channels suffice for synchronization"
slug: go-channels-concurrency-sync
date: 2020-07-21
tags: ["Golang"]
excerpt_separator: <!--start-->
---

Or how to implement Futures/Promises in Go without having to juggle locks and
waitgroups

<!--start-->

Still new to Go, I often find myself reaching out for locks and waitgroups where
channels would suffice. Channels too can be used to provide mutual exclusion and
are more idiomatic. So as an exercise, once in a while I try to switch code
that's using Locks/Waitgroups into using channels, just to get used to them.

For example, let's consider the
[Workiva/go-datastructures/futures](github.com/Workiva/go-datastructures/tree/master/futures)
package. I'd define a _future_ as a sort of placeholder for a result that's
being computed asynchronously and might be accessed by multiple
threads/go-routines concurrently. Here's a better and simpler definition though
from Heather Miller & her students' book, _Programming Models for Distributed
Computation_:

> A future or promise can be thought of as a value that will eventually become
> available.

Alternatively, if you're already familiar with Javascript, futures are similar
to ES6 promises.

The `Workiva/futures`
[API](godoc.org/github.com/Workiva/go-datastructures/futures) is short enough
and is a great place to start from. The caller creates a Future value by
invoking `futures.New(completer, timeout)`. The `completer` argument is a
read-only channel through which the result is received asynchronously. The
`timeout` argument is there to avoid waiting for the result indefinitely. One
can then check whether the result is available by using the `HasResult` method.
If the result is available, it is retrieved using the `GetResult` method. If it
hasn't arrived yet, `GetResult` blocks until it's available or a timeout occurs.

```go
// Completer is a channel that the future expects to receive
// a result on.  The future only receives on this channel.
type Completer <-chan interface{}

type Future struct {...}

func New(completer Completer, timeout time.Duration) *Future

func (f *Future) HasResult() bool

func (f *Future) GetResult() (interface{}, error)
```

The Future struct has the following fields:

```go
type Future struct {
   triggered bool
   item      interface{}
   err       error
   lock      sync.Mutex
   wg        sync.WaitGroup
}
```

Once available, the result is stored in the `item` field. However, if a timeout
occurs, the `item` field is set to nil and the `err` field is set to a timeout
error. The `triggered` boolean is mainly used to check whether the result is
available. By default it's `false`. Once either the result is received or a
timeout occurs it's flipped to `true`. And we'll get to `lock` and `wg` soon
enough.

As already mentioned, the `futures.New` function is used to create a Future
instance. Internally, `New` launches a goroutine in which it waits for the
result. The code sample below has been trimmed to emphasize the key ideas. Also
observe that `f.wg` is incremented by 1 - `f.wg` will become relevant when we
get to the `GetResult` method.

```go
var errTimeout error = errors.New("timeout error")

func listenForResult(f *Future, ch <-chan interface{}, timeout time.Duration) {
   t := time.NewTimer(timeout)
   select {
   case item := <-ch:
       f.setItem(item, nil)
       t.Stop()
   case <-t.C:
       f.setItem(nil, errTimeout)
   }
}

func New(completer <-chan interface{}, timeout time.Duration) *Future {
   f := &Future{}
   f.wg.Add(1)
   // ...
   go listenForResult(f, completer, timeout)
   // ...
   return f
}
```

When the value arrives from the `completer` channel (or a timeout occurs), the
future's `setItem` method is called with the result. Now, this is where things
get interesting. The `setItem` method is defined as follows:

```go
func (f *Future) setItem(item interface{}, err error) {
   f.lock.Lock()
   f.triggered = true
   f.item = item
   f.err = err
   f.lock.Unlock()
   f.wg.Done()
}
```

Once `setItem` is done, all callers that were blocked on `GetResult` can now
read the value. Again, for the sake of completion, here's how `GetResult` is
defined:

```go
func (f *Future) GetResult() (interface{}, error) {
   f.lock.Lock()
   if f.triggered {
       f.lock.Unlock()
       return f.item, f.err
   }
   f.lock.Unlock()

   f.wg.Wait()
   return f.item, f.err
}
```

The usage of both the waitgroup and the lock can be replaced with channels.
We'll go through each one by one to see why they are there and how channels can
be used in an equivalent manner. Let's start with the waitgroup

The `wg` waitgroup (which was incremented to 1 during instantiation) is there to
make every goroutine that calls `GetResult` wait if the result isn't available.
Once available, i.e. when `setItem` invokes `f.wg.Done()`, all the goroutines
that were blocked can then proceed and read the result. Simply put, the
waitgroup is there for notifying blocked callers. The same can be achieved by
having callers block directly while trying to 'read' a value from a channel and
then closing the channel when the result is ready.

```go
type Future struct {
   // ...
   completed chan struct{}
}

func New(completer <-chan interface{}, timeout time.Duration) *Future {
   // Note that the channel is unbuffered
   f := &Future{
       completed: make(chan struct{}),
   }
   // ...
   go listenForResult(f, completer, timeout)
   // ...
   return f
}

func listenForResult(f *Future, ch <-chan interface{}, timeout time.Duration) {
   t := time.NewTimer(timeout)
   select {
   case item := <-ch:
       f.setItem(item, nil)
       t.Stop()
   case <-t.C:
       f.setItem(nil, errTimeout)
   }
   close(f.complete) // broadcast completion
}

func (f *Future) GetResult() (interface{}, error) {
   f.lock.Lock()
   if f.triggered {
       f.lock.Unlock()
       return f.item, f.err
   }
   f.lock.Unlock()

   <-f.completed // blocks until either value is sent or channel is closed
   return f.item, f.err
}
```

As [specified](yourbasic.org/golang/broadcast-channel/), channels are safe for
concurrent receives and all reads from a closed channel receive the zero value.
Also note that `f.completed` is an empty `struct{}` channel to indicate that
it'll be used solely for signaling rather than sending or receiving any actual
values.

Now, for the locks. The `f.lock` is used to ensure that data races don't occur.
Data races fall under _race conditions_ which are a kind of concurrency bug.
Alan Donovan's and Brian Kernighan's 'The Go Programming Language' book provides
the following description of both race conditions and data races: "A race
condition is a situation in which the program does not give the correct result
for some interleavings of the operations of multiple goroutines. Race conditions
are pernicious because they may remain latent in a program and appear
infrequently, perhaps only under heavy load or when using certain compilers,
platforms, or architectures. This makes them hard to reproduce and diagnose... A
data race occurs whenever two goroutines access the same variable concurrently
and at least one of the accesses is a write".

Hence the locks used above. When `setItem` writes to `f.item`, `f.triggered` and
`f.error`, the locking guarantees that it has exclusive 'ownership' of these
variables and no other goroutine is trying to read or write to those variables
at that instance. Once `setItem` has written the result and unlocked the Lock,
other goroutines can then read them safely without causing any data races.

As earlier mentioned, channels too can be used to guarantee mutual exclusion.
Given how the `Future` object is structured, we end up with the following key
factors:

- A write occurs only once throughout the lifetime of a `Future` object, that is
  when either the result arrives or a timeout occurs.
- All reads should occur only after the write above has been completed in order
  to avoid data races.

These two factors provide a guideline for our concurrency approach. Now let's
shift our attention to channels, particularly unbuffered channels such as the
one we've already used above. To reference _The Go Programming Language_ book
again: "A send operation on an unbuffered channel blocks the sending goroutine
until another goroutine executes a corresponding receive on the same channel, at
which point the value is transmitted and both goroutines may continue.
Conversely, if the receive operation was attempted first, the receiving
goroutine is blocked until another goroutine performs a send on the same
channel".

This is exactly what we need, a means of blocking the readers accessing a
`Future`'s internal variables until the write has been completed. Better yet, we
don't even need to send any value to the channel in our case, we can simply
_close_ the channel and all currently blocked readers can proceed. Moreover,
future readers don't have to acquire a lock, since as already mentioned,
receives from a closed channel get the zero value. With all these mind, the code
can then be simplified into the following. Note that we are reusing the
`f.completed` channel and the `setItem` helper method is no longer required:

```go
type Future struct {
   item      interface{}
   err       error
   completed chan struct{}
}

func (f *Future) GetResult() (interface{}, error) {
   <-f.completed
   return f.item, f.err
}

func (f *Future) listenForResult(ch <-chan interface{}, timeout time.Duration) {
   t := time.NewTimer(timeout)
   select {
   case item := <-ch:
       f.item = item
       t.Stop()
   case <-t.C:
       f.err = errTimeout
   }
   close(f.completed)
}
```

Just to assuage any doubts I had, I used Go's data-race detector to test out the
channels version. As expected, it did not find any data-races. I also
benchmarked the locking+waitgroup version versus the channels version; both had
similar performance but the former was slightly faster by a couple of
nanoseconds. And that's it! If you've enjoyed this post, do check out Go101's in
depth [post](go101.org/article/channel-use-cases.html) on all the other
interesting ways you can use channels in Go. Cheers!
