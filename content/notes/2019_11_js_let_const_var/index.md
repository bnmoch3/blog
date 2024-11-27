+++
title = "Var, Let, Const and the 'commonly' expected behaviour"
date = "2019-11-29"
summary = "Javascript quirks and idiosyncracies. Or why learning a new programming language is hard when coming in with implicit assumptions from other languages"
tags = ["Javascript Node.js"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "js-let-const-var"
+++

Of all the programming languages I've worked with so far, javascript is the one
where I've found myself most productive relative to how well I am versed with
the subtleties of the language. I learnt js in the post-ES5 world and there are
certain 'modern' things I picked up without paying much attention to why they
are the way they are. For example, I used lots of **let** over **var** simply
because it's recommended without figuring out why- which partly is what this
post is about.

Generally, there are certain aspects of programming languages that are
universal. For example, the notion of variables, functions, evaluation,
iterations and so on. That's why for beginners, learning the first programming
languages is quite hard, but picking up subsequent languages gets easier and
easier since these concepts cut across all programming languages in one way or
another.

Nonetheless, some languages opt for approaches and behaviours that can be quite
unorthodox. When such languages becomes mainstream, the language designers and
its community are faced with a predicament: should they change/extend the
syntax, keywords and features to be more in line with the 'commonly expected
behaviour' in order to accomodate the newcomers OR should they stick to their
guns and demand that newcomers accustom themselves and even embrace the
unorthodox parts. That is the all too familiar story of _var_, _let_ and _const_
in Javascript.

### let, var

Let's start with _let_ and _var_. Consider this code sample:

```javascript
function main() {
  var a = 10;
  {
    var a = 90;
    console.log(a); //90
  }
  console.log(a); // 90 ????
}
```

Hmm, somehow, the var in the 'inner scope' overrode the var definition in the
outer scope.

And it gets even weird with global scope. From the docs:

> `var` declarations, wherever they occur, are processed before any code is
> executed. This is called hoisting ... "

There's probably a more erudite way of phrasing it but to me, it seems as if the
variable definitions are leaking out of their scope: a behaviour that someone
like me whose coming from a different language would not expect in the first
place. Maybe there's a reason for _var_ to have this characteristic that's super
specific to the early days of JS.

And it seems one of the reasons **let** was added to the languages was to
introduce a behaviour that folks coming from other languages would commonly
expect with regards to scope and definitions.

Since _let_ declarations aren't hoisted, it's much easier to reason about the
sequence of lines of code, given their order. Compare with _var_ where the
following code is valid, ie, it 'seems' that we can access **var a** even before
we declare it:

```javascript
console.log(a); // undefined
var a = 10;
console.log(a); // 10
```

when in fact, _var_ declarations cause a sort of reordering where the
declarations are pushed 'up' before any execution begins and given the value
_undefined_ for the time being, but the assignment of values is kept in the same
location, resulting in what seems to be:

```javascript
var a = undefined;
console.log(a);
a = 10;
console.log(a);
```

Definitely not a behaviour that's to be expected by newcomers (newcomers here
refers to folks coming from other languages rather than those who are total
beginners and if exposed to such might not find it out of the norm).

To reiterate, using _let_ instead, we get a behaviour that's much more expected
(code sampled from the MDN docs):

```javascript
console.log(a); // ❌ReferenceError
let a = 10;
console.log(a); //if error omitted, prints 10
```

_var_ allows the same variable to be declared more than once, again a behaviour
newcomers don't expect: whereas _let_ behaves as they would expect:

```javascript
var a;
var a; // nothing happens
let a;
let a; // ❌ SyntaxError: Identifier 'a' has already been declared
```

As already noted, _var_ 'misbehaves' a lot when it comes to scope

One of the common ways this is demonstrated is in for loops. In most languages,
unless we declared the **i** outside the for-loop, we expect the **i** to remain
contained within the for-loop block. However, consider the code, below, it's as
if _var_ leaks it outside.

```javascript
function foo() {
  for (var i = 0; i < 5; i++) {
    console.log(i);
  }
  console.log(i); // 5
}
```

However, _let_ behaves as we (newcomers) would expect

```javascript
function foo() {
  for (let i = 0; i < 5; i++) {
    console.log(i);
  }
  console.log(i); // ❌ ReferenceError: i is not defined
}
```

### 

### const

Now, onto const. Const is a different monster all together. Having coded a bit
in C++, I used _const_ a lot in javascript at first because of the behaviours I
'wrongly' assumed it guarantees. However, I later learnt that _const_ doesn't
quite guarantee that the value assigned to it is unmodifiable, instead it's the
_binding_ that can't be modified - (like I mentioned earlier, I am surprised I
was able to achieve a lot using js even when having the wrong assumptions
entirely, other languages punish you hard and early for such). _const_ can
behave as newcomers expect if the value bound is 'naturally' immutable. For
example, numbers are immutable, you just can't change the 'oneness' of 1, or the
falseness of _false_. Luckily, strings too are immutable in javascript. However,
with objects and arrays, const doesn't quite behave as expected.

Now, onto the idea of a 'binding'...

The idea of assignment and variables cuts across all commonly used programming
languages.

For the sake of comparison, in C++ (and for C++ coders, do correct me if I'm
wrong), a variable is akin to a 'container' and assignment entails placing a
value into that container. And yes, the sample below is wrong in many many ways.

```cpp
//C++ ...
int main(){
    User user1;
    user1 = User("Bart", "Simpson", 10);
}
```

In javascript though, the notion of 'assignment' is kind of inverted: a variable
is more of an _identifier_ or a label rather than a 'container'. In the 2nd line
of the code sample below, the value on the right side of the assignment 'exists'
independent of the variable; it isn't being placed into a sort of container,
instead, the identifier **user1** is being _bound_ to it as a mere label.

```javascript
//Javascript
let user1;
user1 = { firstname: "Bart", surname: "Simpson", age: 10 };
```

For an idenitfier/label to hold, it requires a sort of space within which it
holds, beyond which, it is not recognized. This is a loose way of thinking about
the **scope** of a variable but the underpinnings of how scope operates is a
different topic altogether.

Moreover, additional identifiers can be bound to the same value that **user1**
is bound to (note that the js equality operator tests for distinctness w.r.t.
objects ):

```javascript
let user2 = user1;
console.log(user2 === user1); //true
```

Since a variable is nothing more than an identifier, and combining this fact
with JS's dynamic typing, we get a lot of flexibility.

Now, looking back at _const_, and keeping in mind that assignment in javascript
is actually binding identifiers to values, _const_ simply makes the binding
permanent- the immutability is imposed on the binding itself rather than the
value as one would have expected.

Therefore the current 'controversy' or rather tussle as to whether the use of
**const** should be discouraged or encouraged could be rephrased in a different
way: Those who discourage its use are aware that js programmers do come other
languages where the idea of 'const-ness' implies or rather guarantees that the
value (on the right hand side of the assignment shall not be modified.
Therefore, presumably, its presence and even its use sort of violates the Unix
principle of doing the least surprising thing.

However, those that don't mind or even go so far as to advocate for its use,
dare I say, expect _more_ of those willing to call themselves javascript
developers, that is they should at the very least be cognizant of _identifiers_,
_binding_ and other javascript formalities. I mean, we do expect that surgeons
fully know how to operate with scapels, chefs with their kitchenware and so on
with other professionals - then why should js developers be exempt from mastery
of their toolset. And if their (js developers) know-how is on point, they should
fully be aware of what _const_ implies and guarantees.

At the end of the day, what's needed is a sober evaluation of trade-offs at
hand: are the binding guarantees `const` provides worth it, or is its potential
to be misunderstood by newcomers a possible vector for nasty bugs.

In my opinion, its additional (though scanty) guarantees are well worth and as
mentioned earlier, it can be a great communication tool for denoting that the
bound variable should not be mutated (yes, even if it's an object). I take that
back, if the object really really shouldn't be mutated at all, then the
necessary libraries (immer or immutable.js) should be used or even just manually
deep freezing the object.

### "use strict"

Yet another behaviour that javascript allows but is not usually expected by
outsiders coming from other languages is 'assigning a value to a variable'
without having declared that variable in the first place e.g. using _var_.

```javascript
a = 10;
console.log(a);
```

However, to those from Python (and presumably other dynamically typed
languages), it's nothing strange. Such languages avoid introducing this
inconsistency by excluding syntax for 'variable declartion' entirely in the
first place . To the extent that it's perceived as an irregularity in javascript
though, the 'use strict' mode is made available in js to prevent it or rather
error out early enough.

### functions/ arrow functions

There's a good reason why arrow-functions were introduced in modern javascript -
conveniences regarding **this** and of course, syntactic terseness. An
underlooked benefit though is that arrow functions when used with _let_ and
_const_, introduce, once again, a commonly expected behaviour. That is, one is
not allowed to define two or more functions with same name or even signature
more than once since it introduces ambiguity over which function to run when
called.

Javascript though doesn't have the same restrictions. The following is a valid
javascript program

```javascript
function foo() {
  console.log("bar");
}

function foo() {
  console.log("baz");
}
foo();
// baz
```

A function's signature is a varying combination of its name, parameter list and
types and its return value, depending on whether the language is statically
typed or dynamically typed. Since a function can be identified by more than its
name, some languages such as C++ allow for function overloading whereby having
two or more functions with the same name but different parameters is valid.
However, in other languages such as Go or even C, function overloading is
invalid.

That's a bit of a digression. Back to javascript: what does it even mean for a
function to have a signature, let alone allow for overloading. JS already allows
for functions to be called with more arguments than the defined parameter list
or even less. A language like Python is dynamically typed yet it's still strict
on function parameters.

Anyway, that's it for now. If the whole post seems raw and jumbled up that's
because it actually is. I'm learning (and unlearning and relearning) javascript
and hopefully, as I dig deeper into javascript, I'll shed off the errenous
assumptions I brought in with me from other languages and embrace js fully with
all its quirks and idiosyncrasies.