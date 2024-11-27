# TSP, k Salespeople, Vehicle Routing & Linear Programming

With the Travelling Salesperson Problem, we've got a set of nodes and for each
node, there's an edge connecting it to every other node (i.e. it is a complete
graph). There's a cost associated with traversing an edge. The problem then is
to compute the lowest cost tour that traverses every node exactly once (with the
exception of the starting node will be visited twice: when we start the tour and
when we end the tour). More colloquially: "Given a list of cities and the
distances between each pair of cities, what is the shortest possible route that
visits each city exactly once and returns to the origin city?" (from
[wikipedia](https://en.wikipedia.org/wiki/Travelling_salesman_problem)).

## Distance/Cost Matrix

## Brute Force solution

If we have n nodes, we'll have to check the cost of `(n-1)!` tours (the start
node is fixed) so as to find the minimum cost tour. Calculating the cost of a
single tour is `O(n)`. In the above example, we have 6 nodes and that meant
checking `(5-1)! == 120` tours. However, the computational complexity increases
exponentially such that with 9 nodes we'll check 40,320 and with 20 nodes we'll
check 87,178,291,200 tours. Therefore we'll need a better approach as number of
nodes increases.

## Integer Linear Programming formulation

One such approach is to formulate the problem as a linear programming problem.
Credits to Prof. Sriram Sankaranarayanan for his course
'[Approximation Algorithms and Linear Programming](https://www.coursera.org/learn/linear-programming-and-approximation-algorithms/)'
where I learnt this approach from sourced the code samples. He in turn credits
Miller, Tucker and Zemlin who formulated the ILP approach and published
'[Integer Programming Formulation of Traveling Salesman Problems](https://dl.acm.org/doi/pdf/10.1145/321043.321046)'.
Hence it's often referred to as the MTZ method.

We'll use [PuLP](https://coin-or.github.io/pulp/) to formulate and model the
problem then have it invoke the solver.

Given `n` nodes, we compute the `n x n` cost matrix.

From there the first step is to define the **decision variables**:

```python
from pulp import *

selected = [
    [
        LpVariable(f"x_{i}_{j}", cat="Binary") if i != j else None
        for j in range(n)
    ]
    for i in range(n)
]
timestamps = [
    LpVariable(f"t_{j}", lowBound=0, upBound=n, cat="Continuous")
    for j in range(1, n)
]
```

`selected` is the corresponding `n x n` matrix of indicator variables (Binary)
such that if `selected[i][j]` is set to 1 then the tour passes from node i to
node j, otherwise, it's set to 0. For `i == j`, we set the element to `None`
since we do not have edges connecting nodes to themselves (i.e. loops).

The `timestamps` values indicate in which order the nodes were traversed such
that if the tour goes from node 3 to node 8, then it must be the case that
`timestamps[8] > timestamps[3]`. The timestamps are needed to eliminate
subtours.

The solver will have to figure out what values these decision variables will
take such that we get a minimum cost tour. Therefore, let's create a model and
add this as its **objective**. In the objective

```python
# model
model = LpProblem("TSP", LpMinimize)

# objective
obj = lpSum(
    [
        lpSum(
            [
                is_next * cost if is_next != None else 0
                for (is_next, cost) in zip(next_nodes, costs)
            ]
        )
        for (next_nodes, costs) in zip(selected, cost_matrix)
    ]
)

model += obj
```

Additionally, we need to add **constraints**.

The first constraint ensures that we end up with a valid tour, that is, for
every node, there is only one outgoing edge that is incident and one incoming
edge that is incident:

```python
# every other vertex must have only one incoming edge and one outgoing edge
for i in range(n):
    # outgoing
    model += lpSum([x_j for x_j in selected[i] if x_j != None]) == 1
    # incoming
    model += lpSum([selected[j][i] for j in range(n) if j != i]) == 1
```

Furthermore, we also add subtour elimination constraints. `M` below should be a
sufficiently large number (larger than any value a timestamp can take) such that
if `x_ij == 0`, indicating that the tour does not go from node i to node j, the
inequality reduces to `t_j >= t_i - M` which will hold true trivially. If
`x_ij == 1`, indicating that the tour goes from node i to node j, then the
inequality becomes: `t_j >= t_i + 1`. This is referred to as the
[Big M method](https://en.wikipedia.org/wiki/Big_M_method) and is useful for
encoding if-else constraints in linear programming. Also note that we do not
constrain the timestamps for edges going into the starting point 0.

```
# subtour elimination constraints
M = n + 1
for i in range(1, n):
    for j in range(1, n):
        if i == j:
            continue
        x_ij = selected[i][j]
        t_i = timestamps[i - 1]
        t_j = timestamps[j - 1]
        constraint = t_j >= t_i + x_ij - (1 - x_ij) * M
        model += constraint
```

Finally, to solve the problem:

```python
status = model.solve(PULP_CBC_CMD(msg=False))
assert (
    status == constants.LpStatusOptimal
), f"Unexpected non-optimal status {status}"
```

If all goes well, we can now extract the minimum cost tour from the values the
`selected` decision variables have taken up:

```python
# extract tour
is_next_node = lambda v: v.varValue > 0 if v is not None else False
tour = []
i = 0  # tour starts at 0
while True:
    tour.append(i)
    outgoing = [j for j,v in in enumerate(selected[i]) if is_next_node(v)]
    assert len(outgoing) == 1
    i = outgoing[0]
    if i == 0:
        break

assert tour == [0, 2, 1, 5, 3, 4]
print(tour)
```

To calculate the cost of this tour:

```
# get cost of tour
from itertools import pairwise, chain

cost = 0
for i, j in pairwise(chain(tour, (0,))):
    cost += cost_matrix[i][j]
```

## K Salespeople & Vehicle Routing

Rather than limit ourselves to 1 salesperson, we can add `k=3` of them. Every
saleperson will start and end at the home office (node 0). From there, they have
to figure out the tour each will take such that every city is covered by one of
the salesperson.

Extending the code above to handle k salespeople entails changing the degree
constraints such that the starting point must have `k` outgoing edges and `k`
incoming edges. The degree constraints for every other node remains the same.
Note that if `k == 1` then we've got the standard TSP.

```python
# starting point has k incoming and k outgoing edges
model += lpSum([xj for xj in selected[0] if xj != None]) == k
model += lpSum([selected[j][0] for j in range(n) if j != 0]) == k

# every other vertex must have only one incoming edge and one outgoing edge
for i in range(1, n):
    # outgoing
    model += lpSum([x_j for x_j in selected[i] if x_j != None]) == 1
    # incoming
    model += lpSum([selected[j][i] for j in range(n) if j != i]) == 1
```

To extract the `k` different tours:

```python
all_tours = []
is_next_node = lambda v: v.varValue > 0 if v is not None else False
# start at 0
outgoing = [j for j, v in enumerate(selected[0]) if is_next_node(v)]
assert len(outgoing) == k
for i in outgoing:
    tour = [0] 
    while True:
        tour.append(i)
        outgoing = [j for j, v in enumerate(selected[i]) if is_next_node(v)]
        assert len(outgoing) == 1
        i = outgoing[0]
        if i == 0:  # back at starting point
            break
    all_tours.append(tour)

for tour in all_tours:
    print(tour)
```

To calculate the overall cost:

```python
from itertools import pairwise, chain

cost = 0
for tour in all_tours:
    for i, j in pairwise(chain(tour, (0,))):
        cost += cost_matrix[i][j]
print(cost)
```

Just because we have `k` salespeople does not all of them have to hit the road,
allowing some of them to remain idle might result in lower cost tours. To cover
this scenario, we simply change the degree constraint of the starting node from
having to equal `k` to having `k` be simply an upperbound:

```
# starting point has UPTO k incoming and k outgoing edges
model += lpSum([xj for xj in selected[0] if xj != None]) <= k
model += lpSum([selected[j][0] for j in range(n) if j != 0]) <= k
```

This generalization of TSP kicks off our venture into the _Vehicle Routing
Problem_ often shortened to VRP. With VRP, the home office becomes the warehouse
or depot, the salepeople are the vehicles and the cities are the customers.
Thus, we ask: "What is the optimal set of routes for a fleet of vehicles to
traverse in order to deliver to a given set of customers" (from j
[wikipedia](https://en.wikipedia.org/wiki/Vehicle_routing_problem)).

## References

- [link 1](https://www.linkedin.com/pulse/vehicle-routing-problem-pulp-real-world-scenarios-dhawal-thakkar/)
- [link 2](https://medium.com/jdsc-tech-blog/capacitated-vehicle-routing-problem-cvrp-with-python-pulp-and-google-maps-api-5a42dbb594c0)
