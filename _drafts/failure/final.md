# Failure in Distributed Systems

> "I can accept failure. Everyone fails at something. But I can't accept not
> trying." ― Michael Jordan

Let's start of with a classic paper from Jim Gray:

## Why do Computers Stop and What Can be Done About it

[Why do Computers Stop and What Can be Done About it - Jim Gray](https://www.hpl.hp.com/techreports/tandem/TR-85.7.pdf)

- "An analysis of the failure statistics of a commercially available
  fault-tolerant system shows that administration and software are the majore
  contributors to failure"
- Approaches to software fault-tolerance: process-pairs, transactions and
  reliable storage.
- "faults in production software are often soft(transient) and that a
  transaction mechanism combined with persistent process-pairs provides
  fault-tolerant execution"
- "Reliability and availability are different: Availability is doing the right
  thing within the specified response time. Reliability is not doing the wrong"
  As far as words and meanings go, can one swap availability with liveness and
  reliability with safety?
- Expected reliablity is proportional to the Mean Time Between Failures (MTBF)
- A failure has some Meant Time To Repair (MTTR)
- Availability can be define as the probability that the system will be
  available, i.e. `(MTBF / (MTBF + MTTR))`.
- Jim Gray provides a formula for high availability wrt hardware failure:
- The key to high availability is modularizing the system such that _modules_
  are the unit of failure and replacement. In a system that is effectively
  modularized, failure within a module only affects that module. The failure
  should be _fail-fast_: either the module does the right thing or stops. Spare
  modules are then kept around for redundancy such that when an active component
  fails, the spare module kicks in.
- However, he notes that the major sources of failure remain: "software and
  operations." this is a polite way of saying, "programmers"
- Commercial fault-tolerant system.
- One third of failures are "Infant mortality" failures - a product having a
  recurring problem - new software or hardware product still having the bugs
  shaken out. (Choose boring software)
- System administration includes operator actions, system configration and
  system maintainenance was the main source of failures - 42%. (Dan Luu flags,
  Redpanda configuration, paper on configuration, Mipsytipsy - developers should
  also learn how their software is ran in the wild)
- Jim Gray presents the proportions as is though he notes that some numbers are
  definitely under-reported.
- Human failures:
  - Failures from maintainenance - maintainenance person typed the wrong command
    or unplugged the wrong component.
  - System operators
  - System configuration
- Software faults are a major source of system outages - 25% in all.
- Environmental failures for example power outages.

## System Administrators are reliable

You might expect the take away to be something like, software developers should
be more disciplined or that system administrators should be more precise.
Instead, Gray offers a rather modest suggestion: "the key to high-availability
is tolerating operations and software faults". Given that software is increasing
in complexity:

> The top priority for improving system availability is to reduce administrative
> mistakes by making self-configured systems with minimal maintainenance and
> minimal operator interaction. Interfaces that ask the operator for information
> or ask him to perform some function must be simple, consistent and operator
> fault-tolerant.

> Dealing with system configuration, operations and maintainenance remains an
> unsolved problem. Adminstration and maintainenance people are doing a much
> better job than we have reason to expect. We can't hope for better people. The
> only hope is to simplify and reduce human intervention in these aspects of the
> system.

- Dan Luu flags
- Redpanda single binary
- Elasticsearch single binary
- Redpanda configuration
- Mipsytipsy, developers should run their own software in production.

## New software is Reliable

Given that software and administration errors are the dominant cause of failure,
Gray notes that:

> New and changing systems have higher failure rates. Infant products
> contributed one third of all outages. Maintenance caused one third of the
> remaining outages. A way to improve reliability is to install proven hardware
> and software, and then leave it alone. As the adage says "If it's not broken
> don't fix it".

Well, nowadays we've got a cool club for folks that swear by this principle -
[The Boring Technology Club](https://boringtechnology.club/). In brief, we
should think about innovation as a _scarce_ resource; the cost of unnecesarily
adopting new technology far outweights the excitement we get out of it. As
always, the focus should be on solving 'business problems', i.e. what keeps the
lights on.

> software that’s been around longer tends to need less care and feeding than
> software that just came out ... the failure modes of boring technology are
> well-understood - Choose Boring Technology, Dan McKinley

## Upgrades are reliable

On the other hand, Gray notes that:

> a Tandem study found that a high percentage of outages were caused by "known"
> hardware or software bugs, which had fixes available, but the fixes were not
> yet installed in the failing system. This suggests that one should install
> software and hardware fixes as soon as possible.

This brings about a contradiction: how should one balance _leaving_ working
software alone while being expected to _upgrade_ it every once in a while.

- upgrades failures paper
- snowflake cloud managing upgrades
- postgres major upgrade.

## What is to be done: Software fault-tolerance

In the last half of the paper, Gray introduces the concept of _Software
fault-tolerance_. At a high level, this involves:

1. Software modularity through processes and messages
   - decompose large systems into modules
   - each module is both a unit of service and a unit of failure
   - failure of a module should not propagate beyond the module
2. Fault containment through fail-fast software modules.
   - software should either function correctly or detect faults, signal failure
     and stop completely
   - This guideline implies defensive programming: check all inputs,
     intermediate results, outputs and data-structers.
   - Fault-containment is achieved by isolating the software's state from other
     processes.
3. Process-pairs to tolerate hardware and transient software faults.
   - Most hardware faults are soft i.e. transient. The usual way of dealing with
     such faults is through error-correction, checksums and retries.
   - Gray conjectures that most software faults are also, well, _soft_; if the
     program is reinitialized and the operation retried, the fault does not
     occur again.
   - Gray referes to such bugs as _Heisenbugs_ - bugs that 'go away' when you
     'look' at them. Such bugs are contrasted with _Bohrbugs_: "like the Bohr
     atom, are solid, easily detected by standard techniques, and hence boring".
     In the modern day, these techniques include static typing, linting,
     testing, reviews etc.
4. Transaction mechanism to provide data and message integrity
5. Transaction mechanism combined with process-pairs to ease exception handling
   and tolerate software faults.

The 4th and 5th software tolerance techniques are interesting in that Gray is
suggesting that generic software that should be fault-tolerant should adopt
transaction mechanisms i.e. database-centric techniques.

Transactions are defined in the following way:

> A transaction is a group of operations, be they database updates, messages, or
> external actions of the computer, which form a consistent transformation of
> the state.

Gray then states:

> The programmer's interface to transactions is quite simple: they start a
> transaction by asserting the BeginTransaction verb, and ends it by asserting
> the EndTransaction or AbortTransaction verb. The system does the rest.

So this implies the use of a database to some level that can provide ACID
guarantees.

There are many cases where building upon a database aids immensely in software
fault-tolerance. We've got the usual 3-tier architecture. And there are a couple
of non-'traditional' scenerios where you could try rubbing a database on:

- Using sqlite as the application's file format
  ([SQLite competes with fopen()](https://www.sqlite.org/fasterthanfs.html)).
  Also worth checking out
  [How SQLite Helps You Do ACID](https://fly.io/blog/sqlite-internals-rollback-journal/)
- How about building the entire application _in_ the database as is the case
  with [MyTunes](https://riffle.systems/essays/prelude/). All the program state
  is stored in the database, including ephemeral data such as UI state.

## The Network is Reliable

> Communications lines are the most unreliable part of a distributed computer
> system. Partly because they are so numerous and partly because they have poor
> MTBF (Mean Time Before Failure). The operations aspects of managing them,
> diagnosing failures and tracking the repair process are a real headache - Gray

## The storage is reliable
