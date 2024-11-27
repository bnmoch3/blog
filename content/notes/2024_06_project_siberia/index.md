+++
title = "Offline (but Faster and more Accurate) Classification of Hot and Cold Data "
date = "2024-06-06"
summary = "Hint, it's based on exponential smoothing"
tags = ["Database Internals"]
type = "note"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "project-siberia-hot-cold-id"
+++

Hekaton is Microsoft's SQL Server's take on in-memory databases systems. With
Hekaton, tables can be declared as memory-resident. These tables are implemented
and indexed using memory-optimized lock-free data-structures. They can also be
queried and updated the same way as 'regular' tables in SQL Server [1].

Project Siberia, launched by the same team, then builds up on Hekaton by
allowing for cold-records within a memory-optimized table to be moved to a _cold
store_ while hot records are kept in memory:

> We are investigating techniques to automatically migrate cold rows to a "cold
> store" residing on external storage while the hot rows remain in the in-memory
> "hot store". The separation into two stores is only visible to the storage
> engine; the upper layers of the engine (and applications) are entirely unaware
> of where a row is stored. The goal of our project, called Project Siberia, is
> to enable the Hekaton engine to automatically and transparently maintain cold
> data on cheaper secondary storage.

The same idea of physically separating a logical data structure into a
'hot-store' (memory-optimized) vs a 'cold-store' (disk/SSD optimized) and
migrating records back and forth is explored in a recent paper 'Two is Better
Than One: The Case for 2-Tree for Skewed Data Sets' by Xinjing Zhou et al. We'll
cover this paper in a future post. What I would suggest is that after getting
familiarized the 2-Tree approach, it's worth revisiting the Project Siberia
papers for two reasons:

1. The 2-Tree paper does not address concurrency-control and transactional
   migrations leaving it up for future work. Luckily, Project Siberia details
   how accesses (reads, writes, updates, deletes) and live migrations (hot to
   cold, cold to hot) can be carried out transactionally across both stores in a
   unified manner all while allowing for concurrent transactions (queries).
   Though tailor-made for Hekaton's internals, Project Siberia's approach is
   worth checking out.
2. Project Siberia also proposes and evaluates the use of access filters (bloom
   filters and range filters) to avoid unnecessary 'trips' to the cold-store.
   Might be a decent low-effort high-reward addition to 2-Tree

For today, I'd like to focus on one specific component of Project Siberia - the
method they use to classify hot data from cold which is described in the paper
[Identifying Hot and Cold Data in Main-Memory Databases](https://www.microsoft.com/en-us/research/wp-content/uploads/2013/04/ColdDataClassification-icde2013-cr.pdf)
authored by Justin Levandoski, Per-Åke Larson and Radu Stoica.

The main problem the paper addresses is the overhead of online cache maintenance
both CPU-wise and memory-wise. In the
[Anti-Caching overview post](/blog/anti-caching), we saw this overhead addressed
by using only a sample of the accesses to update the LRU chain. In future posts,
we'll see other approaches that lower/coarsen the granularity from record level
accesses to page level accesses and even use hardware support so as to minimize
the cache maintenance overhead.

Back to Levandoski et al's paper: what makes their approach unique is that it's
based on offline analysis rather than online caching (LRU, LFU, Second-chance
etc):

1. The system logs record accesses asynchronously off the critical path. A log
   entry consists of record ID plus time it was accessed. The logs can be
   sampled to reduce overhead.
2. A classification algorithm based on exponential smoothing is used to estimate
   the _future_ frequency of access for each record based on the logs. The top K
   records with the highest estimated access frequency form the hot set while
   the rest will be part of the cold set.
3. This result is relayed back to the DBMS which migrates cold records to the
   cold store (disk/SSD) while keeping the hot records in memory
4. This is carried out periodically (e.g. every hour or so) depending on how
   frequent the hot set changes.

The authors provide the following advantages of offline analysis:

1. Minimal runtime overhead compared to online counterparts
2. Requires minimal modification within the database internals. Only key change
   to make is adding the code for logging. Record migration can be carried out
   using transactions.
3. Flexibility: offline analysis can be carried out within the same process, in
   a different process or even in a different node altogether. The core
   estimation algorithm can be sped up via parallelization.
4. Sampling & accuracy: in most cases (if not all), with only 10% of the logs,
   the estimation algorithm reduces its accuracy by 2.5%. So you can drop 90% of
   the logs

As already mentioned, the algorithm they deploy is based on _exponential
smoothing_. This is a technique used in time-series analysis for short-term
forecasting whereby newer observations are given more weight than earlier
observations. The algorithm itself is quite simple:

```python
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class Entry:
    prev_timestamp: int = 0
    estimate: float = 0.0

def forward_classification(logs, k, alpha=0.05):
    estimates = defaultdict(lambda: Entry())
    for timestamp, record_id in logs:
        entry = estimates[record_id]

        # estimate at the time slice when the record was last observed
        prev_estimate = entry.estimate
        prev_timestamp = entry.prev_timestamp

        # update new estimate
        entry.estimate = alpha + prev_estimate * (
            (1 - alpha) ** (timestamp - prev_timestamp)
        )

        # update entry's last observed timestamp
        entry.prev_timestamp = timestamp

    record_ids = list(estimates.keys())
    record_ids.sort(key=lambda r: estimates[r].estimate, reverse=True)
    return record_ids[:k], record_ids[k:]

# usage
hot_set, cold_set = forward_classification(logs, k)
```

The `alpha` parameter is the "decay factor that determines the weight given to
new observations and how quickly to decay old estimates. α is typically set in
the range 0.01 to 0.05 – higher values give more weight to newer observations"
[2]. The timestamps need to be normalized such that the 'begin' timestamp for
the period when a new batch of logging is set to 0. The authors then introduce a
_backward_ variant of the above algorithm (starts from the newest log back to
the oldest) which ends up being faster and having a lower space overhead.
Furthermore, they show how both variants can be parallelized all while providing
better accuracy than online caching.

Part of why I covered this paper is that the same offline analysis procedure is
utilized in a different paper, "Enabling Efficient OS paging for main-memory
OLTP databases" by Radu Stoica et al, whereby we've got VoltDB (the same system
used by the Anti-caching folks) but with a whole different hot/cold approach for
larger-than-memory workloads. Here's
[the post where I go over Radu Stoica and co's approach](/blog/efficient-os-paging-hot-cold-db)

## References

1. [Trekking Through Siberia: Managing Cold Data in a
   Memory-Optimized Database - Ahmed Eldawy, Justin Levandoski, Per-Åke Larson](https://www.microsoft.com/en-us/research/publication/trekking-through-siberia-managing-cold-data-in-a-memory-optimized-database/)
2. [Identifying Hot and Cold Data in Main-Memory Databases - Justin J. Levandoski, Per-Åke Larson, Radu Stoica](https://www.microsoft.com/en-us/research/wp-content/uploads/2013/04/ColdDataClassification-icde2013-cr.pdf)