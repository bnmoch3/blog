+++
title = "PG Transactions & Isolation levels: Airline Seat Booking"
date = "2019-11-20"
summary = "Using the right isolation level to avoid nasty billing errors when building database-managed booking systems"
tags = ["PostgreSQL", "SQL"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "airline-tx-postgres-isolation-levels"
+++

The following is a quick write-up of my solution to the
[Airline seat booking problem](https://sqlzoo.net/wiki/Transactions_Airline)
posted in the tutorial site, SQLZoo. The problem provides (buggy) code for a
system whereby, whenever a customer wants to book a seat in a plane, they are
supposed to be assigned the lowest numbered seat and charged. However, under
high concurrency (as the system currently stands) two or more customers might be
assigned the same seat and charged, yet only one ends up with the seat -
definitely not an ideal situation. Given that a relational database is used
underneath, the solution boils down to determining the correct isolation level
to be used so as to prevent such errors. If you haven't done so, do read the
prompt provided in the link above, the rest of this post assumes familiarity so
as to avoid unnecessary repetition. I changed things a bit in my code though,
shifting the stack from PHP and MySQL to Javascript(nodejs) and Postgres - but
essentially, the tables and the logic remain the same.

A **serializable** isolation level is the most straightforward solution. Under a
serial order, only one customer would be able to book a seat at a time. However,
the guarantees it provides are far more than what is really required, and if a
lower isolation level can be used, it's worth it since it would require less
resources and allow for handling a greater number of concurrent bookings.

Let's start from the lowest isolation level, **read uncommitted** - and...
immediately skip it. One, Postgres does not support it, (unlike MySQL). Two,
even if Postgres did, it would lead to a whole lot of charging customers for
seats they didn't even manage to book in the first place.

Next, **read committed**. Minus changes to the configuration, this is the
default isolation level in postgres. Within this isolation level, each statement
in the transaction sees all hitherto committed changes. Still, it does not
prevent the booking errors. This can be demonstrated as follows. Suppose we have
to customers, the famous Alice and Bob, booking concurrently as follows:

```
Alice : selects empty seat which happens to be seat 1

Bob   : selects empty seat which happens to be seat 1
Bob   : updates seat entry to their name
Bob   : gets charged
Bob   : commits

Alice : updates seat entry to their name
Alice : gets charged
Alice : commits
```

Bob is charged even though he loses his seat to Alice. This anomaly is referred
to as **lost updates**. Both Alice and Bob are concurrently make an update to an
entry that's contigent on the initial entry being a certain value (in this case,
the customer value for a seat being null). However, since Bob commits his update
before Alice does, Bob's update essentially gets lost even though he is charged.
To put it in a different way, Alice makes a modification which ignores Bob's
update, hence it's as if Bob's update never occured in the first place - it's
lost.

Logically, the next isolation level to consider is the **repeatable read**
level. Unlike _read committed_, in _repeatable read_, each query within the
transaction block only sees data committed just before the transaction began -
and are isolated from any uncommitted or committed changes caused by other
concurrent transactions.

Suppose the same Alice and Bob scenario occurs with the same flow of events but
under a _repeatable read_ isolation level. Bob still commits his transaction,
gets the seat and is charged. However, when Alice tries to carry out the update,
her transaction errors out. This is because in _repeatable read_, during a
select, update or delete, if the target row has been modified by another
concurrent transaction (Bob's), then Alice's transaction has to wait for Bob's
to either commit or rollback. If Bob's transaction sends a rollback, Alice's
transaction can proceed modifying the target row, hence getting the seat.
Otherwise, if Bob's transaction commits, Alice's transaction fails. Alice should
then abort her transaction and retry booking for a different seat.

This is captured in the following code segment. First, we have the function
**getSeat** which given a customer's name and a db client instance performs the
following operations:

1. Get an empty seat with the smallest seat number

2. If all the seats are taken, return null

3. Otherwise, assign the seat to the customer by their name and charge them.
   Return the seat number assigned

```javascript
const getSeat = (customerName) => async (db) => {
  const { rows } = await db.query(
    `select min(seat_number) empty_seat 
            from airplane_seat a where a.customer_name is null`,
  );
  let seatNumber = rows[0].empty_seat;
  if (seatNumber !== null) {
    await db.query(
      `update airplane_seat
            set customer_name = $1 
            where seat_number = $2`,
      [customerName, seatNumber],
    );
    await db.query(
      `insert into charge(customer_name, amount)
            values($1, 100);`,
      [customerName],
    );
  }
  return seatNumber;
};
```

The next step is to have a means for wrapping it into a transaction. Since
_repeatable read_ level is being used, if a serialization error occurs, the
_getSeat_ procedure should be invoked again to retry for a different seat:

```javascript
const makeTransaction = async (doSQL) => {
  let serializationErrOccured = false;
  do {
    const client = await db.getClient();
    try {
      await client.query("begin transaction isolation level repeatable read");
      const res = await doSQL(client);
      await client.query("commit;");
      return res;
    } catch (err) {
      await client.query("rollback");
      serializationErrOccured = err.code === "40001";
      if (serializationErrOccured === false) throw err;
    } finally {
      client.release();
    }
  } while (serializationErrOccured);
};
```

Finally, all that remains is testing it out. In this setup, there are 4
customers and each tries to book 6 seats. Since there are only 20 seats, at
least one of them should miss out on having all 6 bookings go through. Moreover,
in the _charge_ table, there should only be 20 entries.

```javascript
const main = async () => {
  //generate 24 bookings
  const seatsPerCustomer = 6;
  const customers = await db.getCustomerNames().then((names) =>
    _(names)
      .flatMap((name) => _.times(seatsPerCustomer, _.constant(name)))
      .shuffle()
      .value()
  );

  //carry out all 24 bookings
  const seats = await Promise.all(customers.map(getSeat).map(makeTransaction));

  //get assignments of seat to customer
  const assignments = _.sortBy(_.zip(seats, customers), [0, 1]);
  assignments.forEach(logSeatAssignment);

  //compare total charges made to expected
  const total = await db.getTotalCharges();
  const expected = await db.getExpectedTotal();
  const color = total > expected ? chalk.red : chalk.green;
  console.log(color(`Total: ${total}\tExpected: ${expected}`));

  //reset
  await db.resetValues();
};
```

Full code, plus details on how to set it up is in this
[repository](https://github.com/nagamocha3000/airline_transactions_sqlzoo)