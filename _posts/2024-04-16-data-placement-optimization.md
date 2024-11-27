---
layout: post
title:  "Optimizing Data Placement for Distributed OLAP Systems"
slug: data-placement-optimization
tag: ["Python"]
category: "Distributed Systems"
excerpt_separator: <!--start-->
type: post
---

Using MIP solvers to model and optimize shard placement

<!--start-->

In distributed OLAP database systems, tables and indices are partitioned into
shards and those shards are placed across a set of servers; queries are then
routed to the assigned shards' servers during execution - basic stuff.

Of key is that the placement of the shards affects performance. As per the paper
"[Parallelism-Optimizing Data Placement for Faster
Data-Parallel Computations](https://dl.acm.org/doi/abs/10.14778/3574245.3574260)"
authored by Nirvik Baruah and co: "to minimize the tail latency of data-parallel
queries, it is critical to place data such that the data items accessed by each
individual query are spread across as many machines as possible so that each
query can leverage the computational resources of as many machines as possible".

A naive load-balancing scheme where we assume that any shard is equally likely
to be queried doesn't quite cut it, even though it's simple to implement. We
need to take into account the actual workload at hand and the characteristics of
that workload. Hence why the authors propose and analyze a placement scheme that
achieves the optimization of query parallelism. This post will go over the
paper's placement scheme with an implementation in python plus some caveats,
adjustments and corrections of my own.

The authors do name their solution as Parallelism-Optimizing Data Placement or
PODP in short.

## Overview of PODP

PODP formulates data placement as a mathematical optimization problem where
we've got the objective of maximizing parallelism while minimizing data movement
every time the procedure is ran. All these are subject to a couple of
constraints such as 'all shards assigned to a server are within its memory
capacity' and 'load is balanced across all the servers'.

Maximizing query parallelism requires that we keep track of the most frequent
queries and the shards those queries access. It's then up to the solver to
figure out the optimal placement such that parallelism is maximized. After all,
the authors observer that given a workload: the "worst-case latency is
proportional to the maximum number of co-located shards accessed by a query, as
under high loads those shards may be accessed sequentially instead of in
parallel". Colocation here refers to shards a query accesses that are hosted
within the same server. The colocation counts per server is a query's n-cluster
values. Across all the servers, the maximum n-cluster value is referred to as
the query's _clustering_. The goal is then to minimize the clustering across the
most frequent queries - or if feasible, all the queries. This in turn maximizes
query parallelism. Since the queries a system handles change over time, this
procedure has to be ran periodically.

The procedure above will result in lots of shard movement as the solver figures
out how to re-organize the queries' shard sets. Hence the second step -
minimizing data movement while maintaining the optimal query parallelism values
we've obtained from the first step. For this, we model the transfer costs of
placing a given shard at a specific server and minimize the overall cost across
all placements.

To reiterate, the optimization problem is divided into two steps:

1. Maximize Query Parallelism
2. Minimize Data movement

Now for the implementation:

## Relevant Variables

Let's consider a setup with 6 servers and 200 shards:

```python
num_servers = 6
num_shards = 200

shards = list(range(num_shards))
servers = list(range(num_servers))
```

Each server has a max memory capacity and each shard takes up some amount of
memory. To keep things simple, every shard will have a size of 1 memory unit and
all servers will have the same amount of memory which when summed up will be
1.5x the size of the entire dataset:

```python
# memory usage of each shard
shard_memory_usages = [1 for _ in range(num_shards)]
server_max_memory = int(
    (num_shards / num_servers) * 1.5
)  # maximum server memory
```

Next, right before the data placement is ran, let's assume that shards are
placed across the servers randomly:

```python
# entry[x][y] is 1 if server x has a copy of shard y and 0 otherwise
init_locations = [[0 for _ in range(num_shards)] for _ in range(num_servers)]

# assign shards to servers randomly
init_locations = gen_init_locations( ... )
```

Now for the workload. After a given interval, let's say every 10 minutes, we
collect the statistics of the queries that have been ran. For optimizing data
placement, what we care about are the shards a query hits and the number of
times that given query was executed within the set interval, that is, its
frequency.

Queries are uniquely identified by the subset of shards they accessed rather
than by the content of the actual query. Therefore, if two or more different
queries hit the same shard subset, for all intents and purposes, they're
considered the same query and their frequencies are summed up. On the other
hand, if the same query hits different shards at different points in time (such
as in the case where a table is modified), then it's considered as different
queries. Again, all these is for the data placement optimization - other
downstream destinations for workload statistics will have their own
classifications and what-nots.

Given that some queries tend to occur more than others, I've used a generation
scheme whereby 20% of the queries are assigned a higher frequency than the rest.
One might use a more complicated workload model to reflect real-life settings
but for now this will have to do for the sake of example:

```python
query_shard_set_size = 5
queries = []
hot_queries = int(0.2 * num_shards)
for q_id in range(num_queries):
    frequency = 1
    if q_id < hot_queries:
        frequency = 50
    shard_set = set()
    for i in range(query_shard_set_size):
        shard = (q_id + i) % num_shards
        shard_set.add(shard)
    queries.append(Query(q_id, shard_set, frequency))
```

Aside from the queries in the workload, we also need to keep track of the load
per shard. For this procedure, all shards will be initialized with a load of 1.
Once we've got the query workloads, the loads of the shards per a given query
are updated accordingly:

```python
shard_loads = [1 for _ in range(num_shards)]
for query in queries:
    for shard in query.shard_set:
        shard_loads[shard] += query.frequency
```

The load per shard is key in balancing the total load across all the servers.
The average load per server before optimization is 1,833.33 units.

```python
average_load_per_server = sum(shard_loads) / num_servers
print(average_load_per_server)
# 1833.3333333333333
```

However, if we calculate the actual load per server, we get the following:

```python
def get_server_loads(num_servers, shard_to_server_map, shard_loads):
    return [
        sum(
            shard_loads[shard]
            for shard, present in enumerate(shard_to_server_map[server])
            if present == 1
        )
        for server in range(num_servers)
    ]

init_server_loads = get_server_loads(
    num_servers, init_locations, shard_loads
)
print("init server loads: ", init_server_loads)
# init server loads:  [1668, 1130, 1961, 2048, 2573, 1620]
```

The load is distributed quite unevenly - the 1st server (zero-indexing) has a
load of 1130 while the 4th one has a load of 2573.

Let's also collect the query clustering:

```python
# the set of shards in each server
def get_server_shard_sets(num_servers, shard_to_server_map):
    return [
        set(
            shard
            for shard, present in enumerate(shard_to_server_map[server])
            if present == 1
        )
        for server in range(num_servers)
    ]
init_server_shard_sets = get_server_shard_sets(num_servers, init_locations)


# for each query, get its clustering
def get_query_clustering(num_servers, server_shard_sets, queries):
    return [
        max(
            len(query.shard_set.intersection(server_shard_sets[s]))
            for s in range(num_servers)
        )
        for query in queries
    ]
init_query_clustering_vals = get_query_clustering(
    num_servers, init_server_shard_sets, queries
)


# for each query, get the weighted clustering, that is: if a query is more 
# frequent, its weighted clustering should be higher and if it's less freqeuent
# its weighted clustering should be relatively lower even if the non-weighted
# clustering is higher
def get_weighted_query_clustering_sum(queries, query_clustering_vals):
    return sum(
        (q.frequency * cs) for q, cs in zip(queries, query_clustering_vals)
    )

init_query_clustering_vals = get_query_clustering(
    num_servers, init_server_shard_sets, queries
)
```

Raw query clustering values might not be as useful since queries with low
frequency but high clustering values do not cause as much performance
degradation.

Next up, let's set up the MIP model for optimizing query parallelism:

## Part 1: Maximizing Query Parallelism

Ideally we'd take a top-K sample of the workload sorted by the frequency after
filtering out queries that only hit a single shard (such a shard isn't colocated
with any other shard when it's being queried). For simplicity though I'll just
use all the queries.

Now for the model and decision variables. Recall that the goal is to minimize
tail latency via minimizing query clustering. Let's start by defining the
decision variables that will hold the the n-cluster values for the
`sample_queries` plus the objective. The minimum n-cluster value is 1 in which
case all the shards a frequent query accesses are spread uniformly across all
the servers available:

```python
import pulp

model = pulp.LpProblem("p1", pulp.LpMinimize)

query_clustering_vars = [
    pulp.LpVariable(f"c_{query.id}", lowBound=1, cat="Integer") for query in queries
]

# minimize the n-cluster values
p1_objective = pulp.lpSum(query_clustering_vars)
model += p1_objective
```

Without any constraints, the solver will simply set all the
`query_clustering_vars` to 1 and call it a day since that will minimize the
overall sum of the n-cluster variables. But don't worry, we'll add the
constraints quite soon. For now, there are a couple of aspects that can be
improved upon in the above objective definition.

Let's start by adding an upper bound to make the solver's work easier. The
upper-bound will be the largest number of shards that a single server can host.
Since all servers have the same memory capacity and all shards take up the same
amount of memory (1 unit), the upper bound is obtained as follows:

```python
import math
ub = math.ceil(num_shards / num_servers)
print(ub)
# 20
```

Next: we've got the frequencies of the queries, we ought to weigh the clustering
variables by their respective frequencies so that the solver can focus more on
minimizing the clustering for the most frequent queries:

```python
model += pulp.lpSum(
    [
        q.frequency * n_cluster
        for (q, n_cluster) in zip(queries, query_clustering_vars)
    ]
)
```

`lpSum` works fine but with such cases, it's more common to use the dot product
which you'll come across in lots of the MIP code out there.

Overall, we end up with the following:

```python
import pulp
import math

model = pulp.LpProblem("p1", pulp.LpMinimize)

query_clustering_vars = [
    pulp.LpVariable(
        f"c_{query.id}",
        lowBound=1,
        upBound=math.ceil(num_shards / num_servers),
        cat="Integer",
    )
    for query in queries
]

# minimize sum of query clustering weighted by query frequency
objective = pulp.lpDot(
    query_clustering_vars, [query.frequency for query in queries]
)

model += objective
```

There are two addition classes of decision variables we need to define. The
first is the `assn_vars` which will determine where the shards are placed after
the solver runs. For example, given server 6 and shard 100, if
`assn_vars[6][100] == 1` then server 6 will be assigned shard 100. If server 6
already hosted shard 100 before the new assignments were carried out then
nothing happens; otherwise, it will have to either pull the shard from a node
that hosts it or have the coordinator or another node push the shard to it:

```python
assn_vars = [
    [
        pulp.LpVariable(f"a_{server}_{shard}", 0, 1, cat="Binary")
        for shard in range(num_shards)
    ]
    for server in range(num_servers)
]
```

We've also got the `p_vars`. This is the proportion or probabilities with which
the coordinator should route a query pertaining a given shard to a specific
server. Suppose we've got 5 shards. If the proportion row for server 2 is
`[0.5, 0.0, 0.0, 0.25, 0.0]`, then half the queries accessing the 0th shard
should be routed to server 2 and a quarter of the queries accessing the 3rd
shard should be routed to server 2. Server 2 should not expect to process
queries accessing the 1st, 2nd and 4th shards. On the same note, once the shards
are placed optimally, server 2 should only host the 0th and 3rd shard.

```python
p_vars = [
    [
        pulp.LpVariable(f"p_{server}_{shard}", 0, 1, cat="Continuous")
        for shard in range(num_shards)
    ]
    for server in range(num_servers)
]
```

With the decision variables in place, it's time to add the constraints.

## Constraints

The first constraint is as follows: for every query, no server should host more
shards than that query's clustering. The solver will figure out the optimal
clustering for each query so as to minimize the objective and as it's doing so,
the shard assignments should be consistent with the clustering values. When
formulating MIP, we need to make all our assumptions and constraints explicit:

```python
for query, query_clusering_var in zip(queries, query_clustering_vars):
    for server in range(num_servers):
        model += (
            pulp.lpSum(
                [assn_vars[server][shard] for shard in query.shard_set]
            )
            <= query_clusering_var
        )
```

To ensure that the values `p_vars` and `assn_vars` take up also remain
consistent, we need to add the following constraints:

- for a given shard, the proportions (which are in essence probabilities) with
  which queries accessing it are routed to different servers should all add up
  to 1
- If the rate/probability at which a server should expect a query accessing a
  given shard is greater than 0, then that server should be assigned that shard.
  To phrase it differently, if `assn_vars[server][shard] == 0` then
  `p_vars[server][shard] == 0`

```python
# for a given shard, ensure if assn is 0 then p is 0
for server in range(num_servers):
    for shard in range(num_shards):
        model += (
            p_vars[server][shard] <= assn_vars[server][shard]
        )

# for a given shard, the sum of all p should equal 1
for shard in range(num_shards):
    model += (
        pulp.lpSum(p_vars[server][shard] for server in range(num_servers))
        == 1
    )
```

Whichever assignment the solver figures out, each shard should be placed on at
least one server. In cases where the system must provide durability guarantees
via replication, this constraint could be modified to ensure the shards are
stored in say at least 3 servers if that's the replication factor:

```python
# require each shard to appear on at least one server
for shard in range(num_shards):
    model += (
        pulp.lpSum(
            assn_vars[server][shard]
            for server in range(num_servers)
        )
        >= 1
    )
```

Lest we forget, we've also got server memory constraints that must be adhered
to:

```python
# server memory constraints
for server in range(num_servers):
    model += (
        pulp.lpDot(shard_memory_usages, assn_vars[server])
        <= server_max_memory
    )
```

Lastly, we've got the load balancing constraints. Setting the epsilon value is
tricky. We can make it smaller but that also risks making the problem
infeasible. On the other hand, making it too large and the load ends up
imbalanced across all the servers:

```python
# load constraints
average_load_per_server = sum(shard_loads) / num_servers
epsilon = 0.05 * average_load_per_server
server_load_bound = {
    "lower": average_load_per_server - epsilon,
    "upper": average_load_per_server + epsilon,
}

for server in range(num_servers):
    # min load constraint
    model += pulp.lpDot(shard_loads, p_vars[server]) >= (
        server_load_lowerbound["lower"]
    )

    # max load constraint
    model += pulp.lpDot(shard_loads, p_vars[server]) <= (
        server_load_upperbound["upper"]
    )
```

With some ad-hoc experimentation here and there, I've figured that I can make
epsilon smaller by either increasing the server capacities (memory in this
case), or 'reducing' the loads on the hottest shard sets relative to the rest -
or even combining both approaches.

In a production setting, increasing server capacities is straightforward. As for
the shard loads, we don't have that much control over the kind of queries
upstream clients will throw our way. What we can do instead is 'split' hot shard
sets for the purposes of running the placement procedure. So for example if the
most frequently queried shard set is `{10,11,12,20,25}` with a frequency of 100,
we split it into two logical shard sets that all have the same shards but each
with a frequency of 50. With the current configurations though, none of this is
required.

Back to the problem at hand. With the objective and constraints in place, it's
time to run the solver:

```python
status = model.solve(pulp.PULP_CBC_CMD(msg=False))
assert (
    status == pulp.constants.LpStatusOptimal
), f"Unexpected non-optimal status {status}"

optimal_query_clustering_vals = [
    int(v.varValue) for v in query_clustering_vars
]
```

Once done, `assn_vars` should hold the optimal shard placements and `p_vars`
should hold the optimal proportions with which the queries should be routed by
the executor. But we're not quite done yet...

## Part 2: Minimizing Data Movement

As is, placing shards around as per `assn_vars` will result in a lot of movement
and the system might end up spending more time shuffling data around for
non-query work rather than for executing actual queries.

With `init_locations`, let's derive a next-`assn_vars` that minimizes data
movement while maintaining the optimal clustering values for the top-K queries.

Let's start with the decision variables. We'll have the `p_vars` and `assn_vars`
once more but no `query_clustering_vars` since we already obtained the optimal
values from the first part:

```python
p_vars = [
    [
        pulp.LpVariable(f"p_{server}_{shard}", 0, 1, cat="Continuous")
        for shard in range(num_shards)
    ]
    for server in range(num_servers)
]

assn_vars = [
    [
        pulp.LpVariable(f"a_{server}_{shard}", 0, 1, cat="Binary")
        for shard in range(num_shards)
    ]
    for server in range(num_servers)
]
```

As for the objective function, the authors define it as follows:

```python
model2 = pulp.LpProblem("p2", pulp.LpMinimize)

p2_objective = pulp.lpSum(
    list(
        init_locations[server][shard] * assn_vars[server][shard]
        for shard in range(num_shards)
        for server in range(num_servers)
    )
)

model2 += p2_objective
```

I might be wrong, but I reckon this definition achieves the exact opposite -
we're maximizing shard movement instead! From the paper:

> To model shard locations before assignment, we also define a matrix 𝑡 where 𝑡
> 𝑖 𝑗 is 0 if server 𝑖 currently hosts a replica of shard 𝑗 and 1 otherwise. The
> total amount of shard movement is the sum of the element-wise product of 𝑡 and
> 𝑥.

Matrix T is `init_locations` and matrix X is `assn_vars`. With matrix T, an
element i,j is 1 if server i currently holds shard j. On the other hand, matrix
X holds the binary decision variables which indicate whether server i should
hold shard j. Given T and X, data movement occurs whenever `T[i][j] != X[i][j]`
(1 -> 0 and 0 -> 1). On the other hand, no data movement occurs if
`T[i][j] == X[i][j]` (1->1, 0->0). To minimize this element-wise product (as is
the case in the code snippet above), the solver has to reduce as many `1->1`s
i.e optimal placement of shards to where they were already residing (reduce data
'rest' or 'inertia'). Additionally it'll flip as many 0s to 1s and 1s to 0's as
it can get away with (i.e. increase data movement). It's only in the case of
`0->0` where a server wasn't assigned a particular shard and still isn't that
the objective as defined aligns with minimizing data movement.

To actualize minimize data movement, we need to think of the costs of assigning
a particular shard at a given server. If the server already hosted that shard,
the cost is zero, otherwise, it's non-zero. For the sake of modeling, we can
derive the transfer costs from `init_locations` as follows:

```python
transfer_costs = [
    [1 - init_locations[server][shard] for shard in range(num_shards)]
    for server in range(num_servers)
]
```

Rewriting the objective:

```python
model = pulp.LpProblem("p2", pulp.LpMinimize)

objective = pulp.lpSum(
    list(
        transfer_costs[server][shard] * assn_vars[server][shard]
        for shard in range(num_shards)
        for server in range(num_servers)
    )
)
model += objective
```

And now for the rest of the constraints.

We already obtained the optimal clustering values from part 1; let's extract it
from the decision variables then use it now as a constraint to ensure that
performance is maintained regardless of re-assignment:

```python
for query, query_clustering_val in zip(
    queries, optimal_query_clustering_vals
):
    for server in range(num_servers):
        model += (
            pulp.lpSum(
                [assn_vars[server][shard] for shard in query.shard_set]
            )
            <= query_clustering_val
        )
```

The rest of the constraints are the same from part 1:

- server load constraints for load balancing
- ensure `p_vars` and `assn_vars` are consistent
- ensure server memory constraints are adhered to
- require each shard to appear on at least one server

Once the solver runs and we've successfully obtained an optimal solution, it's
time to extract the assignments:

```python
status = model.solve(pulp.PULP_CBC_CMD(msg=False))
assert (
    status == pulp.constants.LpStatusOptimal
), f"Unexpected non-optimal status {status}"

next_locations = [
    [int(assn_vars[server][shard].varValue) for shard in range(num_shards)]
    for server in range(num_servers)
]

next_query_routing_map = [
    [p_vars[server][shard].varValue for shard in range(num_shards)]
    for server in range(num_servers)
]
```

`next_locations` is used to place shards into the requisite servers and once
done, `next_query_routing_map` is used by the leader node to route queries to
the servers based on the shards each query is accessing.

After optimization, we get two important outcomes as per the given workload:

- the average load per server remains around the same ballpark: 1,833 initial
  value vs. 1,875
- the load is distributed more evenly:
  - initial: `[1668, 1130, 1961, 2048, 2573, 1620]`
  - next: `[1919, 1913, 1907, 1827, 1870, 1815]`
- the weighted sum of query clustering is reduced:
  - initial: 4208
  - next: 2161

Also of note, minus the second step of minimizing data movement, we'd have a
transfer cost of 346 but with the step, we get a transfer cost 169 while still
maintaining the optimal query clustering and load balancing.

This approach should work for small input sizes (number of shards, servers and
queries) but will be infeasible for larger inputs. The authors do have a section
in the paper where they apply partitioning of the inputs and solving data
placement within those partitions so as to scale PODP. They go a bit deeper into
this partitioning approach in a separate paper:
[Solving Large-Scale Granular Resource Allocation
Problems Efficiently with POP](https://people.eecs.berkeley.edu/~matei/papers/2021/sosp_pop.pdf).
On a different note, PODP can be modified to work in settings where the cluster
size is dynamic. That is if the average load per server increases beyond a
certain threshold, we add more nodes to the cluster; if it goes below a set
threshold, we reduce the number of nodes - an exercise left to the reader :)
