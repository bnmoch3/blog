## Some TLA Syntax

Records:

```
[prof |-> "Alice", num |-> 42]
\* function `f` s.t. f["prof"] = "Alice" and f["num"] = 42

[f EXCEPT !["prof"] = "Bob" ]

[f EXCEPT !.prof = ""]
```

Choose:

```
\* Allows the value of x in the next state to be any number in 1 ..99
x' \in 1..99

\* Allows the value of x in the next state to be one particular number.
x' = CHOOSE i \in 1..99: TRUE

\* You should write `CHOOSE v \in S: P`
\* Use CHOOSE only when there's only one v in S satisfying P or when it's part 
\* of a larger expression whose value doesnt depend on which v is chosen
```

Consider the following. In this expression, all choices `m` have same value of
m.val

```
(CHOOSE m \in mset: m.bal - maxbal).val
```

## Temporal formulas

- A specification can be written as a single temporal formula
- Logical Implication, P => Q, If P is TRUE then Q is TRUE else we know nothing
- module-closed expression: a TLA+ that after expanding all definitions contains
  only:
  - built-in TLA+ operators and constructs
  - numbers and strings
  - identifiers declared in the modules constants and variables statements
  - identifiers declared locally within the expression including ones introduced
    by:
    - for all: `\A v \in S: ...`
    - there exists: `\E v \in S: ...`.
    - set filter: `{v \in S: ... }`
    - set construction: `{... : v \in S}`
- A module-closed formula is a Boolean-valued module-closed expression: one
  whose value is either TRUE or FALSE
- A constant expression is a module-complete expression that:
  - depends only on the values of the declared constants it contains. Declared
    using the CONSTANT statement
  - has no declared variables
  - has no non-constant operators, (examples of non-constant operators: prime
    and UNCHANGED). What's a non-constant operator?
  - An assumptions which is asserted by an ASSUME statement must be a
    constant-formula.
- State Expressions:
  - value of a state expression depends on:
    - declared variables
    - declared constants
  - a state expression has a value on a state. State assigns values to
    variables.
  - A constant expression is a state expression that has the same value on all
    states.
- Action expression:
  - can contain anything a state can contain as well as:
    - `(prime) variables
    - UNCHANGED
  - A state expression has a value on a step (a step is pair of states)
  - A state expression is an action expression whose value on the step s->t
    depends only on the first state s.
- Priming a state expression.
- A temporal formula has a boolean value on a sequence of states i.e. a
  behaviour
- Specification: a temporal formula whose value is TRUE on the behaviours
  allowed by the spec.
- A specification does not describe the correct behaviour of a system. Rather it
  describes a history of the universe in which the system and its environment
  are behaving correctly.
- Stuttering steps: steps that leave all the spec's variables unchanged
- Implementation is (logical) implication
- Deadlock(undesierable) or termination(desirable) are both represented by a
  behaviour ending in an infinite sequence of stuttering steps.
- Safety vs Liveness
- The only liveness property sequential programs must satisfy is termination.
- Weak fairness of action A asserts of a behaviour that if A ever remains
  continuously enabled, then an A step must eventually occur. A cannot remain
  enabled forever without another A step occuring.
