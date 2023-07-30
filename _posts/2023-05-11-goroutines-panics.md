---
layout: post
title:  "Handling panics from goroutines"
slug: goroutine-panics
date:   2023-05-11
tag: ["Golang"]
categories: Golang
excerpt_separator: <!--start-->
---

It's one thing to handle a panic that's occured within a function. It's an
entirely different affair to handle a panic that occured within a goroutine
that's been spawned.

<!--start-->

## Overview

I need to run a given function before exiting from a Go program, either during
graceful shutdown or whenever a panic occurs. If a panic occurs within a
goroutine, it's a bit tricky to get the exit/clean-up function at the caller to
be run. As it's critical for the restarting of the program and it involves
persisting some state to disk, the correct approach would be one of the
following:

1. Implement a recovery protocol: This is something DB system
   implementers/researchers would recommend since it's right up their alley.
   Recovery entails checkpointing some metadata during runtime and on restart,
   carry out a procedure to restore the system back into a consistent state.
   It's quite hard to get right. For example, what exactly would 'consistent'
   mean for a given system, or what if another crash occurs during recovery.
   Therefore, rather than haphazardly re-invent the wheel, a better approach
   would be to:
2. Use a database: Keep it simple, preferably a local/embedded one such as
   SQLite. After all, [files are hard](https://danluu.com/file-consistency/).

Option 1 is infeasible (for now :D). Option 2 is what I ended up going with but
not before running into the problem I mentioned in the introduction.

## Of Defers, Panics and Recovers

There are two kinds of errors: those that you expect and have accounted for, and
the unforeseen ones. And yes, this is very much obvious and should go without
saying. Now, given I'm in the early phase of this project, I tend to encounter
more of the latter as I'm still mapping out the problem space.

When a Go program encounters an unexpected error for which the best option is to
exit, the best course of action is to, well, exit:

```go
func doSomething() error {
	return fmt.Errorf("whoops")
}

func main() {
	defer fmt.Println("Clean up")
	if err := doSomething(); err != nil {
		fmt.Fprintf(os.Stderr, "Err occured: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("OK")
}
```

This outputs:

```
Err occured: whoops
exit status 1
```

However, explicit exits aren't a good idea when you've got deferred statements,
since they don't get run (such as in the preceding code sample). Hence the
preference for `panic` where need be:

```go
func doSomething() error {
	return fmt.Errorf("whoops")
}

func main() {
	defer fmt.Println("Clean up")
	if err := doSomething(); err != nil {
		panic(err)
	}
	fmt.Println("OK")
}
```

This outputs:

```
Clean up
panic: whoops

goroutine 1 [running]:
main.main()
        .../main.go:14 +0xed
exit status 2
```

If required, we can also recover from a panic and either handle the unexpected
error or return it to the caller who can figure out what to do with it. This is
quite useful and idiomatic for library code:

```go
func doSomethingElse() {
	panic("whoops")
}

func doSomething() (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("Unexpected error: %v", r)
		}
	}()
	doSomethingElse()
	return
}

func main() {
	err := doSomething()
	if err != nil {
		fmt.Println("err", err)
	} else {
		fmt.Println("OK")
	}
}
```

As an aside, while named returns should be avoided, this is one case where they
are useful (and necessary). If `doSomething` was written this way instead:

```go
func doSomething() error {
	var err error
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("Unexpected error: %v", r)
		}
	}()
	doSomethingElse()
	return err
}
```

The caller would incorrectly get `nil` error. The best explanation I've found as
to why this is the case is from this
[HN Comment](https://news.ycombinator.com/item?id=14669443):

> In Go "return v" copies v into the return location before calling the deferred
> code. If that location is not named, the deferred function has no way to
> change it

## Handling panics from goroutines

If the panic occurs within a goroutine, any deferred statements in the
spawner/parent don't get run. This is the problem I encountered:

```go
func doSomethingElse() {
	panic("whoops")
}

func doSomething(wg *sync.WaitGroup) {
	defer wg.Done() // ✅ gets run
	doSomethingElse()
}

func main() {
	defer fmt.Println("Clean up") // ❌ doesn't get run
	var wg sync.WaitGroup
	wg.Add(1)
	go doSomething(&wg)
	wg.Wait()
}
```

Recover within `main` doesn't cut it out since it only 'works when called from
the same goroutine as the panic is called in' as pointed out in this
[SO answer](https://stackoverflow.com/a/50409138). The are a couple of
solutions:

- On panic, figure out a way to return control back to main (iow, use recover
  within the goroutine)
- Have the goroutine call the cleanup function

I prefer the first solution since I want to centralize the responsibility for
cleaning up:

```go
func doSomethingElse() {
	panic("whoops")
}

func doSomething(done chan<- error) {
	defer func() {
		if r := recover(); r != nil {
			done <- fmt.Errorf("Unexpected error: %v", r)
		}
		close(done)
	}()
	doSomethingElse()
}

func main() {
	defer fmt.Println("Clean up")
	done := make(chan error)
	go doSomething(done)
	if err := <-done; err != nil {
		panic(err)
	}
	fmt.Println("OK")
}
```

## Just use a Recovery Protocol, or a Database

Note, in the above code sample and as previously mentioned, I have to use
`panic`. If I call `os.Exit` or a function such as `log.Fatal` (that in turn
calls `os.Exit`), the deferred statement doesn't get run and I'm back to square
one. Keeping track of all that is intractable for me. So for my case, I ended up
making it [someone else's](https://www.sqlite.org/wal.html) problem, and from
the look of things, they seem pretty great at
[handling it](https://www.sqlite.org/testing.html) :)

## References

1. Files are hard
2. Go by Example - Mark McGranaghan, Eli Bendersky:
   [Panic](https://gobyexample.com/panic),
   [Defer](https://gobyexample.com/defer) and
   [Recover](https://gobyexample.com/recover)
3. Defer, Panic and Recover - Andrew Gerran
   [link](https://go.dev/blog/defer-panic-and-recover)
4. Panics in libraries that spawn goroutines:
   [stack-overflow](https://stackoverflow.com/questions/70533828/panics-in-libraries-that-spawn-goroutines)
5. How do I handle panic in goroutines?
   [stack-overflow](https://stackoverflow.com/questions/54559189/how-do-i-handle-panic-in-goroutines)
