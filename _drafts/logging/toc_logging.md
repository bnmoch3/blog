# Final logging

## Structure

- Quick Intro

- Best Practices / Overview / Recommendations
  - Some advice for CLI

- Leveled Logging

- Structured Logging

- Logs and Traces
  - Adding traceIDs and spanIDs to logs
  - errors

- Log Correlation
  - Where the log is being emitted from
  - Tracing ID and Span ID
  - Correlation ID
  - Postgres Logs and code
  - You want to know where the log is being emitted from and additional context
    such as ther events that happened just before and just after
  - When: timestamp

- Ring buffer logging

- Strategies for dealing with high logging rates/volumes
  - Sampling
  - Circular Buffer logging
  - Log Rotation
  - Toggling
  - Handling it downstream
  - Using low overhead logging libraries
  - Log compression

## References

Levels:

1. 'Lies My Parents Told Me (About Logs)' - Charity Majors:
   [link](https://www.honeycomb.io/blog/lies-my-parents-told-me-about-logs)
2. 10+ Logging and Monitoring Best Practices - Sematext:
   [link](https://sematext.com/blog/best-practices-for-efficient-log-management-and-monitoring/#5-use-the-proper-log-level)
3. Let's talk about logging - Dave Cheney:
   [link](https://dave.cheney.net/2015/11/05/lets-talk-about-logging)
4. My Logging Best Practices - Thomas Uhrig:
   [link](https://tuhrig.de/my-logging-best-practices/)

Logging Levels:

1. Understanding Loging Levels - What They Are & How To Use Them - Rafal KuĆ:
   [link](https://sematext.com/blog/logging-levels/)
2. When to use the different log levels - stackoverflow:
   [link](https://stackoverflow.com/questions/2031163/when-to-use-the-different-log-levels)
3. The 5 Levels of Logging:
   [link](https://web.archive.org/web/20180914181534/https://www.aib42.net/article/five-levels-of-logging)

More references:

1. Proposal: standard Logger interface - Peter Bourgon, Chris Hines:
   [link](https://docs.google.com/document/d/1shW9DZJXOeGbG9Mr9Us9MiaPqmlcVatD_D8lrOXRNMU/edit#)
2. 'Metrics, tracing and logging' - Peter Bourgon:
   [link](https://peter.bourgon.org/blog/2017/02/21/metrics-tracing-and-logging.html)
3. 'Logging v. instrumentation' - Peter Bourgon:
   [link](https://peter.bourgon.org/blog/2016/02/07/logging-v-instrumentation.html)
4. 'Basics of the Unix Philosophy' - 'The Art of Unix Programming' - Eric S.
   Raymond: [link](http://www.catb.org/~esr/writings/taoup/html/ch01s06.html)
5. 'Treat logs as event streams' - 12-Factor App:
   [link](https://12factor.net/logs)
6. 'Logs vs Structured Events' - Charity Majors:
   [link](https://charity.wtf/2019/02/05/logs-vs-structured-events/)
7. 'Logs and Metrics' - Cindy Sridharan:
   [link](https://copyconstruct.medium.com/logs-and-metrics-6d34d3026e38)
