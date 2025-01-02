+++
title = "SQL joins as reduce/folds over relations"
date = "2020-01-03"
summary = "Of what to make of joins in sql, mental models and building better understanding"
tags = ["SQL", "PostgreSQL"]
type = "post"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "sql-joins-p1"
+++

Mental models help us navigate complex ideas. However, forming one own's mental
models can be a tricky affair. On one hand, by putting the effort to come up
with mental a model by ourselves, we gain a deeper understanding of the subject
at hand. We also become better and more efficient at reasoning and
problem-solving. However, on the other hand, a deficient or even an entirely
wrong mental model can derail arriving at a far deeper understanding and even
result in huge errors and blindspots later on, despite such mental models
serving us well in the beginning. This was my case when I encountered _joins_ at
first when I was learning SQL.

With joins, I initially visualized _foreign keys_ as sort of 'pointers' to
different storage locations where the rows contained the primary keys, and
_joins_ themselves as 'dereferencing' procedures. This worked well when I had to
write queries for simple inner joins involving two tables. Beyond that, e.g.
three or four tables, or if the situation called for outer queries, I was always
left stumped.

I then ditched the whole pointers-dereferencing model, and for a while, simply
treated joins as opaque procedures, tinkering with them until the query somehow
worked. I could afford such a 'strategy' when writing queries where there was
always a set answer for comparison (such as in online exercises) but I knew at
some point I'd have to write 'greenfield' queries without crutches to hold on
to. I just had to understand how joins fit in as completely as possible.

My strategy then was to go back to the basics. When you're at an intermediate
level, going back to the basics always feels like a chore - there's that
impatience coming from hey, I already know this why should I go through it over
again. Furthermore, every minute spent on 'going back to the basics' could be
spent on becoming more 'advanced', taking on more technical projects and all
that kind of stuff. Well, revisiting fundamentals can be made into an engaging
exercise. It's the best time to reevaluate and challenge one's mental models and
assumptions. Which is how I ended up getting a better understanding of how to
use sql _joins_.

Note, there's a part 2 of this post that actually does go back to the basics
-the fundamental ideas on which joins are based on. This post is more of an
alternative per se: an attempt at using another high-level concept so as to make
sense of _joins_.

And it's as follows. Let's start with a simple SQL query:

```sql
SELECT column1, column2... columnN
FROM relationA
```

If we think about the 'order' of evaluation: the `from` gets 'evaluated' before
the `select`. The _from_ is where the `join` clauses are placed. The word
'evaluated' is in quotation marks because technically, SQL engines aren't
required to, nor have to evaluate a query in some given order. In fact,
data-retrieval sql queries themselves aren't dictating some imperative order of
evaluation in the same way 'line number' dictates order of evaluation in
synchronous code. Instead, such queries describe the shape of the data we want
back, which is why SQL is said to be declarative. The 'declarativess' of SQL is
yet another concept I struggled with initally. And before going further, I'd
like to link to a particular Julia Evans' blog
[post](https://jvns.ca/blog/2019/10/03/sql-queries-don-t-start-with-select/),
which gives a more in-depth treatment of the 'evaluation' order of SQL queries.

Back to the SQL code we have above. As mentioned, let's suspend the
technicalities and assume an 'order of evaluation': By the time `select` is
evaluated, all it has to work with is a single table from which it picks the
required columns, i.e. the projection part in relational algebra. Therefore, if
there are any joins, these _joins_ can be conceptualized as procedures or
operations that build a huge single table from many related tables, using the
join clauses to connect rows. Another way of seeing it is that the evaluation of
a series of joins is in fact a **reduce** operation.

Now, [reduce](https://en.wikipedia.org/wiki/Fold_higher-order_function) itself
is a high-level concept, being one of the fundamental higher-order functions in
functional programming; _reduce_ abstracts a common iteration pattern as we
shall see. However, the manner in which _reduce_ is normally introduced to
novices waters down its essence. The standard example used usually entails a
collection of numbers and calculating a value such as a sum. For example, the
MDN javascript docs provide the following sample:

```javascript
const array1 = [1, 2, 3, 4];
const reducer = (accumulator, currentValue) => accumulator + currentValue;

// 1 + 2 + 3 + 4
console.log(array1.reduce(reducer));
// expected output: 10

// 5 + 1 + 2 + 3 + 4
console.log(array1.reduce(reducer, 5));
// expected output: 15
```

I kinda get why such examples are used to demonstrate _reduce_: rather than
presenting the abstracted version - it's easier for learners to at least be
familiar with it and know that it exists. Generally, all beginner material has
to balance between ease of understanding, clarity, correctness and thoroughness.
Most choose ease-of-understanding in the hope that once learners progress to the
intermediate level, they can take on the technicalities.

And so, for quite a while as a novice, I simply thought of reduce as a fancy way
to perform calculations over an array of numbers, in which case, I'd rather use
good old-fashioned for-loops. It's not until I was working through Daniel
Higgibotham's _'Clojure for the Brave and True'_ that I saw _reduce_ in a new
light. Here's how Daniel introduces reduce:

> The pattern of _process each element in a sequence and build a result_ is so
> common that there’s a built-in function for it called reduce....

This was a mini-moment of enlightenment for me! My understanding of reduce
became more generalized and abstract:

- For one, the sequence can consist of anything, not just numbers: a sequence of
  cats, dogs, json, other sequences, whatever.

- Moreover, the sequence itself doesn't even have to be an array, it can be a
  tree, a map, any sequence-like/iterable data-structure.

- And finally, the value we are building up using reduce doesn't even have to be
  of the same type as the elements in the sequence - just because the array
  consists of numbers doesn't mean _reduce_ has to return a number.

For the sake of repetition, here's yet another definition of reduce that I got
from Eric Elliot's post, _10 Tips for Better Redux Architecture_ ,
[link](https://medium.com/javascript-scene/10-tips-for-better-redux-architecture-69250425af44):

> In functional programming, the common utility _`reduce()`_ or _`fold()`_ is
> used to apply a reducer function to each value in a list of values in order to
> accumulate a single output value.

And now back to SQL. Do keep in mind that I might just be shoehorning one
concept into another out of sheer excitement. As already mentioned, no matter
how many tables are listed in the **from** clause, at the end of the day
**select** expects only a single table from which it can pick out the specified
collumns. Thus, one might visualize the _join_ 'operator' as a reducer function.
And just like a reducer, it takes in two arguments: the first argument is the
table accumulated so far, and the second argument is the next table in line.
Within this reducer function, join then builds, or rather accumulates both
tables into a much larger table. The accumulation is across two dimensions, rows
and collumns. On columns, since this reduction takes place before the **select**
clause, all the columns from both tables are included. However, if we use the
keyword **using** in the join clause instead of the more common **on** clause,
the two columns that are being compared to are collapsed into a single column.
As for the rows, it all depends on the type of _join_ we are using. For example,
when we are using a **right-outer join**, if a row in the left accumulated table
cannot be partnered up with a row in the right table, it is discarded; once all
the rows are partnered up, if there were any rows in the right table that didn't
get a partner, nulls are used to fill up the gaps. This was kind of the idea in
my head on how joins work. It kinda still is.

Nonetheless, all join-clauses I had come across or worked on at that point
related primary keys with foreign keys. Therefore I wrongly presumed both
concepts are tightly related. Toying with a couple of queries though, I found
out that the columns used in a join clause don't even have to have some
primary-key - secondary-key sort of relationship. All this time, I was
intertwining joins and keys, when they weren't even dependent on each other. As
such, faced with gaping holes in my understanding, I had to go back to the
basics... which is exactly what I explore in the
[second part](https://www.nagamocha.dev/posts/sql-joins-p2/) of this article.
See you there!
