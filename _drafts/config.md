# Config

## Intro

- How a system is configured: basic yet essential. Here's a quote from
- Definition: the human-computer interface for modifying system functionality
  during startup (and in some cases, during runtime) [2]
- "The task of configuring and running applications in production requires
  insight into how those systems are put together and how they work. When things
  go wrong, the on-call engineer needs to know exactly where the configurations
  are and how to change them. This responsibility can become a burden if a team
  or organization hasn’t invested in addressing configuration-related toil" [2]
- It's easy for developers to not pay attention to how their software/system is
  configured since:
  - dev vs ops culture
  - config errors are perceived as user errors rather than developer 'errors'

## Google SRE Workbook

- "Most commonly, you perform configuration in one of two scenarios: during
  initial setup when you have plenty of time, or during an emergency
  reconfiguration when you need to handle an incident. "
- "Unlike code, configuration often lives in an untested (or even untestable)
  environment."
- "A good configuration interface allows quick, confident, and testable
  configuration changes. When users don’t have a straightforward way to update
  configuration, mistakes are more likely. Users experience increased cognitive
  load and a significant learning curve."
- "System configuration changes may need to be made under significant pressure.
  During an incident, a configuration system that can be simply and safely
  adjusted is essential."
- Configuration:
  - how will we configure it (new software/system)
  - how will the configuration load
- Configuration Philosophy: "how to structure the configuration, how to achieve
  the correct level of abstraction, and how to support diverging use cases
  seamlessly"
- Configuration Mechanics: "language design, deployment strategies, and
  interactions with other systems"
- [Mine]A configuration interface fundamentally boils down to requesting input
  from users on how the system should operate[1]. There are two approaches for
  designing such an interface:
  - infrastructure-centric: Maximize ability of users to tune the system to
    their exact needs by offering as many knobs/options as possible.
  - user-centric: Minimize the 'chore' of configuring a system by offering only
    the most essential knobs and relying on defaults & self-tuning
- 'Perhaps counterintuitively, limited configuration options can lead to better
  adoption than extremely versatile software—onboarding effort is substantially
  lower because the software mostly works "out of the box"'
- Consider Neovim & Helix
- [Mine]: minimize configuration knobs as much as possible, as stated in the
  Google SRE book: the ideal configuration is no configuration at all: "the
  system automatically recognizes the correct configuration based on deployment,
  workload, or pieces of configuration that already existed when the new system
  was deployeda. Of course, for many systems, this ideal is unlikely to be
  attainable in practice". Let's consider two examples, RedPanda and Ottertune
- "Systems that begin from an infrastructure-centric view may move toward a more
  user-centric focus as the system matures, by removing some configuration knobs
  via various means (some of which are discussed in subsequent sections)"
- New systems often start from an infrastructure-centric view: it's up to the
  development and operation team to tilt as much as possible towards a
  user-centric view.
- There are a couple of strategies for doing so:
  - focus as much as possible on the end user's high-level goals - what is it
    they want to achieve
  - the interface should be close to user goals
  - developer convenience might have to take a back seat
  - there are mandatory configs and optional configs: minimize mandatory knobs
    as much as possible, provide suitable defaults. For example:
    - bind to well-known ports e.g. port 80 for web services
    - make dry-runs the default (particularly for one-off
      non-reversible/destructive jobs)
    - set default heap size to a percentage of the given memory, workers to core
      count
    - for temporary files, create at temp, use
    - for files/folders default to creating them at user's current working
      directory. If possible, make sure you have permission to create/modify
      files & directories during startup rather than at runtime
- Err towards security-focused defaults over developer friendly defaults.
- "One strategy to accommodate power users is to find the lowest common
  denominator of what regular users and power users require, and settle on that
  level of complexity as the default. The downside is that this decision impacts
  everyone; even the simplest use cases now need to be considered in low-level
  terms."
- Decision Paralysis: 'decision paralysis users might experience when presented
  with many options, the time it takes to correct the configuration after taking
  a wrong turn, the slower rate of change due to lower confidence, and more'
- Is configuration code or data: it's both [1]:
  - the system should operate on plain static data: static data (e.g. YAML,
    TOML) is easily inspectable and query-able
  - the user can interact with a higher-level interface or language that
    generates this data or they can directly create/modify the static data
  - Even if the static data is generated via a high-level interface, it's still
    worth running linters and if there's a schema, match against it (to cover
    the cases where users directly modify the static data)
  - internally: the system's configuration UI should not be tightly coupled to
    the data-structures that hold the configurations (and vice versa)
  - Configuration Lineage: "When consuming the final configuration data, you
    will find it useful to also store metadata about how the configuration was
    ingested. For example, if you know the data came from a configuration file
    in Jsonnet or you have the full path to the original before it was compiled
    into data, you can track down the configuration authors"
- Keep track of who changed a configuration and how the change impacted the
  system. Log changes to the configuration and the resulting application to the
  system. Use versioning for config
- Users should be able to make changes with confidence
- For configuration changes to be safe[1]:
  - make changes gradual rather than all-or-nothing
  - provide ability to users to roll back the changes if fatal rather than
    having them attempt patching with temporary fixes
  - provide automatic rollback or ability to stop progress if changes lead to
    loss of operator control

## Configuration Specifics - Google SRE Workbook

- Toils:
  - replication toil: having to update configs in multiple locations:
    automation, config framewworks
  - complexity toil: having to deal complex configuration automation
- Best practices/Nice to haves:
  - minimal
  - ease of learning/documented well
  - developer tooling: linters/debuggers/formatters/IDE integrations
  - Hermetic evaluation of coniguration
  - Replayability
  - Separate config code and data:
    - allow for easy analysis
    - have range of configuration interfaces
  - Do not interleave configuration evaluation with side effects: violates
    hermetic evaluation and prevent separation of config from data. Evaluate the
    config then make the resulting data available to the user to analyze [2]

## Early detection of configuration errors to reduce failure damage

- configuration parameters associated with reliability, availabilty and
  serviceability features
- "What they find is that very often configuration values are not tested as part
  of system initialization. The program runs along happily until reaching a
  point (say for example, it needs to failover) where it needs to read some
  configuration for the first time, and then it blows up – typically when you
  most need it"
- takeaway: "test all of your configuration settings as part of system
  initialization and fail-fast if there’s a problem" - Acolyer
- latent configuration errors
- What makes a parameter RAS?
- For example:
  - check if path exists
  - check if user has permission to read/write a given file or directory

## Mini Case Study:

- PostgreSQL config defaults: did not evolve as hardware improved
- Neovim vs Helix
- Prometheus: single-node
- Ottertune
- Self-tuning software: RedPanda, CockroachDB

## References

1. [Configuration Design and Best Practices - The Site Reliability Workbook - Google](https://sre.google/workbook/configuration-design/)
2. [Configuration Specifics - The Site Reliability Workbook - Google](https://sre.google/workbook/configuration-specifics/)
3. [The growth of command line options, 1979-Present - Dan Luu](https://danluu.com/cli-complexity/)
4. [Reading postmortems - Dan Luu](https://danluu.com/postmortem-lessons/)
5. [Paper Review - Early detection of configuration errors to reduce failure
   damage - Adrian Colyer](https://blog.acolyer.org/2016/11/29/early-detection-of-configuration-errors-to-reduce-failure-damage/)
6. [Early Detection of Configuration Errors to Reduce Failure Damage - Tianyin Xu et al](https://www.usenix.org/system/files/conference/osdi16/osdi16-xu.pdf)
7. [Do Not Blame Users for Misconfigurations - Tianyin Xu et al](https://cseweb.ucsd.edu//~tixu/papers/sosp13.pdf)
8. [Paper Review - Holistic Configuration Management at Facebook - Adrian Colyer](https://blog.acolyer.org/2015/10/16/holistic-configuration-management-at-facebook/)

## Other refs

- Charity Majors - Developers & Ops
- Configuration management papers:
  [link](https://github.com/tianyin/configuration-management-papers)
- There is plenty of room at the bottom:
  [link](https://muratbuffalo.blogspot.com/2021/08/there-is-plenty-of-room-at-bottom.html)
