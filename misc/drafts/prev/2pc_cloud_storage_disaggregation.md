## Takeaways

- Key question: what is the minimal requirement from the storage layer to enable
  2PC optimizations addressing high latency and blocking.
- Answer: ability to provide log-once functionality, which ensures for each
  transaction, only one update of its state in the log is allowed.

## Properties of an atomic commit protocol

## Conventional 2PC

- long latency due to eager log writes on critical path
- 2PC requires two round-trip network messages and associated logging
  operations.
- blocking of progress when coordinator fails
- blocking occurs if a coordinator crashes before notifying participants of the
  final decision.

## Cornus

- only extra requirement cornus requires is an atomic compare-and-swap at the
  storage layer.
- eliminate decision logging by the coordinaor.
- LogOnce() API. Only the first log append for a transaction can update this
  transaction's state.
- collective votes in all participants logs: a transaction commits if and only
  if all participants have logged VOTE-YES.
