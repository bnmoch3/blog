---
layout: post
title:  "Wrangling JSON with DuckDB"
date:   2023-07-25 12:00:00 +0000
tag: ["duckdb", "sql"]
categories: SQL
excerpt_separator: <!--start-->
---

<!--start-->

## Setting up the data

### Ingesting from CSV using pyarrow

The data we'll be using is the Github event data, specifically the Citus
[events.csv](https://examples.citusdata.com/events.csv) that's smaller.

Let's insert the events data into the databases, I'll be using pyarrow's CSV
module:

```python
import duckdb
import pyarrow as pa
import pyarrow.csv as csv

conn = duckdb.connect("events.db")
opts = csv.ReadOptions(
    column_names=[
        "event_id",
        "event_type",
        "event_public",
        "repo_id",
        "payload",
        "repo",
        "user_id",
        "org",
        "created_at",
    ]
)
events_csv = csv.read_csv("datasets/gh-events.csv", read_options=opts)
conn.sql("create table events as select * from events_csv")
```

Here's the inferred schema we get:

```
describe events;

┌──────────────┬─────────────┬─────────┬─────────┬─────────┬───────┐
│ column_name  │ column_type │  null   │   key   │ default │ extra │
│   varchar    │   varchar   │ varchar │ varchar │ varchar │ int32 │
├──────────────┼─────────────┼─────────┼─────────┼─────────┼───────┤
│ event_id     │ BIGINT      │ YES     │         │         │       │
│ event_type   │ VARCHAR     │ YES     │         │         │       │
│ event_public │ VARCHAR     │ YES     │         │         │       │
│ repo_id      │ BIGINT      │ YES     │         │         │       │
│ payload      │ VARCHAR     │ YES     │         │         │       │
│ repo         │ VARCHAR     │ YES     │         │         │       │
│ user_id      │ BIGINT      │ YES     │         │         │       │
│ org          │ VARCHAR     │ YES     │         │         │       │
│ created_at   │ TIMESTAMP_S │ YES     │         │         │       │
└──────────────┴─────────────┴─────────┴─────────┴─────────┴───────┘
```

### Alternative: DuckDB's CSV ingestion

We could also have used DuckDB's `read_csv_auto`. I used pyarrow out of habit.
For CSV, DuckDB has its advantages over pyarrow's. For example, it's able to
detect that `event_public` is boolean and empty strings in `org` are null.

```sql
create table events as
select * from read_csv_auto('datasets/gh-events.csv');
```

### Handling low-cardinality string columns

`event_type` has low-cardinality, no point leaving it as VARCHAR:

```sql
select count(distinct event_type) from events;

-- 14
```

Let's convert it into an enum, counting on DuckDB's feature for automatically
casting enums to varchar whenever necessary.

```sql
begin;

create type EVENT_TYPE as enum(
    select distinct event_type from events);

alter table events
    alter column event_type
    set data type EVENT_TYPE;

commit;
```

### Boolean values

`event_public` column should be boolean instead of varchar, since it consists of
't' and 'f' values:

```sql
alter table events
    alter event_public set data type BOOLEAN;
```

No need to wrap this within a transaction since all the necessary changes can be
done within a single statement.

## Checking that JSON is valid

DuckDB provides the `json_valid` to check if values are valid json. Given that
`org`, `repo` and `payload` should be json columns, let's check how many values
are in fact valid json:

```sql
pivot (
    select
        'repo_invalid' as col,
        count(*) as c
    from events
    where json_valid(repo) <> True

    union all

    select
        'payload_invalid' as col,
        count(*) as c
    from events
    where json_valid(payload) <> True

    union all

    select
        'org_invalid' as col,
        count(*) as c
    from events
    where json_valid(org) <> True
)
on col using first(c)
```

This results in:

```
┌─────────────┬─────────────────┬──────────────┐
│ org_invalid │ payload_invalid │ repo_invalid │
│    int64    │      int64      │    int64     │
├─────────────┼─────────────────┼──────────────┤
│       89272 │               0 │            0 │
└─────────────┴─────────────────┴──────────────┘
```

It seems `org` has a couple of non-json values. Let's get a sample:

```sql
select org
from events
where json_valid(org) <> True
using sample 5 rows;
```

This gives:

```
┌─────────┐
│   org   │
│ varchar │
├─────────┤
│         │
│         │
│         │
│         │
└─────────┘
```

Seems either there's a lot of empty strings, whitespace or newlines I'm not
quite sure.

Let's get rid of the whitespace (replace with empty strings):

```sql
update events
    set org = trim(org)
    where json_valid(org) <> True;
```

Next, let's set all the empty strings to NULL:

```sql
update events
    set org=NULL
    where org = '';

select count(*) from events where org is NULL; -- 89272
```

## JSON data type

DuckDB provides a JSON logical type. Given that `org`, `repo` and `payload` are
`VARCHAR`, converting them to JSON does not alter them as per the docs, instead
they are only parsed and validated.

Still, let's convert them to JSON, it doesn't hurt.

Ideally, I'd love to use this `alter` statement, but as of v0.8.1 it does not
work:

```sql
alter table events
    alter column repo set data type JSON using json(repo);
```

So we have to use this workaround:

```sql
begin;

alter table events add column temp JSON;
update events set temp = json(repo);
alter table events drop repo;
alter table events rename temp to repo;

commit;
```

Rinse and repeat for the `payload` and `org` columns.

## Deriving structure from JSON

DuckDB provides the `json_structure` function to get the structure of a JSON
value.

Let's start with `org`. I've placed the query in file 'query.sql' and piped the
output to `jq` so that it'll pretty-print the json. The query is as follows:

```sql
copy (
    select distinct
        json_structure(org) as structure
    from events
    where org is not null
) to '/dev/stdout'
with (format 'json')
```

And the shell command:

```
duckdb -json events.db < query.sql  | jq .structure
```

This outputs:

```json
{
  "id": "UBIGINT",
  "url": "VARCHAR",
  "login": "VARCHAR",
  "avatar_url": "VARCHAR",
  "gravatar_id": "VARCHAR"
}
```

Doing the same for `repo` we get:

```json
{
  "id": "UBIGINT",
  "url": "VARCHAR",
  "name": "VARCHAR"
}
```

However, `payload` isn't as straightforward, we've got 415 different schemas:

```sql
select count(*)
from (
    select distinct
        json_structure(payload) as s
    from events
);

-- 415
```

We'll have to handle it differently.

## Converting JSON to struct

Before going any further, since `repo` and `org` have a given structure, let's
convert them to struct values.

This is not just for the sake of it, structs have a performance and space
advantage over JSON since internally, the struct's fields are maintained as
separate columns (which is DuckDB's bread and butter). Also querying struct
values is more ergonomic: we use dot operators rather than JSON paths. Still,
you should only consider converting JSON to struct if you're sure the schema is
static and it's values aren't too nested.

Recall we used `json_structure` to retrieve the structure for `repo` and `org`.
We now plug the respective results into `json_transform_strict` to convert the
JSON values into structs:

For `repo`:

```sql
alter table events
alter column repo
    set data type struct(id uinteger, url varchar, name varchar)
    using json_transform_strict(
        repo, '{"id":"UBIGINT","url":"VARCHAR","name":"VARCHAR"}'
    );
```

For `org`:

```sql
alter table events
alter column org
    set data type struct(
        id          uinteger,
        url         varchar,
        login       varchar,
        avatar_url  varchar,
        gravatar_id varchar
    )
    using json_transform_strict(
        org,
        '{
          "id": "UBIGINT",
          "url": "VARCHAR",
          "login": "VARCHAR",
          "avatar_url": "VARCHAR",
          "gravatar_id": "VARCHAR"
        }'
    );
```

## Handling heterogeneous JSON

Back to `payload` values. We could use `json_group_structure` to get the
combined `json_structure` of all the payload values:

```sql
select
    json_group_structure(payload) as structure
from events
```

But this ends up being a really huge structure; piping it to `jq` then counting
the lines with `wc`, I get 784 lines. Using `json_keys` (this returns the keys
of a json object as a list of strings), there are 20 distinct top-level keys:

```sql
with t as (
    select
        json_group_structure(payload) as structure
    from events
)
select 
    count(*)
from (
    select unnest(json_keys(structure)) from t
) -- 20
```

My hunch is that for each `event_type` we've got a different structure for
`payload`:

Let's do a rough test:

```sql
with t as (
    select
        event_type,
        count(distinct json_structure(payload)) as s_count,
        json_group_structure(payload) as structure
    from events
    group by 1
)
select
    event_type,
    s_count,
    list_sort(json_keys(structure))[:3] as keys -- pick first 3 only
from t
order by s_count desc;
```

This results in:

```sql
┌───────────────────────────────┬─────────┬───────────────────────────────────────────┐
│          event_type           │ s_count │                   keys                    │
│          event_type           │  int64  │                 varchar[]                 │
├───────────────────────────────┼─────────┼───────────────────────────────────────────┤
│ PullRequestEvent              │     208 │ [action, number, pull_request]            │
│ IssueCommentEvent             │      77 │ [action, comment, issue]                  │
│ PullRequestReviewCommentEvent │      61 │ [action, comment, pull_request]           │
│ IssuesEvent                   │      42 │ [action, issue]                           │
│ ForkEvent                     │       8 │ [forkee]                                  │
│ ReleaseEvent                  │       6 │ [action, release]                         │
│ CreateEvent                   │       4 │ [description, master_branch, pusher_type] │
│ PushEvent                     │       2 │ [before, commits, distinct_size]          │
│ CommitCommentEvent            │       2 │ [comment]                                 │
│ GollumEvent                   │       1 │ [pages]                                   │
│ WatchEvent                    │       1 │ [action]                                  │
│ MemberEvent                   │       1 │ [action, member]                          │
│ DeleteEvent                   │       1 │ [pusher_type, ref, ref_type]              │
│ PublicEvent                   │       1 │ []                                        │
├───────────────────────────────┴─────────┴───────────────────────────────────────────┤
│ 14 rows                                                                   3 columns │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Some event types like DeleteEvent and MemberEvent have a single structure while
others (PullRequestEvent, IssueCommentEvent etc) have multiple structures. Since
the data's from github, at this point the best step is to find where they've
documented payload's structure so as to understand it better.

## Querying JSON

Let's query push events. Using `json_group_structure`, we get the following
schema for Push events:

```json
{
  "ref": "VARCHAR",
  "head": "VARCHAR",
  "size": "UBIGINT",
  "before": "VARCHAR",
  "commits": [
    {
      "sha": "VARCHAR",
      "url": "VARCHAR",
      "author": {
        "name": "VARCHAR",
        "email": "VARCHAR"
      },
      "message": "VARCHAR",
      "distinct": "BOOLEAN"
    }
  ],
  "push_id": "UBIGINT",
  "distinct_size": "UBIGINT"
}
```

Let's get the average number of commits per push. For this, we're using
[JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901) to specify the
location of the `"commits"` field.

```sql
select
    avg(
        json_array_length(payload, '/commits')
    ) as average_num_commits,
from events
where event_type = 'PushEvent'
```

The result:

```
┌─────────────────────┐
│ average_num_commits │
│       double        │
├─────────────────────┤
│  1.5937930592495273 │
└─────────────────────┘
```

However this doesn't give us the "true" average since the list of commits in
payload holds only up to 20 commits and the rest have to be fetched separately.
We have to use the "size" field instead:

```sql
select
    avg(
        cast(json_extract_string(payload,'size') as UINTEGER)
    ) as average
from events
where event_type = 'PushEvent'
```

we get:

```
┌────────────────────┐
│      average       │
│       double       │
├────────────────────┤
│ 3.0845803826064664 │
└────────────────────┘
```

So on average, each push has around 3 commits.

Next, each commit has an author. Let's get the top 5 authors by number of
commits made. For this we'll use JSONPath to pluck out the fields.

```sql
with t as (
    select
        unnest(
            from_json(json_extract(payload, '$.commits'),
            '["JSON"]')
        ) as v
    from events
    where event_type = 'PushEvent'
)
select
    v->>'$.author.name' as name,
    count(*) as num_commits
from t
group by 1
order by 2 desc
limit 5
```

This gives:

```
┌─────────────────────────┬─────────────┐
│          name           │ num_commits │
│         varchar         │    int64    │
├─────────────────────────┼─────────────┤
│ OpenLocalizationService │         947 │
│ Costa Tsaousis          │         780 │
│ Jason Calabrese         │         550 │
│ Junio C Hamano          │         395 │
│ Jiang Xin               │         341 │
└─────────────────────────┴─────────────┘
```

Note that I used `->>` to extract the authors' names since I want it to be
VARCHAR instead of JSON.

Finally, let's search through commit messages

First let's unnest the commit messages. We'll store the commit messages in a
temporary table to simplify querying. Temporary tables are session scoped and
once we exit, they'll be deleted. We'll also set `temp_directory` so that the
table can be spilled to disk if memory is constrained.

```sql
create temporary table commit_messages as
select
    row_number() over() as id, -- assign sequential id
    v->>'sha' as commit_hash,
    v->>'message' as msg,
    event_id -- to retrieve associated event
from (
    select
        event_id,
        unnest(
            from_json(json_extract(payload, '$.commits'),
            '["JSON"]')
        ) as v
    from events
    where event_type = 'PushEvent'
);

set temp_directory='.';
```

Let's start by retrieving the percentage of commit messages that start with
'merge pull request':

```sql
select
    round((
        count(*) /
        (select count(*) from commit_messages)
    ) * 100, 2) as percentage
from commit_messages m1,
where starts_with(lower(m1.msg), 'merge pull request')
```

This gives:

```
┌────────────┐
│ percentage │
│   double   │
├────────────┤
│       4.47 │
└────────────┘
```

Next, let's build a full text search index over the commit messages:

```sql
pragma create_fts_index('commit_messages', 'id', 'msg');
```

We can now search stuff. For example, to get commit messages containing the term
"sqlite":

```sql
select
    event_id,
    msg
from (
    select
        *,
        fts_main_commit_messages.match_bm25(id, 'sqlite') as score
    from commit_messages
) t
where score is not null
order by score desc
```

This results in 31 rows:

```
┌────────────┬──────────────────────────┐
│  event_id  │           msg            │
│   int64    │         varchar          │
├────────────┼──────────────────────────┤
│ 4950877801 │ Remove sqlite3           │
│ 4951160992 │ added sqlite3            │
│ 4950954420 │ Delete db.sqlite3        │
│ 4951123085 │ Update #11\n\nAdd SQLite │
│ 4951201866 │ add sqlite config        │
└────────────┴──────────────────────────┘
```

## Wrapping up

There's lots of other queries to try out, especially on the full github dataset.
Querying JSON can be tricky since it involves a lot of plucking fields and
unnesting entries, plus different values probably have different schemas. DuckDB
does make things a bit easier though by providing various functions and helpers.
And some SQL know-how really goes a long way when dealing with JSON.

## References/Further Reading

- [Shredding Deeply Nested JSON, One Vector at a Time](https://duckdb.org/2023/03/03/json.html)
- [JSON - DuckDB docs](https://duckdb.org/docs/extensions/json)
