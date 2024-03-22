---
layout: post
title:  "Guided Local Search for the Capacitated Facility Location Problem"
slug:  guided-local-search-flp
tag: ["Discrete Optimization"]
categories: "Discrete Optimization"
excerpt_separator: <!--start-->
---

Overview of Guided Local Search plus how it can be applied to the capacitated
facility location problem.

<!--start-->

## Introduction

In this post, I'll give a quick overview of Guided Local Search and then
demonstrate how it can be applied to the capacitated facility location problem
(which from here on shall be abbreviated as FLP).

## Complete and Incomplete Search

In previous posts, I've provided an overview of _Complete Search_ methods for
solving FLP. These are exhaustive and guaranteed to find the optimal (lowest
cost) solution if the problem is satisfiable or otherwise prove unsatisfiability
[1]. However, they can be quite slow for larger problem sizes [1].

On the other hand, we have _incomplete search_ methods: these typically start
from an initial solution (usually generated randomly or via a greedy approach)
and modify it over and over again to try and optimize the objective. Unlike
Complete Search, the solution derived with these methods in almost all cases are
not guaranteed to be optimal nor can they tell us whether the problem is
unsatisfiable. However, incomplete search methods are faster and scale to larger
problem sizes [1].

## Local Search

From [wikipedia](https://en.wikipedia.org/wiki/Local_search_optimization), local
search involves moving "from solution to solution in the space of candidate
solutions (the search space) by applying local changes, until a solution deemed
optimal is found or a time bound is elapsed". Since we're starting from an
initial solution, all the decision variables have a set value and what we've got
is an initial _state_ [1]. From there a _move_ involves changing some of the
decision variables so as to move to a new state; we've also got the neighborhood
which is the "set of moves to consider at each point in the search" [1].

With regards to FLP, an initial solution can be derived via a randomly assigning
a customer to a facility while keeping track of each facility's current
capacity. From there, a move entails picking a customer and swapping the
facility it's assigned. This might result in increasing the cost if a customer
is moved to an unopened facility (which will result in new setup costs) and/or
assigning a customer to a facility that's further away than the previous one. It
might also result in reducing the cost if the customer was the last customer for
that facility hence it does not have to be constructed and/or the customer is
assigned a closer facility. The neighborhood for each move is the set of
facilities that have enough remaining capacity to take up the new customer. We
can also reduce the neighborhood further by limiting a customer to nearby
facilities. With each move, we keep track of the best state (i.e. has the lowest
cost). After either a certain amount of time or a fixed number of iterations, we
stop the local search and return the assignment derived from the best state.

## Guided Local Search

From [2], Local Search "an find good solutions very quickly. However, it can be
trapped in local optima – positions in the search space that are better than all
their neighbors, but not necessarily representing the best possible solution
(the global optimum)". Hence the development of meta-heuristic methods for
escaping local minima. Once search method is Guided Local Search (GLS).

With GLS we define a set of features and track which subset of the features is
present in a given state. When we reach a local minima, the subset of features
present in that local minima are then penalized. To be more precise, we don't
penalize all the features in that subset rather we select for those features
that will give us the maximum _utility_ if we penalize them. We do not want to
waste time penalizing low cost features that contribute very little to the
overall cost nor do we want to penalize features that we've already penalized a
lot since additional penalties won't do much to help us escape the local minima.
From there, the cost function is _augmented_ with the penalties such that the
more time we spend at or near the local minima, the more the penalties accrue
until eventually local search moves to a different state entirely. The
contribution of the penalties to the augmented cost is governed by a _lambda_
parameter - that is, how much do we want the penalties to contribute to the
cost?

When running guided local search, we've got to decide two things:

1. Features: which features do we use? In the case of FLP, it could be the
   facility setup costs, distance between facilities and customers, facilities'
   capacities or a combination of 2 or more of these.
2. The lambda parameter: it could be 1.5 or 100

There's no once fixed answer that will apply to all the problems - we'll have to
experiment around for each problem.

It goes without saying, as with local search, we do keep track of the best
solution found so far and after a given duration or number of iterations, we
return that as the final solution - it probably won't be the optimal solution
but if we've set everything fine it should be a good enough solution.

## GLS Implementation: Preliminaries

We start with the following input:

```python
num_facilities = 25
num_customers = 50
facility_capacities = [7500.0, ... ]
facility_setup_costs = [58268, ... ]
facility_locations = [(430582.903998, 430582.903998), ... ]
customer_demands = [146, ... ]
customer_locations = [(416189.973974, 279924.793498), ... ]
```

The cost of assigning a facility to a customer is the euclidean distance between
the two. Therefore, we derive the `dist_matrix` for quick lookups of this cost:

```python
import math

length = lambda p0,p1: math.sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2)
dist_matrix = [
    [0.0 for _ in range(num_customers)] for _ in range(num_facilities)
]
for f_i, f_loc in enumerate(facility_locations):
    for c_i, c_loc in enumerate(customer_locations):
        dist_matrix[f_i][c_i] = length(f_loc, c_loc)
```

The overall cost of an assignment is the sum of all the setup costs for
facilities that are assigned 1 or more customers plus the sum of all the
distances between customers and the facilities they are assigned to. Recall that
that goal is to minimize this cost as much as possible. We'll use the following
function to calculate this cost:

```python
def calc_cost(assignments, dist_matrix, facility_setup_costs):
    overall_cost = sum(
        dist_matrix[f][c] for c, f in enumerate(assignments)
    ) + sum(facility_setup_costs[f] for f in set(assignments))
    return overall_cost
```

The decision variable is `assignments`. This is an array of length
`num_customers` whereby the index is the customer's ID and the value at that
index is the facility ID that the customer is assigned to. Since this is the
capacitated variant of the problem, we must ensure that the sum of the demands
of all the customers assigned to a given facility is less than or equal to that
facility's capacity.

Before carrying out the search, we need to calculate an initial solution that
will be improved upon. According to the authors of [2], GLS isn't particularly
sensitive to the initial solution so any quick down-and-dirty approach should
work. Using a greedy approach, I get an assignment whose cost is 8,364,601.59:

```
initial_assignments = solve_greedy(
    facility_setup_costs, facility_capacities, customer_demands, dist_matrix
)
initial_cost = calc_cost(
    initial_assignments, dist_matrix, facility_setup_costs
)
print(initial_cost) # 8364601.587374086
```

## GLS Implementation: State Variables

We'll start of with the state variables. These include the decision variables
plus any ancillary variables we have to modify any time we make a move (moving a
customer from one facility to another) so as to reflect our current state.
`assignments` is initialized with the `initial_assignments` we calculated above.

```python
assignments = initial_assignments
```

We also keep around a bunch of derived values from `assignments` so as to speed
up some computations. `facility_current_capacities` is used to keep track of how
much unassigned capacity a facility has; this should not go below 0.

```python
facility_current_capacities = facility_capacities.copy()
for c, f in enumerate(initial_assignments):
    facility_current_capacities[f] -= customer_demands[c]
assert all(c >= 0 for c in facility_current_capacities)
```

There's also `facility_to_customer_num` which keeps track of the number of
customers a facility has - if it's 0, the facility should remain unopened, if
it's 1 or more, we need to include its setup costs. As I am writing this, I've
just realized I don't need this variable: since both demands and capacities are
integers, I could compare a facility's initial capacity with its current used
capacity and if both values are the same it remains unopened.

```python
facility_to_customer_num = [0 for _ in range(num_facilities)]
for f in initial_assignments:
    facility_to_customer_num[f] += 1
assert(sum(facility_to_customer_num) == num_customers)
```

## GLS Implementation: Parameters, Features and Penalties

GLS requires that the implementer decide on which features to use. In my case, I
used the facility setup costs as the features - with all credits to github user
Kouei whose
[approach](https://github.com/kouei/discrete-optimization/blob/master/facility/main.cpp)
I referenced. A feature is present in a particular solution if the facility is
opened (has 1 or more customers) in that solution. Therefore, we've also got
`feature_indicators` which track whether a facility is opened or not. We've also
got `penalities` which is initialized to 0 for all features and incremented by 1
whenever a particular feature is penalized. We've got `num_steps` which is the
number of iterations we want to carry out local search. Lastly we've got the
lambda parameter which for now is set to a magic number but we'll see how we can
tune it dynamically based on where we are in the search space:

```python
features = facility_setup_costs.copy()
feature_indicators = [int(n > 0) for n in facility_to_customer_num] # 0 or 1
penalties = [0 for _ in features]
num_steps = 100
lambda_ = 27.5
```

A point worth noting is that in GLS, we don't use the cost function directly to
guide search. Instead, we augment the cost function with the penalties (weighted
by lambda) so as to guide the search. When a feature is present, `I` will be 1
hence the penalty associated with that feature will be included. When a feature
is absent, `I` will be 0 and the penalty won't be included:

```python
cost = calc_cost(assignments, dist_matrix, facility_setup_costs)
augmented_cost = cost + (
    lambda_ * sum(I * p for (I, p) in zip(feature_indicators, penalties))
)
```

Any time we make a move, we also check whether it has resulted in the best
solution seen so far based on its augmented cost, so we need variables to keep
track:

```
best_assignment = None
best_augm_cost = augmented_cost
```

## GLS Implementation: Neighborhoods and Making Moves

With incomplete search methods, we have to decide what a move constitutes plus
the moves we're allowed to make at each step (i.e. the neighborhood).

As mentioned earlier, a move at a single step will involve picking a customer
and assigning them to a new facility. I'll use the steepest descent approach: at
each step pick the customer-facility swap pair that results in the lowest
reduction of the augmented cost. For each customer, the neighborhood will
consist of all facilities that still have enough capacity to accommodate that
customer.

This approach is simple to implement though it makes every move rather expensive
since we have to evaluate nearly all the pairs to get the best move. We could
speed it up by parallelizing the evaluation. We could also maintain a Tabu list
e.g. of all previous K facilities that have had a customer moved out of them
recently. Alternatively, we could also limit the neighborhood of a customer to
all nearby facilities (e.g. by using K-means clustering in the initial stage to
define a customer's 'geographical' partition).

It's worth pointing out that rather than calculate the augmented cost over and
over again any time a move made, I'll instead keep track of the delta/diff for
that move and use it to update the augmented cost. This makes the implementation
more efficient at the expense of increased complexity.

Now, for the move. For each step, we'll iterate over all customer and facility
pairs. We'll also keep track of the best move and best diff seen so far at each
iteration. `f_old` is a customer's currently assigned facility and `f_new` is
the new facility we want to assign it to. We skip over facilities that don't
have enough unused capacity.

```python
best_augm_diff = None
best_move = None

for c in range(num_customers):
    f_old = assignments[c]
    for f_new in range(num_facilities):
        if f_old == f_new:
            continue
        if customer_demands[c] > facility_current_capacities[f_new]:
            continue
```

To calculate the diff of a move, we subtract the cost of moving a customer out
of the old facility and add the newly incurred cost of moving a customer to the
new facility. If the old facility had just that one customer, then moving the
customer out will result in the facility getting 'unopened' hence we don't have
to incur its setup costs. If the newly assigned facility did not have any
customers yet, we'll have to incur its setup costs. Therefore, good moves will
result in diffs less than zero (a reduction in costs) and bad moves will result
in 0 or higher diffs (an increase in costs). There are search methods where we
make moves even if it increases cost. However, in our case, since we're using a
steepest descent approach, we won't make any moves if all of them result in
increasing the cost. When we're in such a state (local minima), courtesy of GLS,
we'll rely on penalizing the features present in that state to bail us out and
move us to a different minima. Also worth reiterating, GLS requires us to use
the augmented cost rather than the actual cost when evaluating moves:

```python
        # calc augmented cost of move
        augm_diff = 0

        # leave f_old
        augm_diff -= dist_matrix[f_old][c]
        # check if move results in shutting down f_old
        if facility_to_customer_num[f_old] == 1:
            augm_diff -= facility_setup_costs[f_old]
            augm_diff -= lambda_ * penalities[f_old]

        # go to f_new
        augm_diff += dist_matrix[f_new][c]
        # check if move results in opening up f_new
        if facility_to_customer_num[f_new] == 0:
            augm_diff += facility_setup_costs[f_new]
            augm_diff += lambda_ * penalities[f_new]

        if best_augm_diff is None or augm_diff < best_augm_diff:
            best_augm_diff = augm_diff
            best_move = (c, f_old, f_new)

# if the diff is positive (results in an increase of costs), we do not make
# the move as per steepest descent approach
if best_augm_diff is not None and best_augm_diff > 0:
    best_move = None
```

If we've got a move we can make, we make that move and update the state
variables accordingly:

```python
if best_move is not None:  # make move
    (c, f_old, f_new) = best_move

    # move from old facility
    facility_to_customer_num[f_old] -= 1
    facility_current_capacities[f_old] -= customer_demands[c]
    feature_indicators[f_old] = int(facility_to_customer_num[f_old] > 0)

    # move to new facility
    assignments[c] = f_new
    facility_to_customer_num[f_new] += 1
    facility_current_capacities[f_new] += customer_demands[c]
    feature_indicators[f_new] = int(facility_to_customer_num[f_new] > 0)

    augmented_cost += augm_diff
    if augmented_cost < best_augm_cost:
        best_augm_cost = augmented_cost
        best_assignment = assignments.copy()
```

If we can't make a move (we're at a local minima), it's time to penalize the
features present at state (tracked via the `feature_indicators` list). We don't
penalize all the features, just those for which we'll get the greatest bang for
our buck, via the following utility function:

```math
\displaystyle{ util_{i}(s_{{\ast}}) = I_{i}(s_{{\ast}}) \times \frac{c_{i}} {1 + p_{i}} }
```

For each feature, we calculate the utility of penalizing that feature via the
formula above. It's worth pointing out that the higher the cost of a feature (a
facility's setup cost) the greater the utility of penalizing that feature and
the lower the cost the lower its utility. Additionally, if we've already
penalized that feature a lot already, then the lower the utility we'll derive
from penalizing it again - if we haven't penalized it that much yet, then the
utility will be higher. From there, we get the max utility and increment the
penalties of all the features with `max_util`:

```python
else: # best_move is None and we're at a local minima
    utils = [
        I * (cost / (1 + penalty))
        for (I, cost, penalty) in zip(feature_indicators, features, penalties)
    ]
    max_util = max(utils)
    for i, util in enumerate(utils):
        if util == max_util:
            penalties[i] += 1
```

## GLS Implementation: Deriving Lambda

Determining a value for lambda seems to involve a lot of fiddling around. Also,
just because a particular value of lambda worked quite well for one problem does
not mean it can be plugged into other problems and work right out of the box. To
aid a bit in deriving a value for lambda, the authors of [2] provide the
following formula:

```math
\displaystyle{ \lambda =\alpha {\ast}g(x^{{\ast}})/(\mbox{ no. of features present in }x^{{\ast}}) }
```

As they state: "for several problems, it has been observed that good values for
lambda can be found by dividing the value of the objective function of a local
minimum with the number of features present in it".

Translating this into code, it'll mean we also have to update the actual cost
also every time we make a move. Therefore, when we're stuck at a local minima,
we update lambda as follows:

```python
num_features = sum(feature_indicators)
lambda_ = alpha * (cost / num_features)
```

Now we just have to determine what alpha should be set to :) - after all, to
quote Butler Lampson, "all problems in computer science can be solved by another
level of indirection".

## Evaluation & Results

For my particular problem, after a 100 iterations and with lambda set statically
to 27.5, I get a solution whose overall cost is 3,271,169.00. This isn't too bad
considering that the optimal solution has a cost of 3,269,821.32. With a 100
iterations, I get stuck in a local minima once which I then escape. With a 1000
iterations, I escape local minimas 432 times even though I don't get much
improvement cost-wise - in fact, the solution gets slightly worse at
3,273,110.93 which means that as penalties accrue, the augmented cost seems to
direct the search space elsewhere even though the actual cost increases a bit.
I've mentioned a couple of methods for speeding up Guided Local Search. There's
one additional way to speed it up - rewrite it in everyone's favorite language -
Rust which's what I'm currently doing :D

## References

1. Local Search - Prof. Jimmy Lee and Prof. Peter Stuckey - Solving Algorithms
   for Discrete Optimization:
   [Lecture](https://www.coursera.org/learn/solving-algorithms-discrete-optimization/lecture/1YLYy/3-4-1-local-search)
2. Guided Local Search - Alsheddy, Voudouris, Tsang & Alhindi - Handbook of
   Heuristics:
   [link](https://link.springer.com/referenceworkentry/10.1007/978-3-319-07153-4_2-1)
