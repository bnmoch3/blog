+++
title = "JavaScript Inheritance from the Ground Up"
date = "2025-09-03"
summary = "Prototypes, Classes and Everything in Between"
tags = ["JavaScript"]
type = "post"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "js-prototypes-inheritance"
+++

## Introduction

Lately, I’ve been digging deeper into JavaScript (courtesy of this book,
[Secrets of the JavaScript Ninja](https://www.manning.com/books/secrets-of-the-javascript-ninja)).
One question I kept asking myself as I went along: how does one actually
achieve/implement inheritance? This post is a record of my learnings along the
way.

Let's start with the rudimentals, "what is inheritance and why?":

- Inheritance: defining a general thing once and creating specialized versions
  which automatically get all of the general's features plus their own unique
  ones
- Why inheritance: code reuse, polymorphism et cetera

## First Attempt at Inheritance

I read elsewhere that some of the modern JavaScript features are syntactic sugar
over what was already present in the language, specifically `class` and
`extends`. So as I was working through the "Object Orientation with Prototypes"
chapter, I got curious as to how inheritance could be achieved with prototypes.

Suppose we've got a `Person`:

```javascript
function Person(name) {
  this.name = name;
}
Person.prototype.greet = function () {
  console.log(`Hello, this is ${this.name}`);
};
```

And a `Ninja` who _is_ a `Person` i.e. should inherit from `Person`:

```javascript
function Ninja(name, skill) {
  // we need to call the parent/superclass to initialize the `Person` parts of
  // a Ninja object
  this.skill = skill;
}
Ninja.prototype.fight = function () {
  console.log(`${this.name} can fight at ${this.skill} level`);
};
```

This was my first stab at inheritance:

```javascript
function Ninja(name, skill) {
  // inherit from Person
  Person.call(this, name);
  Object.setPrototypeOf(Object.getPrototypeOf(this), Person.prototype);
  // now init Ninja-specific stuff
  this.skill = skill;
}
```

We can now do the following:

```javascript
const n = new Ninja("Alice", "Advanced");
n.greet();
n.fight();
// Hello, this is Alice
// Alice can fight at Advanced level
```

A couple of notes:

- The goal I had in mind with `Person.call(this, name)` is to achieve
  _constructor delegation_: instead of repeating the work that the `Person`
  constructor already does, just delegate to it directly
- To use `Person` as a constructor, we need to invoke it with the `new` keyword,
  however, this will just instantiate an entirely different object
- Hence the usage of the `call` method which lets us set the `this` value in
  addition to providing the required arguments for the `Person` constructor
- From what I know wrt OOP in other languages, the `Person.call(this, name)` has
  to come before setting the properties specific to `Ninja` just in case
  initialzing any of the `Ninja`-specific properties depends on the
  `Person`-specific properties. The inverse cannot be true (none of the `Person`
  properties could depend on `Ninja` since the inheritance relationship flows
  one-way from Parent to Child)

So far so good.

Now, let's go to this line:
`Object.setPrototypeOf(Object.getPrototypeOf(this), Person.prototype);`. My goal
here was to set up the prototype chain such that a `Ninja` object has access to
the `Person` methods (a Ninja _is_ a Person). Unfortunately, I was being too
clever with the `Object.getPrototypeOf(this)` part since I could have as well
just used `Ninja.prototype` directly.

## Functions' `__proto__` vs `.prototype`

When you create an object via a constructor function in JavaScript, that
object's internal prototype (`__proto__`) is automatically set to the function's
`.prototype` property. Worth emphasizing, a function's `.prototype` is not the
same thing as the function's own internal prototype `__proto__`.

Allow me to go over this distinction again: when you define a function in
Javascript, it comes with two different prototype-related things. Let's consider
`Person`, it comes with:

- `Person.prototype`: Every constructible function in Javascript gets a
  `.prototype` property which is an object.
  - When you use the function as a constructor e.g. `new Person(...)`, this
    object becomes the prototype of the newly created instances.
  - When you add methods and properties to this `.prototype` object, all
    instances will have access to them (it becomes part of their prototype
    chain).
  - Also worth pointing out now, this `.prototype`object comes with a
    `.constructor` property which points back to the function itself. The
    property is non-enumerable which means it won't show up in `for...in`,
    `Object.keys` and so on.
  - The `.constructor` property is there so that when we create `Person`
    instances, we can retrieve the constructor function that was used if needed.
- `Person.__proto__` ( or `Object.getPrototypeOf(Person)`): This is the
  function's own prototype.
  - Since functions are also objects, they get their own prototype chain.
  - Note, for `Person`, its `__proto__` is set to `Function.prototype`. This
    means the function `Person` is itself an instance of the built-in `Function`
    constructor.
  - Through its prototype chain, it inherits methods like `.call` which we used
    earlier, as well as `.apply`, `.bind` among others.

```javascript
import assert from "assert";

function Person(name) {
  this.name = name;
}

// Person.prototype is different from Person.__proto__
console.log(Person.prototype); // {}
console.log(Object.getPrototypeOf(Person)); // [Function (anonymous)] Object
assert(Object.getPrototypeOf(Person) !== Person.prototype);

// Person is an instance of Function
assert(Person instanceof Function);

// Hence Person's prototype is Function.prototype
assert(Object.getPrototypeOf(Person) === Function.prototype);
```

## Fixing the Inheritance Setup Code

Now, back to the my 'inheritance' code. Let's use `Person.prototype` in lieu of
`Object.getPrototypeOf(this)`:

```javascript
function Ninja(name, skill) {
  // inherit from Person
  Person.call(this, name);
  assert(Object.getPrototypeOf(this) === Ninja.prototype);
  Object.setPrototypeOf(Ninja.prototype, Person.prototype);
  // now init Ninja-specific stuff
  this.skill = skill;
}
```

Rewritten this way, the issue jumps out: **why is the prototype of Ninja being
reset on every single instantiation?** It's unnecessary and a potential
performance problem

To fix it, let's set up the prototype chain _once_ outside of the constructor:

```javascript
function Ninja(name, skill) {
  // inherit from Person
  Person.call(this, name);
  // now init Ninja-specific stuff
  this.skill = skill;
}
Object.setPrototypeOf(Ninja.prototype, Person.prototype);
```

## Digging into `.prototype`

Let's go back to the `Person` function for a moment this time minus the `greet`
method:

```javascript
function Person(name) {
  this.name = name;
}
```

As already mentioned, every function in Javascript automatically gets a
`.prototype` property when it's created. If we print this object, it seems
empty:

```javascript
console.log(Person.prototype); // {}
```

Properties can be **enumerable** or **non-enumerable**. If non-enumerable, they
won't show up when you use common traversal or inspection methods (e.g. when
using `console.log`, `Object.keys`,`Object.values`,`Object.entries` or
`JSON.stringify`).

There are other property attributes too besides enumerability.

## Property Descriptors

In fact, if we take the property key, value and attributes, these encompass
what's referred to as "property descriptors". The attributes govern behavious
like:

- Can the property be deleted from the object?
- Can its value be changed?
- Will it show up in `for...in`, Object.keys and so on?
- Can the property's attributes be reconfigured
- When accessing it do we implicitly use getter/setter functions or just
  get/modify the value directly

There are two kinds of properties descriptors:

- **data descriptor**: has value that may or may not be writable. Configured
  throught he following attributes: (writable, configurable, enumerable):
  - **writable** (true/false): if true, the value of a property can be modified
    via the assignment operator
  - **configurable** (true/false):
    - if set to false, the property cannot be deleted (e.g. `delete obj.foo`)
    - also, if false, the descriptors of the property cannot be modified, e.g.
      set `writable` from `true` to `false` later on, or change from data to
      accessor descriptor
  - **enumerable** (true/false):
    - if false, the property will not show up during commonly used object
      traversal and inspection methods, such as `for-in` loops, `console.log`,
      `Object.keys`, `Object.entries` and `JSON.stringify`
- **accessor descriptor**: property described by getter-setter pair of functions
  that are set via the `get`/`set` attributes
  - **get**: getter function, cannot be defined if `value` and/or `writeable`
    are defined
  - **set**: setter function, cannot be defined if `value` and/or `writable` are
    defined

Property descriptors are defined and configured through the
`Object.defineProperty` static method.

For example, given `ninja` which is a `Ninja` instance, let's add a color
property:

```javascript
const ninja = new Ninja("Eve", "Beginner");

Object.defineProperty(ninja, "colour", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: "black",
});

// fails
ninja.colour = "blue";

// fails
delete ninja.colour;
```

### Back to `.prototype`

Back to `.prototype`, if we want all property names directly on an object
regardless of whether they're enumerable or not, we can use
`Object.getOwnPropertyNames` to get them.

Let's do so with `Person.prototype`:

```javascript
console.log(Object.getOwnPropertyNames(Person.prototype));
// ["constructor"]
```

`Person.prototype` has a `.constructor` property. The value of this property is
the function `Person` itself i.e. it _points_ back to `Person`. This means that
given any instance of `Person` we can always retrieve the function that was used
to construct it:

```javascript
assert(Person.prototype.constructor === Person);
const bob = new Person("Bob");
assert(bob.constructor === Person);
```

Let's get more details on the `.constructor` property:

```javascript
function Person(name) {
  this.name = name;
}

const desc = Object.getOwnPropertyDescriptor(Person.prototype, "constructor");
console.log(desc);
```

This prints:

```
{
  value: [Function: Person],
  writable: true,
  enumerable: false,
  configurable: true
}
```

Informally, we could say that the `.constructor` property is there so that
objects can _remember_ which specific function was used to construct them. It's
non-enumerable since we often don't need to nor have to access it.

## `.prototype` Prototype Chain

Now that we've seen what's inside `Person.prototype`, let's look at its
prototype chain. The prototype of `Person.prototype` is `Object.prototype`:

```javascript
assert(Object.getPrototypeOf(Person.prototype) === Object.prototype);
```

And the prototype of `Object.prototype` is `null`

```javascript
assert(Object.getPrototypeOf(Object.prototype) === null);
```

Therefore, the full prototype chain of an instance of `Person` is:

```
alice --> Person.prototype --> Object.prototype --> null
```

The function `Person` itself has the following prototype chain:

```
Person --> Function.prototype --> Object.prototype --> null
```

As for an instance of `Ninja`
(`const alice = new Ninja("Alice", "intermediate")`):

```
alice --> Ninja.prototype --> Person.prototype --> Object.prototype --> null
```

## A Different Approach for OOP

Another approach is to set the `.prototype` of the constructor to an instance of
the _parent_. This is what the book goes for. In our case:

```javascript
function Ninja(name, skill) {
  Person.call(this, name);
  this.skill = skill;
}

// has to come before adding methods to the Person prototype
Ninja.prototype = new Person();
```

As expected, all `Ninja` instances automatically get access to the parent
`Person` methods:

```javascript
const dan = new Ninja("Dan", "intermediate");
dan.greet();
dan.fight();
console.log("dan instanceof Ninja:", dan instanceof Ninja);
console.log("dan instanceof Person:", dan instanceof Person);
```

Which outputs:

```
Hello, this is Dan
Dan can fight at intermediate level
dan instanceof Ninja: true
dan instanceof Person: true
```

Btw, it's probably a good idea to briefly mention how `instanceof` works. From
[MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof):
the "instanceof operator tests to see if the prototype property of a constructor
appears anywhere in the prototype chain of an object".

Back to the code, while it does work, it breaks one key expectation which is
that the prototype object of Ninja is expected to have a `constructor` property.
Let's rectify that:

```javascript
// has to come before adding methods to the Person prototype
Ninja.prototype = new Person();
Object.defineProperty(Ninja.prototype, "constructor", {
  value: Ninja,
  writable: true,
  enumerable: false,
  configurable: true,
});
```

All good. Now the prototype chain of an instance of Ninja is as follows:

```
dan --> person instance(Ninja.prototype) --> Person.prototype --> Object.prototype --> null
```

## ES6 Classes and the `extends` Keyword

With ES6, we've now got the `class` keyword and `extends` for inheritance.

Should make transitioning from class-based OOP languages to the prototype-based
JS much easier.

```javascript
class Person {
  constructor(name) {
    this.name = name;
  }

  greet() {
    console.log(`Hello, this is ${this.name}`);
  }
}

class Ninja extends Person {
  constructor(name, skill) {
    super(name); // calls Person's constructor
    this.skill = skill;
  }

  fight() {
    console.log(`${this.name} can fight at ${this.skill} level`);
  }
}
```

Also worth pointing out, it doesn't use a instance of the parent for
inheritance:

```javascript
const desc = Object.getOwnPropertyDescriptor(Ninja.prototype, "constructor");
console.log(desc);
```

Which ouptuts:

```
{
  value: [class Ninja extends Person],
  writable: true,
  enumerable: false,
  configurable: true
}
```

Note that `Ninja.prototype instanceof Person` evaluates to true, which is
expected. But it would be misleading to conclude from this that
`Ninja.prototype` is an actual instance of Person. What `instanceof` checks is
whether `Person.prototype` appears somewhere in the prototype chain of
`Ninja.prototype` nothing else more.

## Static Methods

For extras, suppose we want to add a `fight` static method on `Ninja`. With ES6
classes, it's as follows:

```javascript
class Ninja extends Person {
  ...

  static fight(ninja1, ninja2) {
    console.log(`${ninja1.name} fights ${ninja2.name}`);
  }
}

const alice = new Ninja("Alice", "advanced");
const dan = new Ninja("Dan", "intermediate");
Ninja.fight(alice, dan);
```

The equivalent of this when using functions as constructors:

```javascript
function Ninja(...){...}

Ninja.fight = (ninja1, ninja2) => {
  console.log(`${ninja1.name} fights ${ninja2.name}`);
};
```

Since functions are objects, we can just add properties directly on them. That’s
all static methods really is: functions 'living' on the constructor, not on its
instances. That's all for now.

## Extras

What happens if you try to set an object as its own prototype:

```javascript
function Person(name) {
  this.name = name;
  Object.setPrototypeOf(this, this);
}

const p = new Person("Alice");
```

You get a `TypeError: Cyclic __proto__ value ...`

Also this gets you another `TypeError: Cyclic __proto__ value ...`:

```javascript
function A() {}
function B() {}

Object.setPrototypeOf(A.prototype, B.prototype);
Object.setPrototypeOf(B.prototype, A.prototype);
```
