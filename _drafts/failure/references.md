References:

- ACoyler The Network is Reliable:
  https://blog.acolyer.org/2014/12/18/the-network-is-reliable/
- The Network is Reliable - Paper:
  https://dl.acm.org/doi/10.1145/2639988.2655736
- The Network is Reliable - Paper:
  https://dl.acm.org/doi/pdf/10.1145/2639988.2655736
- Understanding Network Failures in Data Centers:
  https://conferences.sigcomm.org/sigcomm/2011/papers/sigcomm/p350.pdf
- Why Do Computers Stop and What Can Be Done About it:
  https://www.hpl.hp.com/techreports/tandem/TR-85.7.pdf
- Error Handling in a Correctness-Critical Rust Project:
  https://sled.rs/errors.html
- Files are hard: https://danluu.com/file-consistency/
- Notes on Concurrency bugs: https://danluu.com/concurrency-bugs/
- Debugging stories: https://github.com/danluu/debugging-stories
- File-system error handling: https://danluu.com/filesystem-errors/
- A decade of major cache incidents: https://danluu.com/cache-incidents/
- Feral Concurrency: http://www.bailis.org/papers/feral-sigmod2015.pdf
- Handling Failures from First Principles:
  https://dominik-tornow.medium.com/handling-failures-from-first-principles-1ed976b1b869
- Paper Summary: Fundamentals of Fault-Tolerant Distributed Computing:
  https://dominik-tornow.medium.com/paper-summary-fundamentals-of-fault-tolerant-distributed-computing-53969eaa38f3
- All File Systems are not created equal:
  https://blog.acolyer.org/2016/02/11/fs-not-equal/
- Redundancy does not imply fault tolerance: analysis of distributed storage
  reactions to single errors and corruptions:
  https://blog.acolyer.org/2017/03/08/redundancy-does-not-imply-fault-tolerance-analysis-of-distributed-storage-reactions-to-single-errors-and-corruptions/
- Uncovering bugs in Distributed Storage Systems during Testing (not in
  production!):
  https://blog.acolyer.org/2016/05/05/uncovering-bugs-in-distributed-storage-systems-during-testing-not-in-production/

## More references

- Failure trends in a large disk drive population
  https://static.googleusercontent.com/media/research.google.com/en//archive/disk_failures.pdf
- Gray failures:
  - Murat:
    http://muratbuffalo.blogspot.com/2019/09/gray-failure-achilles-heel-of-cloud.html
  - Paper trail: https://www.the-paper-trail.org/post/2020-04-19-gray-failures/
  - ACoyler:
    https://blog.acolyer.org/2017/06/15/gray-failure-the-achilles-heel-of-cloud-scale-systems/
- Detecting silent errors in the wild:
  https://engineering.fb.com/2022/03/17/production-engineering/silent-errors/
- Why silent errors are hard to find:
  https://semiengineering.com/why-silent-data-errors-are-so-hard-to-find/
- Asatarin - testing distributed systems:
  https://asatarin.github.io/testing-distributed-systems/

## Handling Failure From First Principles

- business process: a business process execution shall preferably run
  successfully to completion - even in the presence of failure.
- a business process is a sequence of steps called actions
- In order to maintain consistency, after a business process is executed, the
  system must be in a state equivalent to the business process having executed
  either once or not at all.
- In the presence of failure, the system has to take mitigating steps in order
  to ensure the transition into a state equivalent to the business process
  either executing once or not at all.
- Failure handling: failure detection and failure mitigation.
- Dimensions of failure classifications:
  - spatial dimension
  - temporal dimension
- end-to-end argument: in a layered system - failure handling should be
  implemented in the lowest layer at which failure detection and mitigation can
  be implemented correctly and completely.
- spatial dimension: classifying failures by where they occur, i.e. at which
  layer
- temporal dimension: classifying failures by when they occur and how often we
  expect them to occur:
  - transient failure: comes and goes
  - intermittent failure: comes, sticks around and goes
  - permanent failure: comes and sticks around, underlying cause of failure does
    not resolve without manual intervention.
- backward recovery: transition system from the intermediary state to a state
  that is equivalent to the initial state. Does not require repairing the
  underlying cause of the failure.
- forward failure recovery: mitigation strategies that transition the system
  from the intermediary state to a state that is equivalent to the final state,
  requires repairing the underlying cause of the failure.
- goal: maximize the probability of a business process execution completing
  successfully in the presence of failure.

# EVEN MORE References

- https://dl.acm.org/doi/pdf/10.1145/3492321.3519575
- https://www.usenix.org/conference/osdi22/presentation/lou-demystifying
- https://dl.acm.org/doi/10.1145/3477132.3483577
- https://www.usenix.org/conference/osdi22/presentation/huang-lexiang
- https://brooker.co.za/blog/2021/05/24/metastable.html
- https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf
- https://backend.orbit.dtu.dk/ws/portalfiles/portal/158016663/SAFESCI.pdf
- https://github.com/dranov/protocol-bugs-list
