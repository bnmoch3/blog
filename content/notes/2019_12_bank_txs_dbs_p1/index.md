+++
title = "Handling Bank Transactions, V1"
date = "2019-12-04"
summary = "Overview of a simplified Node.js-based API + Postgres database layer for handling a bank's intra-account transfer operations"
tags = ["PostgreSQL"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "sql-bank-txs-v1"
+++

The following is a not-so-brief overview of my solution to the
[Transactions at the bank](https://github.com/namshi/coding-challenges/blob/master/transactions-at-the-bank.md)
coding challenge. The challenge entails a rewriting a bank's API for handling
money transfer between accounts. This is the first version of my solution which
works under the assumption that the database design provided in the prompt
should remain as is. The full code is in this
[repository](https://github.com/nagamocha3000/bank_transactions_v1/).

### Setting up the database

I'll be using Postgres for the database. The prompt provides a scaffolding for
the table designs. Fleshing it out into actual SQL, we have:

```sql
create table balances (
    account_nr serial primary key,
    balance numeric(12,2)
);

create table transactions(
    reference serial primary key,
    amount numeric(12,2),
    account int references balances not null
);
```

Additional constraints, such as on the minimum balance allowed, could (and
should) be added, but again (as stated above) I'm working with the assumption
that the database layer is off-limits for the API rewrite. However, I did add
the _not null_ constraint on the _transactions.acccount_ column since a
transaction record without an associated account does not make sense

Just to have some data to play around with, I inserted a couple of accounts as
follows:

```sql
insert into balances(balance)
values (100),(100),(100);
```

The next step is setting up the connection from node.js to postgres. The
node-postgres/[pg](https://node-postgres.com/) library is perfect client library
for this, since it's very minimal but also flexible given that it supports both
callbacks and async/await. I followed the project structure that the
node-postgres documentation suggests
[here](https://node-postgres.com/guides/project-structure) by having a _central_
file for connection and configuration

Since I intended to use async/await style through out the rest of the program,
it sufficed to export data-access functions that returned promises. _query_
isn't used at all so far but it doesn't hurt to have it there. _getClient_
though is key - each bank transfer transaction requires its own client instance
and due to the way postgres handles transactions, using a connection pool will
not work.

```javascript
// src/lib/db/index.js
const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  query,
  getClient,
};
```

Worth noting is that the pg library explicitly avoids type-conversions in cases
where even slight innacuracies may be introduced, instead returning the values
as strings. Such is the case with the numeric datatype which is used to store
account balances in the _balances_ table.

The pg library though provides an interface through which we can define our own
data-type conversions. Since the program is going to be checking whether a
sender's balance is above a certain threshold before approving the transfer,
type conversion for numeric values is added:

```javascript
// src/lib/db/index.js
//parse numeric(12,2) from db to js floats
types.setTypeParser(1700, (val) => parseFloat(val));
```

For further details as to how and why the data-type conversion is set as so, do
read through the node-pg-types documentation
[here](https://github.com/brianc/node-pg-types)

Finally, also checked in all the sql files (under the db/sql/ directory)
relevant to the database. This serves two purposes: one, to enable other
programmers to recreate the database layer; two, for quick documentation. Using
them for documentation though without keeping the files up to date can lead to
innacuracies whereby a change is made to the db (e.g. adding a collumn to a
table), but that is not reflected in the sql files.

### Overview: The SQL bank transfer procedure

File and directory organization is by 'business component' rather than technical
role, as per the following best practice:
'[Structure your solution by components](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/projectstructre/breakintcomponents.md)'.
Therefore all the files related to carrying out the transfer are in the
src/api/transfer/ directory. As usual, index.js provides the starting point for
grokking through the rest of the directory.

Let's start with the function that interfaces directly with the database:
_insertTransfer_. It's located in the transferDAL.js file. _insertTransfer_
handles all the bank transfer 'sql stuff'. From a caller's perspective, it takes
in the transfer details consisting of _from_, _to_ and _amount_ details, and
returns either the transaction payload if successful, or throws an error.

In future, _insertTransfer_ should only handle transfer sql stuff and leave the
construction of the transfer result payload to some other function particularly
when the payload starts being more complex, nested and involving queries
tangential to the actual money transfer.

As for the errors, we'll talk more about how they are structured later on but
for now, there are two kinds of errors that _insertTransfer_ can throw:
pre-defined bank customer errors (eg those arising from the user's input) and
non-user errors (such as the database connection failing for some reason
mid-transaction).

And now, for the actual code. Let's start with the _insertTransfer_ signature:

```javascript
// src/api/transfer/transferDAL.js
//either resolves to id of transfer if successful or errors out
const insertTransfer = ({ from, to, amount }) => async (client) => {
  // ... function body
};
```

The function is kind of curried. First, the object containing the transfer
details(from, to & amount) is fixed and an async function expecting the client
(via which it sends the sql commands) is then returned.

Let's see why. The first version of this function was responsible for both
creating an instance of the db client , releasing it, watching out for any
errors arising, on top of all the 'sql bank transfer stuff'. As such, it was
quite tangled given that it was taking on multiple concerns. Therefore, on
rewrite, the intention was to have _insertTransfer_ be limited to the 'sql
transfer stuff' and have some other part of the program manage the client
instance including any client related errors arising.

If you check out the file transferController.js, here's the line where
_insertTransfer_ is invoked:

```javascript
// src/api/transfer/transferController.js
checkDBClientErrs(insertTransfer(details));
```

The transfer details are fixed and then _checkDBClientErrs_ is responsible for
invoking the function that is returned. And from it's name, _checkDBClientErrs_
handles the errors leaving _insertTransfer_ to be concerned solely with the sql
stuff.

In fact, let's go to _checkDBClientErrs_ - it's short enough that the entire
code can be included:

```javascript
// src/api/transfer/transferController.js
const checkDBClientErrs = (runSQL) => (client) =>
  new Promise((resolve, reject) => {
    client.on("error", reject);
    runSQL(client)
      .then(resolve)
      .catch(reject)
      .finally(() => client.release());
  });
```

As you can see, _checkDBClientErrs_ too is curried. This isn't as necessary as
in the case of _insertTransfer_ but it's convenient for time being. The first
argument then ends up being the function returned from _insertTransfer_ and
later on, the _client_ argument is fixed. Right now it might seem jambled but,
spoiler alert, when we get to the _handleTransfer_ function that pipes every
async thing together, hopefully it will all make sense.

On _checkDBClientErrs_, it could set up the _client_ instance by itself and in
future rewrites, I might end up having it as so. But for now, I intended for it
to have one task and that is to watch out for errors arising from the _client_
instance. Well, it does have another task which is to release the _client_
regardless of whether _runSQL_ throws an error or is successful - I haven't yet
come up with a way of delegating this elsewhere.

Another benefit for currying _insertTransfer_ in the way I did is that, when
_checkDBClientErrs_ invokes it, _checkDBClientErrs_ doesn't have to care about
which arguments are passed to _runSQL_ beyond a _client_ instance. Therefore,
_checkDBClientErrs_ can potentially be reused with other _runSQL_ functions that
encapsulate SQL transactions.

_checkDBClientErrs_ returns a promise- again, this will make sense once we get
to the function that brings in everything together, _handleTransfer_.

### Details: The SQL bank transfer procedure

Now, back to _insertTransfer_. The transaction isolation level used is **read
committed**. Even though this is the default in Postgres, it's made explicit to
make the intentions and assumptions regarding the entire procedure much clearer
to whoever reads the code.

From a glance, _insertTransfer_ checks whether the sender's balance is
sufficient; it then deducts the amount from their account and adds to the
receiver's account. Finally, it records the transaction by inserting into the
_transactions_ table.

With regards to concurrency issues, while a lock is used on the sender's row
(for reasons explained below), I don't think the receiver's row needs to be
locked explicitly through out the entirety of the transaction. As per the
postgres documentation, the guarantees the _read committed_ isolation level
provides ensure that updates to the selected rows only use the 'latest'
committed balance values and during the updates - other similar concurrent
updates have to wait for our transaction to either commit and rollback.

For the lock used; Unless absolutely necessary, such as in
[this](https://layerci.com/blog/postgres-is-the-answer/) case, I'm not a big fan
of using locks in postgres. I find them more complex and I always have that
nagging feeling that I've made some subtle concurrency error somewhere. That
being said, I've used one in _insertTransfer_, half-heartedly. This is so that
errors arising from an invalid sender id can be distinguished from errors
arising from an insufficient balance. If it were up to me, I'd push such a check
to the database level (using a _plpgsql_ function) but as stated in the
introduction, I'm working under the assumption that modifications to database
layer are not allowed as part of the API rewrite. A better solution though is to
assume that some other part of the application (eg the user authorization
middleware) will ensure that the _sender's id_ is valid and once that's in
place, the _select ... for update_ query can be removed.

### Debouncing transfer calls

One of the requirements is that to put checks in place for whenever customers
tap on the "pay/transfer" button more than once by accident. A quick solution I
opted for is to use _debouncing_. I got the idea from front-end development
whereby _debouncing_ logic is used to prevent an event-handler such as those
listening for scroll movements from being called too many times within a narrow
time-frame thus leading to performance issues.

Before getting into how the _debouncing_ is implemented, it's worth pointing out
that I don't think this is the right place to have the debouncing logic. If
anything, with having it at the API route handler, it's more of a throttle.
However, given the scope of the exercise, I included it here for the sake of
completeness.

In my opinion, debouncing transfer requests should be handled at two levels, the
database level and the UI level. First, debouncing ought to be handled also at
the UI level. The UI should make it explicit to a user that they are attempting
to send in the same transfer multiple times. From there, the database model
should be designed such that a transfer is separated further into two parts: the
transfer _request_ and the transfer confirmation. Regardless of how many
transfer requests are sent in, e.g. from the user mistakenly doing so, a user
can only confirm one transfer request at a time. The rest of the unconfirmed
requests are then timed out and the user has to do a separate transfer request,
if they really were being deliberate to begin with. Additionally, confirming a
transfer request is made idempotent in that a user can confirm the same request
multiple times but it's only processed once. This is the approach I use in my
second version of the solution where I assume I can also rewrite the database
models for the bank. On second thought though, after implementing debouncing at
the db level [here]() it seemed to me as an over-use, resulting in less
extensibility and requiring more complicated database models and procedures. The
best of both worlds seems to be placing the logic for debouncing in the
application and the state in a separate cache such as redis.

Now, for the implementation. You can find it in the file
src/api/transfer/transferUtils.js. The debouncing mainly relies on a specialized
cache. This cache should supply a procedure _checkSert_, which atomically checks
whether a key is present and if not, inserts the key with the given expiry time.
The underlying cache can be _anything_, even redis. But for the time being, the
standard library's Set data structure is used.

When a transfer comes in, it's hashed and the hash is _checkSerted_. If it
passes the check, then it's assumed that a previous equivalent transfer has just
been sent in in let's say the past 5 seconds. Therefore this transfer is
debounced and the user is informed of the same. Since the transfer request
payload isn't too large, for now, the hashing function _getTXKey_ simply appends
the strings.

Overall, we end up with the following. Note that the _checkSert_ method should
be asynchronous/ return a promise both for performance reasons and since it'll
be composed with other asynchronous functions:

```javascript
//src/api/transfer/transferUtils.js
const getTxKey = ({ from, to, amount }) => `${from}!${to}!${amount}`;

const debounceTx = ((cache) => (transferDetails = {}) => {
  const txKey = getTxKey(transferDetails);
  const expire = 5000;
  return cache.checkSert(txKey, expire).then(() => transferDetails);
})(getCache());
```

### Handling errors in _handleTransfer_

On errors: there are two kinds of errors to handle, errors arising from user's
input; And what I can call 'internal errors' for example if the db connection
fails mid-transaction or I made a coding mistake somewhere. As much as possible,
I want to avoid exposing internal errors to users, one for security reasons and
two, for users, such information is not helpful or actionable.

Since the scope of the coding challenge is limited to transfers, the only class
of user errors that can arise are _Transfer Errors_ such as having insufficient
funds or trying to send money to a non-existent account. For transfer errors,
the convention used is much closer to Golang style where errors are treated as
constant values and therefore usually pre-instantiated. In this codebase, (the
set of) all transfer errors are instantiated and detailed in the
src/api/transfer/transferErrors.js file. From there, they are exported and
functions such as _insertTransfer_ can throw them when they encounter a
particular customer error.

So as to distinguish them from 'internal' errors, they are marked instead as
_operational errors_ using the _markAsOperationalError_ function. Since Error
instances are objects, this function sets the _isOperationalError_ property on
them to true. Additionally, the _isTransferErr_ is also set specifically on
transfer errors to distinguish them from other operational errors. Therefore,
error handlers can distinguish operational/expected/customer errors from
internal/unexpected errors and handle them accordingly.

For example, in src/api/transfer/transferController.js, we have the function
_handleTransferErr_ which is as follows. It checks if the error arising during a
transfer is a transfer error. If not, it throws the error and lets some other
part of the codebase handle it accordingly. If so, it logs the error and
constructs a payload for the customer to inform them of what went wrong in their
transfer

```javascript
//src/api/transfer/transferController.js
const handleTransferErr = (err) => {
  if (!err.isTransferErr) throw err;
  logger.info({ transferError: err.transferErrCode });

  return Promise.resolve({ transferError: err.transferErrCode });
};
```

### Bringing everything together: _handleTransfer_

Finally, the raison d'être, _handleTransfer_.

I've already detailed _checkDBClientErrs_, _insertTrasnfer_, _handleTransferErr_
and _debounceTx_. What _handleTransfer_ does is compose all these functions
together. In addition, it uses _getClient_ to instantiate a client for the
transaction and _handleTxError_ to catch and swallow up any error arising
through out the entire endeavour. The caller of the function should not have to
worry about handling any non-internal error: they either get a payload object
indicating the transfer is successful, or a payload object that indicates an
error occured and which kind of error it was. The caller can then serialize the
object into JSON and send it to the user. That's all there is to it!

```javascript
//src/api/transfer/transferController.js
//excerpt of handleTransfer ...
((details) =>
  validate(details)
    .then(debounceTx)
    .then(db.getClient)
    .then(checkDBClientErrs(insertTransfer(details)))
    .catch(handleTransferErr));
```

### Additional details

1. There is a _validate_ function for transfer details that uses the _hapi/joi_
   library to ensure that the transfer details that clients send contains only
   the fields required. It's implementation is in the
   transferDetailsValidator.js file and its sole usage is in the
   _handleTransfer_ function.

2. For security reasons, the transfer payload is limited to 200b, unless
   additional fields need to be included in the future, for now, this suffices.
   Furthermore, whenever, the standard express json parsing middleware
   encounters a json parsing error, it throws this error. Distinguishing this
   error from other internal errors is
   [tricky](https://github.com/expressjs/body-parser/issues/122) and without
   doing so, clients end up getting a http 500 internal server error. The
   solution I've currently opted for is to wrap _express.json_ into another
   middleware:

   ```javascript
   //src/api/index.js
   const parseJSONMiddleware = (() => {
     const parseJSON = express.json({
       strict: true,
       limit: "200b",
     });
     return (req, res, next) =>
       parseJSON(req, res, (err) => (err ? res.sendStatus(400) : next()));
   })();

   api.use(parseJSONMiddleware);
   ```

3. Rate limiting middleware is also used, for security reasons:

   ```javascript
   //src/app.js
   app.use(
     rateLimit({
       windowMs: 10 * 60 * 1000, // 10 min
       max: 100,
       headers: false,
     }),
   );
   ```

4. Logging is centralized and ouput to the stdout from where it can be
   redirected to wherever needed. The _pino_ module is used for logging and
   tracing via request-response trace IDs is incorporated. Further details on
   how this is implemented are laid out
   [here](https://www.nagamocha.dev/trace-ids-logging-nodejs/).

5. Running the app locally is straightforward. Simply clone the project, do a
   'yarn install' to install the dependencies and finally run 'yarn dev'.
   Remember to set the required environement variables before launching, they
   are pretty much self-explanatory:

   ```bash
   # .env
   # APP 
   PORT=3000
   NODE_ENV=development
   # POSTGRES 
   PGUSER=...
   PGPASSWORD=... 
   PGHOST=...
   PGPORT=...
   PGDATABASE=...
   ```