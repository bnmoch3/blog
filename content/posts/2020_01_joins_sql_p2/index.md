+++
title = "Back To Basics: The foundation of Joins in SQL"
date = "2020-01-06"
summary = "Writing SQL joins without using joins at all. A quick history of Database Models, Schemas, Constraints, Cross-products and everything in between"
tags = ["SQL", "PostgreSQL"]
type = "post"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "sql-joins-p2"
+++

Now, I've written [previously](/blog/sql-joins-p1/) on how, when learning SQL, I
had trouble understanding joins conceptually and even at a much more technical
level. Usually, joins are presented to learners as is since, after all, SQL is a
declarative language and the user ought to focus on framing the correct query,
and let the database engine figure out _how_ to answer it correctly. It's
tempting to try to figure out the 'how', worse so as a beginner, and at first I
wrongly assumed that joins in sql follow a sort of pointer or link when a column
in a table is declared as a foreign key to primary key in another table.

I quickly discarded this assumption when I encountered queries that didn't fit
to it. In the end, I settled on 'joins as a reduce/fold over tables' as detailed
in the linked post above. However, I was still left with the lingering thought
that joins have something to do with foreign keys since all the queries I had
come across at that point always involved both. As such, I had to dig deeper.
This article therefore is a deep-dive for SQL beginners (and even those at the
intermediate-level) on how joins and foreign keys fit into SQL. Spoiler alert,
joins are not interlinked in any way with foreign keys; joins are basically
row-level filters and in fact, any query written using joins can be rewritten
without them (with a little help from **cross products**). On the other hand,
foreign keys (as an abstraction) are nothing more than constraints that ensure
the value in a given column is a primary key, (or unique) in some other table.

I'll be using an example database in Postgres to demonstrate cross-products and
build back to a clearer understanding of joins.

Okay, let's go. Suppose we are building a database for a charity group which
wants to keep track of all the volunteers who've joined and all the activities
they undertake. We'll keep things simple and introduce other aspects as we go
on. Activities within the charity can be broken down into what needs to be done
and where it should be done. Multiple activities can take place in the same
location so we'll have to separate the two. The 'what' is captured by the
**task** table and the 'where' is captured by the **venue** table. Again there's
probably more attributes that we need to capture but this will do for now:

```sql
create table if not exists venue(
    venue_id serial primary key,
    place varchar(50)
);

create table if not exists task(
    task_id serial primary key,
    venue_id integer references venue(venue_id),
    date date default now(),
    details text
);
```

And a couple of values to use for queries:

```sql
insert into venue(place)
values
    ('St John''s Church'),
    ('Apollo Orphanage'),
    ('Red Cross Center'),
    ('Rio Nursing Home'),
    ('Southfield Correctional Center');

insert into task(venue_id, details)
values
    (2, 'Donate clothes, play with children'),
    (2, 'Teach music lessons'),
    (1, 'Clean compound'),
    (1, 'Sing christmas carols'),
    (3, 'Blood donation drive'),
    (4, 'Cook food');
```

Now a typical query is for generating the list of all tasks that potential
volunteers might want to sign up for. Being a synthetic key, the _venue id_ is
meaningless to humans so we'll have to retrieve the related location name. We
can't use joins yet (until we see how they fit in); we'll have to use the
cross-product. And if you're unfamilar with what cross-products are exactly,
we'll get to it soon enough.

To get the cross product of two or more tables, we simply list the tables in the
_from_ clause separating each name with a comma: we can think of the comma as
the cross-product operator:

```sql
select *
from task, venue;
```

If you run the query above, you'll get an error since both _task_ and _venue_
have a _venue_id_ column hence the query is ambiguous. Just like joins, when it
comes to cross-products, it's best to specify the exact columns from which
tables that we require in order to avoid such errors:

```sql
select details, date, place
from task, venue;
```

However, this query returns 30 rows when we only expect 6 (as we have 6 tasks).
We even get rows for the 'Southfield Correctional Center' which shouldn't be in
the result set since no task is allocated there. This is because, given SQL's
roots in set theory, the cross-product is similar (if not equivalent) to the
cartesian product of two sets: given two tables T1 and T2, take a row in T1,
pair it one by one with **all** the rows in T2 and repeat for this procedure for
the rest of the rows in T1 resulting in a mega-table. Think of it as a for-loop
within a for-loop. In majority of cases, we don't need all the rows that a
cross-product returns; on running the following query, we can see which specific
rows we require from the cross-product:

```sql
select t.venue_id, v.venue_id, details, date, place
from task t, venue v;
```

Therefore, to get _only_ the relevant rows where the task is paired up with its
appropriate location, we use the where clause to filter the rest out:

```sql
select details, date, place
from task t, venue v
where t.venue_id = v.venue_id;
```

And this is pretty much how 'joins' (specifically the **inner join**) can be
carried out without using a join statement, by using cross-product and row-level
filters!

It also illustrates a couple of things which were not obvious (at least to me)
when using join statements:

One, given how we are using the **task.venue_id** in the _where_ clause to
'simulate' the join, a foreign key column is just that, a column like any other
column: when a column stores foreign keys it does not create any sort of
underlying links and pointers between the two tables, a conceptualization
mistake I made at first when trying to understand joins and foreign relations.

In fact, as I was trying to find out whether such 'links' are created in SQL, I
instead learned the opposite: unlike previous database models, the relational
model (which SQL databases implement) deliberately eschews any form of explicit
links between collections of data i.e. the tables...

Let's pause a bit and take a trip down memory lane. For brevity's sake, let's
skip the pre-cambrian era where there were no databases and head straight to
triassic period when the first databases were emerging. One key aspect that
drove database development and evolution was the question: _how should the data
be represented?_ Moreover, since data in 'real life' is usually interlinked, how
should such relationships be outlined. Given the interests of both businesses
and academia, various data models were proposed in the 70s and 80s to address
this key issue.

One of the first models proposed was the **Hierarchical Model**. From Wikipedia,
we have the following description of this model:

> A hierarchical database model is a data model in which the data are organized
> into a tree-like structure. The data are stored as records which are connected
> to one another through links. A record is a collection of fields, with each
> field containing only one value. The type of a record defines which fields the
> record contains. The hierarchical database model mandates that each child
> record has only one parent, whereas each parent record can have one or more
> child records. In order to retrieve data from a hierarchical database the
> whole tree needs to be traversed starting from the root node.

In our charity organization example, using the hierarchical model would entail
having the organization as the root. The next level is not as straightforward:
should the members come next or should the activities come next, or even the
activity locations. Suppose we have the members at the next level. For each
member node, we add the activity they signed up for as the children. This
results in duplication since there's no way to add a single canonical entry for
an activity. From there, under the activities, we add the location for the
activity. Again, we are duplicating location entries for each activity- as
always in database design, duplication is a huge red-flag. Now, suppose you are
tasked with generating for each location, the number of members who have
frequented there. Using SQL, this is straightforward. Under the hierarchical
model, not quit so. As the author and systems researcher Martin Kleppman notes,
the shortcomings of the hierarchical model were soon encountered when developers
had to model/generate many-to-many relationships or even when they tried to
carry out joins. (Btw, if you want a more indepth but beginner-friendly tour of
database models and how _history is being repeated again_ be sure to check out
chapter 2 of Kleppman's book, _Designing Data-Intensive Applications_).

Next, the **Network Model** was proposed. In jest, the thinking probably went
like this: what if we took the hierarchical structure, and simply allowed for
children nodes to have multiple parents - voila! many-to-many relationships. I
mean, it's a straight forward solution, one that I could see myself blurting
out. And just like the Hierarchical mode, this too had explicit links between
the records that you'd use to traverse the data. However, by solving this one
specific problem (the many-to-many relationships), the Network Model opened up a
whole can of worms. For one, how exactly do you query such a database in a way
that's straightforward and maintenable; for all its shortcomings, at least with
the hierachical model, you had a definite path to the desired record. There were
other additional factors that held back application and database developers from
adopting the network model and for a while the hierarchical model remained
dominant.

That was until the **relational model** was introduced. It's such a simple and
straightforward model, almost too simple: entities are represented as rows in a
table, and each column of the table represents an attribute of the given entity,
basically spreadsheets (air-quotes) on steroids. There are **no** links which
the application developer has to explicitly traverse so as to get the data:
instead, the developer writes a query that lays out the 'shape' of the data that
the developer wants back, (the shape itself conforming to a table), and the
query processor in the database figures out how to efficiently traverse its
internal data-structures in order to 'answer' this query correctly. In other
words, all the developer has to deal with is the abstraction of a table/relation
and the accompanying guarantees & constraints.

One thing to note (again) is that unlike the hierarchical and network model, the
relational model doesn't really specify explicit links: again, all you have to
work with are disparate tables. Instead, the relational model provides something
way more powerful, a _schema_. The database will enforce this schema come rain
or shine. Hence the 'C' in ACID - Consistency. At first, it's not apparent how a
schema solves the problem of interlinks and relationships but we'll see how. As
per the relational model, the column of each row has a domain that's specified
in the schema. Before any insert or modification of a value, the database checks
that the value belongs in its respective domain. If not, the db rejects the
value and 'throws' an error. This is what's referred to as 'schema-on-write'. It
is in contrast to some modern 'no-sql' databases that don't enforce any schema
at the db level - hence developers have to check if the data conforms to some
schema at the application level. This can be done before sending the data into
the database for insertion/updating (e.g. if you're using mongoose for mongodb
or the joi library for couchdb in node.js). It's referred to as
'application-level schema'. Alternatively, for no-sql databases that don't
support schemas, the application has to validate the data after reading it from
the database i.e. 'schema-on-read'.

Back to SQL and relational databases. When we declare a column as a foreign key
what we are in fact doing is simply adding a constraint at the schema level.
Zero 'links' are created. Instead the database ensures that for every non-null
value we add at that column, a corresponding value that it is equal to it exists
as a primary key in the referenced table. This is referred to as **Referential
Integrity**. For the sake of being pedantic, referential integrity is more
general, it does not require the referenced column to be a primary key- the
exact term we're looking for is **foreign-key constraint**.

Given that we've already created the table _task_, we can tack on foreign-key
constraint to our table as follows:

```sql
alter table task
add constraint constraint_task_venue_id_fk foreign key (venue_id) references venue (venue_id);
```

The foreign key constraint can also be added when defining the table.

```sql
create table if not exists task2(
    task_id serial primary key,
    venue_id integer references venue(venue_id),
    date date default now(),
    details text
);
```

As for joins, as we've seen, they boil down to row-level filters on the
cross-products of tables and are carried out during query time, NOT during
insertion or updating. Do note that sql databases carry out joins in a manner
that's way more efficient than simply creating a mega-table via cross-products
and filtering. The beauty though is that all these should be, and is abstracted
away from us. That's all there is to it logically, there are no links or
pointers added or to be traversed by the database user.

In addition, SQL provides some niceties when it comes to foreign keys. Suppose
the corresponding primary key is either deleted or modified (modifying a primary
key is another red flag to be watched out for in the database design, primary
keys should be as intransigient as possible). The database could be in a state
where one of the values, the 'former' foreign key, in one of the columns does
not belong in its specified domain, i.e. the db is in an inconsistent state,
which is a big no-no in SQL databases. In order to prevent this scenario, SQL
requires us to specify what should happen to the corresponding foreign keys when
one attempts to delete/modify a primary key.

On deletion we add one of the following keywords to tell the database what
course of action to take

- `on delete cascade`: we'll have the row which the foreign key is part of be
  deleted too

- `on delete set null`: the foreign key value is set to null

- `on delete set default`: if we have a reasonable default value, we can have
  the db resort to that value instead of null

- `on delete restrict`: we can outright prevent anyone from deleting the row
  with the primary key if there's any foreign key referencing it. If we don't
  specify any action, postgres defaults to _on delete no action_. The Postgres
  documentation explains that:

  > RESTRICT prevents deletion of a referenced row. NO ACTION means that if any
  > referencing rows still exist when the constraint is checked, an error is
  > raised; this is the default behavior if you do not specify anything. (The
  > essential difference between these two choices is that NO ACTION allows the
  > check to be deferred until later in the transaction, whereas RESTRICT does
  > not.)

On Updates, we can also add one of the following keywords:

- `on update cascade`: the foreign-key value is also changed to reflect the
  changes on the primary key
- `on update set null`: same as the deletion case
- `on update set default`: same as the deletion case
- `on delete restrict`: same as the deletion case
- `on update no action`: same as the deletion case

Therefore, if we wanted to be more explicit in our declaration for the table, we
could add the following keywords. One, we want to prevent any deletion of
locations for archival purposes. We also don't expect the primary key to change
especially since it's an artificial key, ie it has no meaning to us humans, it's
simply there to make each row unique. However, if a location were to change in
some way, eg demolished, and we wanted to capture this data, we could add a
column in the _venue_ table to indicate so.

```sql
create table if not exists task(
    task_id serial primary key,
    venue_id integer,
    date date default now(),
    details text,
    foreign key(venue_id) references venue on delete restrict on update restrict
);
```

To reiterate, we've seen how to do joins (inner joins) without using the _join_
statement. Surprisingly, when SQL was first specified, it did not have the
_join_ statement at all, joins had to be carried out using cross-products and
where clauses. _join_ and its variants were added to SQL in the SQL92
specification and implemented by database vendors subsequently.

Using _join_ for the same query above (in which used the cross-product and where
clause) turns out as so:

```sql
select details, date, place
from task t join venue v on t.venue_id = v.venue_id;
```

Since both the foreign key column and the primary key column have the same name,
we can use _using_ which is arguably cleaner:

```sql
select details, date, place
from task t join venue v using(venue_id);
```

And compared to cross-products plus row-level filters, using joins (if you
weren't already doing so) is the best way to approach such kind of queries not
only because it's much more readable (it seperates row-level filters from join
predicates) but also because it'll probably run faster as most query processors
optimize joins given it is the common case.

## Outer joins without the 'join' keyword

One last thing to point out is how to carry out an **outer join** without using
_join_. As a quick recap, outer joins are used to retain rows that would
otherwise be filtered out in an inner-join since they don't have a correspoding
row in the table being joined on. Suppose we've now started signing up members
for our charity organization:

```sql
create table if not exists volunteer(
    volunteer_id serial primary key,
    last_name varchar(30) not null
);

insert into volunteer(last_name)
values
    ('john'),
    ('smith'),
    ('mary'),
    ('william'),
    ('lou'),
    ('leia'),
    ('rael');
```

We then allocate tasks as so, presuming that no one volunteers to cook food or
donate blood:

```sql
create table if not exists allocation(
    task_id integer references task(task_id),
    volunteer_id integer references volunteer(volunteer_id),
    primary key(task_id, volunteer_id)
);
insert into allocation(volunteer_id, task_id)
values
    (1,1),(1,2),(1,3),(1,4),(2,1),(2,2),(3,1),(3,3),(4,1),(4,2),(5,1),(5,3),(6,1),(6,2),(6,3);
```

A query we might have to run at some point is to get for each task the number of
volunteers allocated, maybe so that we can distribute volunteers to tasks better
or for some other purpose:

```sql
select t.task_id, t.details, count(a.volunteer_id) as total_volunteers
from task t
    join allocation a using(task_id)
group by t.task_id
order by total_volunteers desc;
```

However, this discards rows from the _task_ table that don't have anyone
allocated to them, yet we need this information. By simply changing to a **left
outer join**, we get the required information:

```sql
select t.task_id, t.details, count(a.volunteer_id) as total_volunteers
from task t
    left join allocation a using(task_id)
group by t.task_id
order by total_volunteers desc;
```

If we were to do the same without a join statement, it gets a bit tricky. Let's
start with what we know so far, the inner join:

```sql
select t.task_id, t.details, count(a.volunteer_id) as total_volunteers
from task t, allocation a
where t.task_id = a.task_id
group by t.task_id
order by total_volunteers desc;
```

Now, the following is a trick I learned from Jennifer Widom's
[Databases course](https://lagunita.stanford.edu/courses/Engineering/db/2014_1/about);
to do an outer left join query without using join, we have to find a way to
include the rows that were filtered out by the _where_ clause and plug in either
null or the expected values.

```sql
select *
from (

    (select t.task_id, t.details, count(*) as total_volunteers
    from task t, allocation a
    where t.task_id = a.task_id
    group by t.task_id)

    union

    (select task_id, details, 0 as total_volunteers
    from task
    where task_id not in (select task_id from allocation))

    ) as task_counts
order by total_volunteers desc;
```

Here's another way of achieving the same results as above:

```sql
select t.task_id, t.details, count(volunteer_id) as total_volunteers
from
    task t,
    (
        (select * from allocation)
    union
        (select task_id, null
        from task
        where task_id not in (select task_id from allocation))
    ) as a
where t.task_id = a.task_id
group by t.task_id
order by total_volunteers desc;
```

And by they way, if you're curious about how Postgres manages foreign key
references for primary keys, its documentation provides the following. I presume
it's the same with other major relational databases.

> A foreign key must reference columns that either are a primary key or form a
> unique constraint. This means that the referenced columns always have an index
> (the one underlying the primary key or unique constraint); so checks on
> whether a referencing row has a match will be efficient. Since a DELETE of a
> row from the referenced table or an UPDATE of a referenced column will require
> a scan of the referencing table for rows matching the old value, it is often a
> good idea to index the referencing columns too. Because this is not always
> needed, and there are many choices available on how to index, declaration of a
> foreign key constraint does not automatically create an index on the
> referencing columns. - https://www.postgresql.org/docs/12/ddl-constraints.html

With that, I'd like to give credit to Martin Kleppman's _Designing
Data-Intensive Application_ which I referenced heavily for the history of
databases and Jennifer Widom's _Introduction to SQL_ course which massively
improved my understanding of SQL.
