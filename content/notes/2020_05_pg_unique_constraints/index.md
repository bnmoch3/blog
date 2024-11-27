+++
title = "Speeding up unique constraint checks in Postgres... or not"
date = "2020-05-28"
summary = "Are exclusion constraints using hash indexes faster than plain old uniqueness checks? Let's find out"
tags = ["SQL"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "pg-unique-constraints"
+++

Using hash indexes over Btree indexes for equality lookups should be faster:
O(1) vs O(log n). And as expected, various benchmarks confirm this. However,
when it comes to enforcing uniqueness for a given column, hash indexes don't
perform quite as well.

Here's the standard way of adding a uniqueness constraint to a column:

```sql
create table item(
    id int unique,
    name text
);
```

On my computer, it takes 5.563 seconds to insert a million sequentially ordered
IDs. It takes 7.533 seconds to add a million randomly ordered IDs. Without any
constraint on the `id` column, it takes roughly 2 seconds to insert a million
items regardless of whether they are ordered sequentially or randomly.

Postgres provides another round-about way of adding a uniqueness constraint to a
column - _exclusion constraints_. Postgres'
[documentation](https://www.postgresql.org/docs/12/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION)
defines exclusion constraints as follows:

> Exclusion constraints ensure that if any two rows are compared on the
> specified columns or expressions using the specified operators, at least one
> of these operator comparisons will return false or null.

For our case, enforcing uniqueness, the above statement could be restated in
this way: Suppose we only consider a single column and provide one operator for
the exclusion constraint (such as the equals operator '=' for uniqueness). Then,
when inserting or updating a row, the comparison with all other pre-existing
rows should result in false, (or null since sql has three-valued logic).
Otherwise, it will be excluded.

This is easier demonstrated with actual sql:

```sql
create table item(
    id int,
    name text,
    exclude (id with =)
);
```

Better yet, Postgres allows us to speed up the exclusion check using an index as
follows:

```sql
create table item(
    id int,
    name text,
    exclude using hash (id with =)
);
```

Now, when using a unique constraint, Postgres' documentation states that it
"will automatically create a unique B-tree index on the column or group of
columns listed in the constraint". Given that the exclusion constraint above is
using hash index, I expected it to be faster. However, inserting a million
sequential ID's took 9.192 seconds, which is almost twice as slow as relying on
the plain old unique constraint. Inserting randomly ordered IDs took 8.443
seconds.

At first, I presumed it has something to do with the way the underlying hash
indexes are structured, but even when using btree, it took roughly the same
amount of time as the hash index exclusion constraint. The btree though was way
much slower when inserting randomly ordered IDs, taking 12.058 seconds. My
current presumption is that Postgres developers have put a lot of work into
optimizing the standard unique constraint, since it's expected that the users
will opt for it over exclusion constraints, which are better left for more
interesting stuff, like overlapping intervals.

Other than being slower, by relying on exclusion constraints to enforce
uniqueness, we also lose the ability to have the column be referenced by foreign
keys in other tables. This is because in Postgres, only unique columns and
primary key columns can be referenced. For example, the second table definition
below fails:

```sql
create table item(
    id int,
    name text,
    constraint unique_book_id_hash exclude using hash (id with =)
);

create table orders(
    id int,
    item_id int references item(id) -- ❌
);
```

## String keys

So far though, if you've noticed, I've been using integers. Before making any
further conclusions and dismissing hash indexes entirely, it's only fair that
they're measured up in the one area where they excel quite well, comparing
lengthy strings. And as expected, they do truly shine here. I began with UUID's
since I didn't have to write an extra function for generating random strings.
With plain old `unique`, it takes 32.96 seconds to insert a million UUIDs. It
gets worse when inserting the next million UUIDS, 50.557 seconds. On the other
hand, when using the hash-index based exclusion check, it takes 12.537 seconds
to insert the first set of a million UUIDs, 12.764 to insert the next set and
finally 16.24 seconds to insert the third set - quite impressive. I'll be sure
to try comparing both with random strings of different lengths but I expect
similar results. And yeah, that's definitely one way to speed up uniqueness
constraint checks if the column's type is a string, rather than an integer and
it won't be referenced elsewhere in the database.

## Addendum

After writing up this post, I searched online to check how others are using this
method and what issues they've come across. Here's one important consideration I
came across to keep in mind. It's from the discussion 'Postgres hash index with
unique constraint' on StackOverflow
([link](https://stackoverflow.com/questions/44274080/postgres-hash-index-with-unique-constraint)).
Using exclusion constraints to enforce uniqueness does not work with upserts
(i.e. insert ... on conflict do _action_) since, to quote the user
[jbg](https://stackoverflow.com/questions/44274080/postgres-hash-index-with-unique-constraint#comment104844932_57288579):
"there could be multiple rows that conflicted when using an exclusion constraint
(even though in this specific case it would always be one row), in which case it
wouldn't be clear which conflicting row should be updated".

## References

1. [Postgres documentation, Constraints](https://www.postgresql.org/docs/12/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)
2. [Hash indexes are faster than Btree indexes?](http://amitkapila16.blogspot.com/2017/03/hash-indexes-are-faster-than-btree.html)
3. [Postgres hash index with unique constraint](https://stackoverflow.com/questions/44274080/postgres-hash-index-with-unique-constraint)