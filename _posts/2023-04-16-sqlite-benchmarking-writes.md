---
layout: post
title:  "Benchmarking SQLite inserts"
slug: sqlite-benchmarking-writes
date:   2023-04-16 12:00:00 +0000
tag: ["rust", "sql", "sqlite"]
categories: Misc
excerpt_separator: <!--start-->
---

Going from 750 writes per second to 25,0000 with a bit of configuring

<!--start-->

## Overview

It's always worth replicating a benchmark, you know, for science. For today,
I'll be replicating
[Kerkour's SQLite inserts benchmark](https://kerkour.com/high-performance-rust-with-sqlite)
partly for the sake of it, partly to familiarize myself with using SQLite from
rust. Quick warning, expect a lot of hand-wavey-ness.

## Benchmarking

We'll use the following helper to set up the table:

```rust
fn init_db(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE users(
            id BLOB PRIMARY KEY NOT NULL,
            created_at TEXT NOT NULL,
            username TEXT NOT NULL
        )",
        (),
    )?;
    conn.execute("CREATE UNIQUE INDEX idx_users_on_id ON users(id)", ())?;
    Ok(())
}
```

And here's how the data is generated and inserted:

```rust
#[derive(Debug)]
struct User {
    id: uuid::Uuid,
    created_at: chrono::DateTime<chrono::Utc>,
    username: String,
}

let u = User {
    id: uuid::Uuid::new_v4(),
    created_at: chrono::Utc::now(),
    username: String::from("Someone"),
};

conn.execute(
    "INSERT INTO users(id, created_at, username) VALUES (?, ?, ?)",
    (&u.id.to_string(), &u.created_at.to_rfc3339(), &u.username),
)?;
```

My code differs quite a bit from Kerkour, particularly in the following ways:

- usage of the [rusqlite](https://github.com/rusqlite/rusqlite) instead of
  [sqlx](https://github.com/launchbadge/sqlx)
- usage of threads directly instead of tokio (which sqlx uses);

Relying solely on the SQLite and the driver's defaults, I get a paltry 756
inserts per second. This is with one thread. Building and running with release
mode, I get 764 inserts per second, so I probably need to tune some
sqlite-specific knobs here and there.

## Concurrent (multi-threaded) Inserts

With 4 threads and 10,000 inserts per thread, I get:
`DatabaseBusy...database is locked` inserts per second (aka some error). My
first guess is that it's probably the `threading mode` configuration. I know
that SQLite does not allow for concurrent write transactions but it should allow
for concurrent connections?

From SQLite's [documentation](https://www.sqlite.org/threadsafe.html), SQLite
supports the following threading modes:

1. Single-thread: all mutexes are disabled, unsafe to use in more than a
   single-thread at once
2. Multi-thread: can be used safely across multiple threads as long as no
   database connection is used simultaneously in two or more threads.
3. Serialized: safe to use by multiple threads with no restriction

The threading mode can be configured at compile-time, application start-time or
when creating a connection. SQLite's default mode is `serialized` which is what
I suspect is causing the `DatabaseBusy` error. However, as per rusqlite's docs,
rusqlite overrides this setting during connection into multi-threaded mode.
Assumption invalidated, so the error is probably at some other level.

My second hunch is that once a connection is used for Insert/Update/Drop, it
acquires a write-lock that it holds throughout the entirety of the connection
rather than per each statement execution/transaction. I'll definitely have to
dig into SQLite docs/internals at some point to confirm this but for the
time-being, I'll go by rustqlite's docs which don't (seem to) indicate that
connections are created lazily.

Therefore, a quick solution might be to create a connection for each insert:

```rust
for _ in 0..num_inserts_per_thread {
    let u = User::gen();
    let conn = rusqlite::Connection::open("db.sqlite").unwrap();
    conn.execute(
        "INSERT INTO users(id, created_at, username) VALUES (?, ?, ?)",
        (&u.id.to_string(), &u.created_at.to_rfc3339(), &u.username),
    )
    .unwrap();
}
```

This still doesn't prevent the `DatabaseBusy` error so I'm guessing I'll have to
treat it as a retriable error and ignore it:

```
let mut inserted = 0;
while inserted < num_inserts_per_thread {
    let u = User::gen();
    let conn = get_conn().unwrap();
    let res = conn.execute(
        "INSERT INTO users(id, created_at, username) VALUES (?, ?, ?)",
        (&u.id.to_string(), &u.created_at.to_rfc3339(), &u.username),
    );
    if let Err(e) = res {
        if e.sqlite_error_code() != Some(rusqlite::ErrorCode::DatabaseBusy) {
            panic!("{}", e);
        }
    } else {
        inserted += 1;
    }
}
```

One advantage of creating a connection for each insert is that threads can do
inserts in parallel rather than serially.

## Using connection pooling.

A slightly different solution is to use connection pooling. I am familiar with
connection pooling courtesy of Postgres-isms but it 'feels' awkward to use
pooling when the database is right there embedded in the process rather than
over across a network. I'll get back to this later on.

## Transactions

Alternatively, I could use explicit transactions for each insert. My guess is
that on commit/rollback, the connection cedes the write lock and on the next
insert within a given connection has to re-acquire the lock. I'll try this out
too to see if it works, plus also read the docs to see if this is the case.

## Optimizing single-threaded inserts.

Back to single-thread world; the roughly 750 inserts per second is still quite
low. Let's try some optimizations

1. Set journal mode to WAL. This immediately increases insert speeds from ~750
   to ~2500.
2. Set synchronous to `NORMAL`. This gets us to ~25,000 inserts per second.

Other optimizations I've tried event though they don't seem to have a huge
effect:

- Set `temp_store` to`MEMORY`
- Set `locking_mode` to`EXCLUSIVE`
- Set `cache_size` to ~1GB
- Use prepared statements
