+++
title = "The Facility Location Problem"
date = "2024-03-06"
summary = "Discrete Optimization: Where to construct facilities so as to minimize setup costs and customer servicing costs while ensuring each facility is able to meet customer demands."
tags = ["Discrete Optimization"]
type = "post"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "facility-location-problem"
+++

The facility location problem is as follows: we've got customers at different
geographical locations and a set of possible locations where we want to decide
whether to build a facility or not. There's the cost of servicing a customer and
the closer a facility is to a customer, the less the cost is. Additionally,
there's the setup cost of constructing a facility so even though locating a
facility let's say right within the city center will result in lower customer
servicing costs, the setup costs e.g. in terms of real estate, permits e.t.c
might be higher so probably taking the facility slightly out of the city might
be cheaper. The goal is to figure out which locations to build our facilities
and how many such that the setup costs and servicing costs are optimally
minimized. For this, I'll be using PuLP to formulate and model the problem, then
have it invoke a solver to find the optimal solution.

## Inputs

Let's start with the input:

For the facilities, we've got the possible locations we're considering and the
associated setup costs:

```python
facility_setup_costs = [600, 700, ... ]
facility_locations = [(45.5,60.1), (23,90.2), ... ]
num_facilities = len(facility_locations)
```

For the customers, we've got the locations:

```python
customer_locations = [(29.4,12.9), (12.1,54.2), ... ]
num_customers = len(customer_locations)
```

For the sake of example, the cost of servicing a customer from a given facility
will simply be the euclidean distance between the two but in more realistic
settings, we ought to have a better measure of this cost. Let's construct a
distance matrix so that it's only computed once:

```python
import math

def length(p0, p1):
    return math.sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2)

dist_matrix = [
    [0.0 for _ in range(num_customers)] for _ in range(num_facilities)
]
for f_i, f_loc in enumerate(facility_locations):
    for c_i, c_loc in enumerate(customer_locations):
        dist_matrix[f_i][c_i] = length(f_loc, c_loc)
```

## Decision Variables

There are two things we need to decide:

- whether a facility gets built or not: `facilities_built`
- once a facility is built, which customers are allocated to that facility:
  `allocations`

Let's capture these decisions with the following decision variables:

```python
from pulp import *

# decision variables
facilities_built = [
    LpVariable(f"f_{f}_built", cat="Binary") for f in range(num_facilities)
]

allocations = [
    [
        LpVariable(f"alloc_{c}_to_{f}", cat="Binary")
        for c in range(num_customers)
    ]
    for f in range(num_facilities)
]
```

## Objective

Now that we've got the decision variables set up, let's define the objective
function. This is the function for which the solver will figure out what values
the decision variables should take such that it's optimally minimized:

```python
# model
model = LpProblem("facility_problem", LpMinimize)

# objective
obj = lpSum(
    [
        f_is_built * facility_setup_costs[f_id]
        for (f_id, f_is_built) in enumerate(facilities_built)
    ]
) + lpSum(
    [
        lpSum([c * d for c, d in zip(customers, dists_to_customer)])
        for (customers, dists_to_customer) in zip(allocations, dist_matrix)
    ]
)
model += obj
```

## Constraints

One way to minimize costs is just to decide to not build any facilities and
allocate zero customers to all the facilities - the cost will be zero. That's
why we need to add constraints that make sense for the problem we're trying to
solve.

One such constraint is that every customer is allocated exactly one facility (a
facility could always handle more than one customer):

```python
for c in range(num_customers):
    constraint = lpSum([allocations[f][c] for f in range(num_facilities)]) == 1
    model += constraint
```

Another constraint is that no customer is served from a facility that doesn't
get built:

```python
for f_id in range(num_facilities):
    is_built = facilities_built[f_id]
    for c_id in range(num_customers):
        model += allocations[f_id][c_id] <= is_built
```

## Solution

This is the easy part. It could get thorny if the inputs are large - then we
would have to figure out if we need to model our problem differently or try out
different solvers/approaches:

```python
status = model.solve(PULP_CBC_CMD(msg=False))
assert (
    status == constants.LpStatusOptimal
), f"Unexpected non-optimal status {status}"
```

Let's retrieve the allocations. `solutions` will hold which `facility_id` a
customer is allocated:

```python
solution = [-1 for _ in range(num_customers)]
for f_id, customers in enumerate(allocations):
    for c_id, c in enumerate(customers):
        if c.varValue > 0:
            solution[c_id] = f_id
```

Additionally, let' calculate the costs we'll expect:

```python
# calculate the cost of the solution
cost = 0

# cost for facilities built
for f_id in set(solution):
    cost += facility_setup_costs[f_id]

# cost for customers
for c_id, f_id in enumerate(solution):
    cost += dist_matrix[f_id][c_id]
```

## Capacity Constraints

To make the problem slightly more realistic, let's add customer demands and
facility capacities. That is, the demands of all the customers allocated to a
facility should be less than or equal to that facility's capacity:

The additional input will be as follows:

```python
customer_demands = [30, 20, ... ]
facility_capacities = [800, 1000, ... ]
```

As for the constraints, we'll have the following:

```python
# the demands serviced by a facility must be less than or equal to its
# capacity
for f_id, customers in enumerate(allocations):
    constraint = (
        lpSum(
            [
                is_assigned * customer_demands[c_id]
                for (c_id, is_assigned) in enumerate(customers)
            ]
        )
        <= facility_capacities[f_id] * facilities_built[f_id]
    )
    model += constraint
```

And that's it.

Also worth adding are 'sanity' checks such that the solution we find at the end
is valid. For the checks, we need to ensure that:

1. If a customer is assigned to facility, then it's it's actually built
2. A customer should not be assigned to more than 1 facility
3. The sum of the customer's demands is well within the facility's capacity

```python
already_assigned = [False for _ in range(num_customers)]
for f_id, customers in enumerate(allocations):
    demands = 0
    for c_id, c in enumerate(customers):
        if c.varValue > 0:
            assert already_assigned[c_id] == False
            already_assigned[c_id] = True
            demands += customer_demands[c_id]
    is_built = facilities_built[f_id].varValue > 0
    customers_assigned = demands > 0
    assert is_built == customers_assigned
    assert demands <= facility_capacities[f_id]
```

## Minizinc

For reference, here's how the same problem is modeled in minizinc. This
particular modeling might be useful if the goal is to have it solved via a MILP
solver:

```minizinc
% parameters
par int: num_facilities;
array[1..num_facilities] of float: facility_setup_costs;
array[1..num_facilities] of int: facility_capacities;

par int: num_customers;
array[1..num_customers] of int: customer_demands;

array[1..num_facilities,1..num_customers] of float: dist_matrix;

% decision variables
array[1..num_facilities,1..num_customers] of var 0..1: allocations;
array[1..num_facilities] of var 0..1: facilities_built;

% constraints

% obj
var float: cost =
    sum(f in 1..num_facilities)(facilities_built[f] * facility_setup_costs[f])
    +
    sum(f in 1..num_facilities,c in 1..num_customers)(allocations[f,c]*dist_matrix[f,c]);

constraint forall(c in 1..num_customers)
    (sum(f in 1..num_facilities)(allocations[f,c]) == 1);

constraint forall(f in 1..num_facilities,c in 1..num_customers)
    (allocations[f,c] <= facilities_built[f]);

constraint forall(f in 1..num_facilities)
    (sum(c in 1..num_customers)(allocations[f,c]*customer_demands[c])
        <= (facility_capacities[f]*facilities_built[f]));

solve minimize cost;
output ["\(cost)"];
```