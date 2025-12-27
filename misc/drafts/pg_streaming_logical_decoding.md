+++
title = "PostgreSQL: Handling Streaming in Logical Replication (V2)"
date = "2025-12-25"
summary = "Managing large in-flight transactions and the streaming state machine in Postgres 14+"
tags = ["PostgreSQL", "Go"]
type = "post"
toc = true
readTime = true
autonumber = false
showTags = true
slug = "postgres-logical-replication-streaming-v2"
+++

# PostgreSQL: Handling Streaming of Large Transactions in Logical Decoding

Postgres logical replication typically sends a tx only after it has committed.
However, for large transactions that exceed `logical_decoding_work_mem`,
Postgres uses a streaming protocol (v2) to send data in "chunks" while the
transaction is still in-flight. This post is a quick guide on, as the title
states, handling streaming of large transactions.

I’m writing this guide because the existing ecosystem for Golang-based logical
replication is either stuck in V1 (e.g.
[PeerDB](https://github.com/PeerDB-io/peerdb)) or relies on wal2json output
plugin ([pg_stream](https://github.com/xataio/pgstream)).

Also, when I turned to LLMs (Claude Sonnet/Opus, Gemini Pro) for help with the
V2 streaming protocol, they consistently hallucinated the message flow getting
crucial things wrong. For example Claude presumed that each `StreamCommit` or
`StreamAbort` is always followed by a `StreamStop`, Gemini presumed that only
one `StreamAbort` is sent. As such, they code they generated were wrong and had
I used it blindly, it would have led to fatal errors such as data inconsistency.
Needless to say, both tools were still quite useful and sped up my
"mini-research".

As for the Postgres documentation wrt to streaming, it's rather sparse given
written by old-school engineers for old-school engineers who are expected to
read the C source code if they really want to figure out deeper details such as
protocol flow.

Ok, off to the races. Handling streamed large transactions requires a stateful
consumer that can stage uncommitted data and handle the specific "abort" and
"stop" mechanics of the v2 protocol.

## Enabling Streaming

To receive streamed chunks, the replication slot must be started with the
streaming option set to true:

```Go
options := pglogrepl.StartReplicationOptions{
    PluginArgs: []string{
        "proto_version '2'",
        "streaming 'true'",
        "publication_names 'my_pub'",
    },
}
```

## The Streaming State Machine

Unlike standard transactions, streamed transactions are interleaved and wrapped
in `StreamStart` and `StreamStop` messages. A single large transaction will be
broken into multiple segments. Internally, we can define the processor for
consuming and managing logical decoding messages as follows:

```Go
// ReplicationProcessor handles the state and decoding of the replication stream.
type ReplicationProcessor struct {
    relations map[uint32]*pglogrepl.RelationMessageV2
    typeMap   *pgtype.Map

    // Standard transactions: never interleaved, single active transaction
    // per given moment
    activeStdXid    uint32
    activeStdBuffer []DMLOperation

    // Streaming transactions: can be interleaved, track each separately
    inStream        bool   // parser mode flag
    streamSegments  map[uint32]*streamSegment
    activeStreamXid uint32
}

type streamSegment struct {
    buffer         []Operation
    sequenceNumber uint32
}o
```

### Stream Start

The `StreamStartMessageV2` includes a `FirstSegment` flag. A value of 1
indicates the beginning of the transaction, while 0 indicates a subsequent chunk
of the same Xid.

```Go
case *pglogrepl.StreamStartMessageV2:
    if p.inStream {
        return nil, &FatalError{Err: fmt.Errorf(
            "received StreamStart for %d while already in stream %d",
            msg.Xid, p.activeStreamXid)}
    }
    p.inStream = true  // Switch parser mode
    p.activeStreamXid = msg.Xid

    seg, exists := p.streamSegments[msg.Xid]

    if msg.FirstSegment == 1 {
        // First segment: create new tracking entry
        if exists {
            return nil, &FatalError{Err: fmt.Errorf(
                "received FirstSegment=1 for Xid %d, but state already exists", msg.Xid)}
        }
        p.streamSegments[msg.Xid] = &streamSegment{
            buffer:         []DMLOperation{},
            sequenceNumber: 0,
        }
    } else {
        // Subsequent segment: must have existing state
        if !exists {
            return nil, &FatalError{Err: fmt.Errorf(
                "received subsequent segment for Xid %d but no state found", msg.Xid)}
        }
        seg.sequenceNumber++  // Increment for ordering
    }
```

### Stream Stop

A `StreamStop` message indicates the end of a network chunk, not the end of the
transaction. The buffer for the Xid should be cleared of data to save memory,
but the key must remain in the tracking map to handle the eventual commit or
abort.

```Go
case *pglogrepl.StreamStopMessageV2:
    if !p.inStream {
        return nil, &FatalError{Err: errors.New(
            "received StreamStop while not in stream mode")}
    }

    xid := p.activeStreamXid
    seg, exists := p.streamSegments[xid]
    if !exists {
        return nil, &FatalError{Err: fmt.Errorf(
            "received StreamStop for Xid %d but no state exists", xid)}
    }

    // Emit this chunk immediately
    res := &ProcessResult{
        Messages:       seg.buffer,
        Xid:            xid,
        IsStream:       true,
        SequenceNumber: seg.sequenceNumber,
    }

    seg.buffer = []DMLOperation{}  // Clear buffer, keep tracking entry
    p.inStream = false       // Exit parser mode
    p.activeStreamXid = 0

    return res, nil
```

### Avoiding OOM: Spilling to Disk

Streaming exists because transactions can be gigabytes in size. Keeping
`[]DMLOperation` or raw `[]byte` in memory from a transaction that Postgres
spilled to disk is a recipe for a production crash.

One possible strategy:

1. **Hot Path**: If a transaction is small, keep it in an in-memory buffer.
2. **Spill Path**: Once a buffer exceeds a threshold (e.g 10MB), spill the
   contents to a local KV store (like BoltDB) or a temp file.

### Stream Commit

The `StreamCommitMessageV2` is the final signal for a streamed transaction.
Unlike a standard `CommitMessage` it does not contain the data itself, it simply
tells you that the transaction identified by the `Xid` is now "official".

```Go
    case *pglogrepl.StreamCommitMessageV2:
        if _, exists := p.streamSegments[msg.Xid]; !exists {
            return nil, &FatalError{Err: fmt.Errorf(
                "received StreamCommit for unknown Xid %d", msg.Xid)}
        }
        return p.flushStream(msg.Xid, true, false)

// flushStream finalizes a streaming transaction
func (p *ReplicationProcessor) flushStream(xid uint32, isCommitted, isAborted bool) (*ProcessResult, error) {
    seg := p.streamSegments[xid]

    delete(p.streamSegments, xid)  // Cleanup state
    p.activeStreamXid = 0

    return &ProcessResult{
        Messages:       seg.buffer,
        Xid:            xid,
        IsStream:       true,
        SequenceNumber: seg.sequenceNumber,
        IsCommitted:    isCommitted,
        IsAborted:      isAborted,
    }, nil
}
```

In the V2 protocol, chunks are delivered sequentially, but because you are
likely persisting these chunks to a staging area (BoltDB, SQLite, local files,
S3) to avoid OOM, you must generate and track **sequence numbers** per Xid. The
protocol only provides a flag indicating if a chunk is the first or subsequent,
it does not provide an incrementing index. Note, since it's demo code, in my
code samples I keep the stream segments in memory.

When the `StreamCommit` finally arrives, your reassembly logic must sort by your
generated sequence number. If you are using a key-value store for staging, a key
format like `xid:sequence_number` (eg 5001:0001) ensures that your "Apply" phase
doesn't accidentally reorder the DML operations which would violate referential
integrity.

**Crucial Note on LSN Progress**: While you can advance the Write and Flush LSNs
as soon as a segment is safely persisted to your staging area (allowing Postgres
to recycle its WAL) you must never advance the Apply LSN until the StreamCommit
has been fully processed and the data is visible in your final destination. If
you are staging the segments in-memory ("Hot Path") then you can only advance
the Write LSN, in such a case, if you advance the Flush LSN and your application
crashes before persisting the in-memory stream segments then you'll probably
lose data - the destination will be in an inconsistent state.

### Stream Abort

When a large transaction is cancelled/rolled back, Postgres may send multiple
`StreamAbort` messages. Your handler for `StreamAbort` must be idempotent to
avoid processing the same rollback multiple times:

```Go
case *pglogrepl.StreamAbortMessageV2:
    // Postgres may send multiple StreamAbort messages for one transaction.
    // Only the first one has state to clean up.
    if _, exists := p.streamSegments[msg.Xid]; !exists {
        return nil, nil  // Redundant abort, already cleaned up
    }
    return p.flushStream(msg.Xid, false, true)
```

## LSN Tracking and Acknowledgement

Postgres tracks replication progress via three LSN positions: `write`, `flush`,
and `apply`. Streaming changes the timing of these updates.

- **Write LSN**: Advanced on every message (including chunks).
- **Flush LSN**: Advanced once the data is safely staged (memory or disk).
- **Apply LSN**: Only advanced when StreamCommit is received and the data is
  applied to the destination.

If the consumer advances the `Apply LSN` for intermediate chunks, a crash will
result in data loss, as Postgres will assume the transaction was finalized.

## Summary of Nuances

```
sequenceDiagram
    participant PG as Postgres (Primary)
    participant GO as Go Replication Client
    participant ST as Staging (BoltDB)

    Note over PG, ST: Transaction 5001 begins to "Spill"

    rect rgb(240, 240, 240)
        Note right of PG: Segment 1
        PG->>GO: StreamStart (Xid: 5001, First: 1)
        GO->>GO: Init Local Buffer & Seq=0
        PG->>GO: DML Messages (Insert/Update)
        PG->>GO: StreamStop
        GO->>ST: Write Chunk (Key 5001:0)
        GO->>GO: Clear Buffer
    end

    Note over PG, ST: ... Time passes / Other Xids interleaved ...

    rect rgb(240, 240, 240)
        Note right of PG: Segment 2
        PG->>GO: StreamStart (Xid: 5001, First: 0)
        GO->>GO: Increment Seq=1
        PG->>GO: DML Messages
        PG->>GO: StreamStop
        GO->>ST: Write Chunk (Key 5001:1)
        GO->>GO: Clear Buffer
    end

    Note over PG, ST: Final Resolution

    alt Success Case
        PG->>GO: StreamCommit (Xid: 5001)
        GO->>ST: Fetch all keys prefixed "5001:*"
        ST-->>GO: Returns Chunks 0 and 1
        GO->>GO: Apply to Final Destination
        GO->>GO: Update Apply_LSN
        GO->>ST: Delete Staged Keys for 5001
    else Abort Case
        PG->>GO: StreamAbort (Xid: 5001)
        GO->>ST: Delete Staged Keys for 5001
        GO->>GO: Remove 5001 from Active Map
    end
```

- **Interleaving**: Multiple transactions can stream simultaneously. The
  consumer must use a map of buffers keyed by `Xid`.
- **Memory Management**: Avoid flattening all chunks into a single slice at
  commit time for large transactions to prevent OOM errors. Apply them segment
  by segment.
- **Protocol Redundancy**: `StreamStop` is the inter-chunk reset, while
  `StreamCommit`/`StreamAbort` are the "end-of-life" for that transaction's
  state.
- When parsing messages from a stream, remember to pass `true` as the `inStream`
  argument: `logicalMsg, err := pglogrepl.ParseV2(walData, true)`
