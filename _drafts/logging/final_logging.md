# Logging in Go

## Abstract

Best practices, Leveled Logging, structured logging, correlating logs with
traces, audit logs

## Intro

This post is about logging. It contains some advice here and there, and as with
most aspects of software engineering, it should be tempered with context. In
other words: 'it depends' - always factor in the problem at hand rather than
adhering blindly to 'best practices' that someone wrote on the internet. Now for
some best practices so you don't have to read the rest of the post:

## Best Practices

- Logging should be low-overhead. Use performant logging libraries if the
  default loggers are slow/resource intensive.
- Use leveled logging since not every event has the same severity
- Put in place a retention policy: logs don't have to be kept for eternity:
  storage costs money and the older the logs the less useful they are for
  understanding the system's current behaviour
- Log only actionable information
- Consider the audience of the logs.
- Be austere in the number of logging levels used: there's no point in having a
  'Critical', 'Emergency', 'Alert' and 'Error' level logs if the application can
  make do with a single 'Error' level.
- Do not log an error then return the error value back to the caller. It might
  be logged again and again resulting in the same information being repeated
  several times in the log stream. Errors should be handled only once and
  logging an error does count as handling it. Therefore, if it's not the
  responsibility of a function to handle an error it follows that it's not its
  responsibility to log that error. At best what such a function can do is add
  more context or annotate the error before returning it.
- Audit and transactional logs should be handled separately from operational
  logs. Do not log audit/transactional details as info-level logs
- Use structured logging instead of shoving/concatenating a bunch of attributes
  into a string. It's faster to query.
- Make logs descriptive, but also keep them straight to the point
- Log after an event has happened, not before. In some cases though, this is not
  feasible, for example, you have to log before your application binds to and
  listens on a port because after that it enters into an event loop.
- Log in present tense ('Cannot open file X') or present continuous tense
  ('Listening on port 6000'). The fact that an event occured is implied by the
  previous point: 'log after an event').
- Avoid `log.Fatal`. It calls `os.Exit(1)` after logging the error hence `defer`
  statements don't get run. If you must exit the program, prefer `panic` or
  bubble up the error back to `main` [2].
- In production, use the UTC timezone for timestamps. In development, you can
  get away with using your local timezones.
- Avoid logging sensitive values that compromise security. If you have to log
  them, do anonymize them and also do ensure that downstream log aggregators are
  secure and compliant.
- Log routing and destination should not be configured within the application -
  instead log to `stdout` and in the production environment, the log stream can
  be redirected as needed (as per the 12 factor Application best practices)
- Additionally, log rotation and log compression should not be handled within
  the application, a separate process/utility should handle it.
- For libraries, if you must log some information, log against an interface then
  let the caller inject their logger for cases where the logger you're using
  internaly does not suffice/is not needed

## Formal Introduction

Logging is outputting a record to signal the occurence of an event. That event
can be as simple as 'hey this program has started, here's a "Hello World"
message'. In Go, you've got `fmt.Println` and its cousins. You've also got the
`log` package in the standard library. Plus a whole slew of third-party logging
libraries.

When logging, we've got a couple of factors to consider:

- what exactly to log and its severity, plus who's the intended audience
- which library to use
- any additional context that need to be correlated/paired with the logs
- downstream analytics that we might need to carry out on the logs
- the application's logging rates/volumes
- routing, destination, retention policy, security etc
- and more

Let's go over these factors:

## Leveled Logging

Log levels indicate the severity of a log entry. They originated as part of Eric
Allman's Sendmail project, particularly
[syslog](https://en.wikipedia.org/wiki/Syslog). Syslog had the following levels:
Emergency, Alert, Critical, Error, Warning, Notice, Informational and Debug,
ordered from lowest to highest, most severe to least severe. Some other
applications also add a Trace level right after Debug and others use Fatal in
place of Emergency. The levels form a hierarchy such that by setting the
output's level to Warning, you'd get all warn-level logs and lower, up to the
emergency level, and higher level logs would be filtered out. The level a log
should have tends to be application dependent: what counts as critical for one
application might be a warning in a different application. A good practice
though is to limit the number of levels used and give each level an unambiguous
connontation. From previous experience and based on various references, the
following levels should suffice for most Golang applications: Fatal, Error,
Warn, Info and Debug. Let's dig a bit deeper into these levels:

1. **Fatal**:
   - For logging errors/anomalies right when the application has entered a state
     in which a crucial business functionality is not working [2].
   - With such errors, the application/service must be shutdown and
     operators/administrators notified immediately. The fix might not be
     straightforward.
   - They should be accompanied by a stack-trace to simplify debugging.
   - `FATAL` errors are the unforseen and infrequent ones - when this level
     occurs too frequently it means it's being overused/misused [3].
2. **Error**:
   - For logging errors which are fatal but 'scoped' within a procedure [3].
     Such errors require administrator/operator/developer intervention and the
     fix is relatively simple. For example, the wrong address was provided, or a
     server is not permitted to bind to a given port.
   - Given that errors are 'values' in Go that can be returned from a function,
     one
     [anti-pattern highlighted by Dave Cheney](https://dave.cheney.net/2015/11/05/lets-talk-about-logging)
     I'm guilty of in the past is logging an error then returning it to the
     caller. Then the parent caller logs it, then the grandparent caller logs it
     and so on such that the same error ends up being output multiple times. The
     logs become noisy and noisy logs tend to be less useful.
   - The best course of action is simply to return the error and if necessary,
     add more context. For example, if I was unable to open a file, annotate the
     error with the file's path then return it
3. **Warn**:
   - For logging expected anomalies which an application can recover from
     retrying, switching to a different node or to a backup and so on [3].
   - Such anomalies are transient/temporary. For example, a HTTP request might
     fail but you expect that after a retry or two it should go through.
   - Other anomalies have a pre-defined handling strategy: for example, if the
     primary database fails, the application is configured to switch to the
     backup (but we still want to record somewhere that the application could
     not access the primary)
   - This then brings up an
     [interesting discussion, once more brought up by Dave Cheney](https://dave.cheney.net/2015/11/05/lets-talk-about-logging):
     if the application can eventually proceed normally, what's even the point
     of logging warnings: either log them as ERROR or as INFO.
   - Later on, we'll have a brief section on logging as it pertains to telemetry
     and observability, for now, it's worth pointing out that when using the
     [RED Method](https://www.youtube.com/watch?v=zk77VS98Em8) majority of
     warn-level logs are better output as metrics so that operators can monitor
     the error-rates
4. **Info**:
   - For logging normal application behaviour to indicate that an expected
     happy-path event happened.
   - There is a special class of logs termed 'Audit logs'. These should not be
     logged as info-level logs and should have there own separate pathways and
     destination. In the next section I give a quick overview of audit logs.
   - As an aside, for applications where configuration comes from multiple
     sources (defaults, config files, command-line flags, environment variables
     and so on) and other deploy-specific values such as the binary's
     version/commit-hash etc, a pattern that works for me is to log all these
     values on start-up at `INFO` level rather than `DEBUG` level.
     Alternatively, one can write out this information to a file or provide an
     API for accessing it. A huge class of operation errors stem from
     misconfiguration and this simplifies debugging/inspecting for operators.
   - It goes without saying, but it should be mentioned nonetheless,
     confidential information, secrets and keys should not be logged at all.
5. **Debug**:
   - For diagnostic information that should be helpful to developers
   - Due to their verbosity, Debug logs should only be emitted during
     development and disabled in production, or, should not be present at all
     (you can always use a debugger or good old-fashioned print statements to
     trace steps in development)

## Audit Logs & Transactional Logs

There are a special kind of logs that are categorized as Audit or Transactional
logs.

Phil Wilkins in the book 'Logging in Action' defines an audit event as 'a record
of an action, event, or data state that needs to be retained to provide a formal
record that may be required at some future point to help resolve an issue of
compliance (such as accounting processes or security).

Of key is the audience of such logs: they are not meant for
developers/operators, unlike operational logs. Instead, they are meant for the
"business" be it analysts or auditors

Therefore, it's best to have separate pathways and destinations for such logs
rather than shoe-horn them into operational logs. These logs may have separate
confidentiality requirements, they may need to be retained much longer, maybe
even for years and might even have to be deleted when requested by respective
users as per privacy laws.

Usually, the business domain will dictate the audit/tx logs that need to be
recorded.

## Structured Logging

The default approach to logging is 'stringy' logging i.e. formatting
attributes/parameters into the log messages to be output.

It works when a 'human' is directly going through the logs and all they need to
query the logs is grep and other unix-based CLI tools. It's also suitable for
CLI applications. However, if the logs have to be pre-processed before analyzing
them using beefier tools, then structured logging should be used. In [this](TODO
add link) Go discussion, github user jba describes structured logging in the
following way:

> Structured logging is the ability to output logs with machine-readable
> structure, typically key-value pairs, in addition to a human-readable message.

The format used for structured logs is usually JSON - its still human readable
but is also machine-parse-able.

Protobuf can be used but it involves too much setup overhead, with having to
define messages upfront and usually, most logging aggregators are not protobuf
friendly.

There are a couple of low-overhead/high-speed JSON parsing libraries such as
[yyjson](https://github.com/ibireme/yyjson) (used by DuckDB) and
[simdjson](https://github.com/simdjson/simdjson) (used by Clickhouse) so the
overhead of parsing/querying JSON relative to binary formats should not be much
of a concern. However, both JSON and stringy logs tend to take up a lot of space
hence the need for lightweight, query-friendly compression schemes. Structured
logs can also be wrangled into traditional database columns as a quick
pre-processing step or they can be queried directly. I've written a separate
post on how you can use [DuckDB to derive structure from and query JSON](TODO
add link).

For Go-based apps, there are a couple of structured logging libraries:

- [Logrus](https://github.com/sirupsen/logrus). Being the oldest entry here,
  it's credited for introducing structured loggging to Go. Relatively slow due
  to its API which necessitates the use of expensive methods and lots of
  allocations for serialization.
- [Zap](https://github.com/uber-go/zap): High performance logging library from
  Uber. Highly configurable, suitable for large-scale projects
- [Zerolog](https://github.com/sirupsen/logrus): An alternative to Zap that's
  slightly faster while making fewer allocations. It's also simpler to use with
  a more minimal API and few knobs to configure.
- [slog](golang.org/x/exp/slog): New kid on the block. Developed by the
  Go-team - represents their attempt to standardize the interface for structured
  logging in Go while providing a default alternative to the std library's `log`
  which is stringy.

For now, my preference is zerolog due to its minimal API (the speed/memory
efficiency is a plus).

## Strategies for dealing with high logging rates/volumes

- Sampling
- Circular Buffer logging
- Log Rotation
- Toggling
- Handling it downstream
- Using low overhead logging libraries
- Log compression
