---
layout: post
title:  "Getting started with TLA+"
slug: getting-started-tla
tag: ["TLA"]
category: Distributed Systems
excerpt_separator: <!--start-->
---

<!--start-->

I've been picking up some TLA+. Partly to learn writing my own specifications
for model-checking, partly to be able to work through the specifications for
distributed systems that I am interested in. I started off with
[LearnTLA+](https://learntla.com/) by Hillel Wayne. It uses Pluscal instead of
TLA+ to introduce formal modelling which can then be transpiled to TLA. Pluscal
is supposed to be easier for engineers to learn since it's closer to normal
(imperative) code whereas TLA+ is more _mathematical_. True, I did find Pluscal
easier to grok though I found it a bit harder to use it to write my own
specifications. Almost every hurdle or error I encountered required some
knowledge of TLA+. Therefore I had to dip my toes into TLA+.

I started off with the first 8 chapters of the book
[Specifying Systems](https://lamport.azurewebsites.net/tla/book.html) by Leslie
Lamport. It wasn't as complex as I assumed (except for Chapter 8, which I'll get
to). I supplemented the book with Lamport's
[video course](https://lamport.azurewebsites.net/video/videos.html) on the same.
The videos IMO are certainly the most approachable beginner resource and I'd
recommend them to anyone starting out. They also have mini-exercises that you
can use to test out your understanding as you go along. With some TLA+ know-how,
revisiting the Pluscal in Hillel Wayne's resource was quite a breeze. The parts
I struggled with in both these three resources all entailed temporal formulas
specifically for liveness which I'll be looking to getting into next (though as
Lamport advises, safety properties are more important). The following are some
notes I took along (mostly for my future review). All credits go to Lamport and
if there's any mistake it's definitely mine:

## Some notes

- **abstraction**: the process of simplification by removing irrelevant details
- "The hard part of learning to write TLA+ is learning to think abstractly about
  the system" - Brannon Batson
- A good engineer knows how to abstract the essence of a system and suppress the
  unimportant details when specifying and designing it. The art of abstraction
  is learned only through experience.
- **Specification**: a precise high-level model. Involves specifying the set of
  all possible behaviors representing the correct execution of a system.
- When writing a specification, you must first choose the abstraction: this
  means choosing the variables that represent the system's state and the
  granularity of the steps that change those variables' values.
- Basic abstraction underlying TLA+: An execution of a system is represented as
  a sequence of discrete steps.
  - step: a change from one state to the next, a pair of successive states
  - execution: a sequence of states
  - state: an assignment of values to variables
  - behavior: a sequence of states. A behavior describes a potential history of
    the universe.
- A **State Machine** is described by:
  1. What the variables are
  2. Possible initial values of variables (all possible initial states)
  3. The relation between the state machine's values in the current state and
     their possible values in the next state (what next states can follow any
     given state)
- TLA+ uses 'ordinary simple math' to describe state machines.
- A temporal formula is an assertion about behaviors. A temporal formula
  satisfied by every behavior is called a theorem.
- Action: formula that contains primed and unprimed variables. An action is true
  or false of a step i.e. an action is a formula (and formulas aren't executed
  per se). An action `S` is enabled in a state from which it is possible to take
  an `S` step
- Stuttering steps: steps that leave a variable unchanged
- Invariant: a formula that is true in every reachable state
- Enabling conditions of a formula: Conditions on the first state of a step

## References

- Thinking Above the Code - Leslie Lamport:
  [link](https://www.youtube.com/watch?v=-4Yp3j_jk8Q)
- Tackling Concurrency Bugs with TLA+ - Hillel Wayne:
  [video](https://www.youtube.com/watch?v=_9B__0S21y8)
- Learn TLA+ - Hillel Wayne: [link](https://learntla.com/)
- The TLA+ Video Course:
  [videos](https://lamport.azurewebsites.net/video/videos.html)
- Specifying Systems - Leslie Lamport:
  [book](https://lamport.azurewebsites.net/tla/book.html)
