+++
title = "Minizinc: Alternative Modeling Approaches for the Facility Location Problem"
date = "2024-03-11"
summary = "Multiple views and Channeling Constraints make for faster models (in some cases)"
tags = ["Discrete Optimization"]
type = "post"
toc = false
readTime = true
autonumber = false
showTags = false
slug = "facility-location-problem-p2"
+++

This post picks up from where I left off in my previous post:
[The Facility Location Problem](https://bnm3k.github.io/blog/facility-location-problem).
In the previous post, I gave an introduction to the problem then demonstrated
how it can be modeled using [PuLP](https://coin-or.github.io/pulp/). In the last
section, I ported the model one-to-one into
[Minizinc](https://www.minizinc.org/) which offers a more declarative approach
to modeling for discrete optimization. The great thing about Minizinc is that
it's much richer with regards to the different ways you can model a problem.

## Parameters

Let's start with the parameters; these won't change much but the largest
difference from last time is that all the distances and facility costs are
`int`s:

```Minizinc
int: num_facilities;
set of int: facility =  1..num_facilities;
array[1..num_facilities] of int: facility_setup_costs;
array[1..num_facilities] of int: facility_capacities;

int: num_customers;
set of int: customer = 1..num_customers;
array[customer] of int: customer_demands;

array[facility,customer] of int: dist_matrix;
```

## Indicator Vars approach

To recap, in the previous approach, the decision variables were as follows:

```Minizinc
array[1..num_facilities,1..num_customers] of var 0..1: allocations;
array[1..num_facilities] of var 0..1: facilities_built;
```

`allocations` is a 2-D array whereby each entry is indexed by the `facility` and
`customer` index. The value of an entry is 1 if a customer is assigned to the
given facility and 0 otherwise. This definition is suitable for MILP solvers.

On the other hand, the f-th entry in `facilities_built` indicates whether the
facility should be built (is assigned 1 or more customers) or not built (is not
assigned any customer). This array is useful to simplify calculation of the
setup costs of all the facilities

We had the following constraints:

- a customer should be assigned to one and only one facility
- a customer should not be assigned to a facility that does not get built
- given the customers assigned to a facility, the sum of all their demands
  should be less than or equal to the facility's capacity

Given our choice of decision variables, these constraints are defined as
follows:

```
% customer assigned to no more and no less than 1 facility
constraint forall(c in 1..num_customers)
    (sum(f in 1..num_facilities)(allocations[f,c]) == 1);

% customer should not be assigned to a facility that does not get built
constraint forall(f in 1..num_facilities,c in 1..num_customers)
    (allocations[f,c] <= facilities_built[f]);

% facility capacity meets assigned customer demands
constraint forall(f in 1..num_facilities)
    (sum(c in 1..num_customers)(allocations[f,c]*customer_demands[c])
        <= (facility_capacities[f]*facilities_built[f]));
```

## Injective Function Approach: Mapping Customer to Facility assigned

Alternatively, rather than keep a 2D array of indicator variables, we could
maintain a 1-dimensional array that's indexed by the set of customers and each
entry is the facility that the customer will be assigned to:

```Minizinc
array[1..num_customers] of var 1..num_customers: c_to_f_assn;
```

With this approach, we don't have to add the two constraints that ensure each
customer is assigned exactly one facility - the definition of `c_to_f_assn`
particularly its co-domain of `var 1..num_customers` guarantee this constraint
trivially.

However, for the customer demands - facility constraints and calculation of the
cost, we need to introduce an additional variable `facilities_built` so to track
the facilities that end up getting built:

```
var set of 1..num_facilities: facilities_built = array2set(c_to_f_assn);

% constraints
constraint forall(f in facilities_built)
    (sum(c in 1..num_customers where c_to_f_assn[c] = f)(customer_demands[c])
    <= facility_capacities[f]);

% obj
var int: cost =
    sum(f in facilities_built)(facility_setup_costs[f])
    +
    sum(c in 1..num_customers)(dist_matrix[c_to_f_assn[c],c]);
```

With this approach, we've got fewer constraints though it ends up performing
quite poorly.

## Set approach: Facility to set of Customers Assignment

Here's yet another way of defining the decision variables: have the facility IDs
map to the set of assigned customers:

```Minizinc
array[facility] of var set of customer: f_to_c_assn;
constraint all_disjoint(f_to_c_assn);
constraint forall(c in customer)(exists(cs in f_to_c_assn)(c in cs));
```

Both constraints above ensure that a customer is assigned to exactly one
facility. `all_disjoint` is a global constraint that minizinc provides whereby
no two sets intersect. To make it concrete, if customer 30 was assigned to
facility 3 and facility 5, then the intersection
`f_to_c_assn[3] intersect f_to_c_assn[5]` would contain customer 30 and this
would violate the constraint. The second constraint ensures that every customer
is assigned to at least one facility since the first constraint evaluates to
true in the case where some customers or even all don't get assigned to any
facility.

For the customer demands - facility capacity constraints, we've got the
following:

```
constraint forall(f in facility)(
    sum(c in f_to_c_assn[f])(customer_demands[c])
        <= facility_capacities[f]);
```

Finally, to calculate the cost and minimize it:

```
var int: cost = sum(f in facility)
    (((card(f_to_c_assn[f]) > 0) * facility_setup_costs[f])
    + sum(c in f_to_c_assn[f])(dist_matrix[f,c])
    );

solve minimize cost;
```

`card` returns the cardinality of a set and if a set has cardinality greater
than 0, we include its setup costs in the summation. Note that
`card(f_to_c_assn[f]) > 0` evaluates to bool which is then coerced to 0 if false
and to 1 if true.

This formulation is particularly suitable for Constraint Solvers.

## Multiple models and Channeling Constraints

We can combine the two previous approaches above too. We'll maintain two
different views of the assignment:

- `f_to_c_assn`: map facility to set of customers assigned
- `c_to_f_assn`: map customer to the facility they're assigned to

```Minizinc
array[facility] of var set of customer: f_to_c_assn;
array[customer] of facility: c_to_f_assn;
```

So as to make sure both are in sync, we add a channeling constraint:

```Minizinc
constraint int_set_channel(c_to_f_assn, f_to_c_assn);
```

From the
[docs](https://www.minizinc.org/doc-2.6.3/en/lib-globals-channeling.html),
`int_set_channel` requires that facility _f_ is assigned to customer _c_ in the
array `c_to_f_assn` if and only if _c_ is i the set of `f_to_c_assn[f]`.

`c_to_f_assn` trivially guarantees that every customer is assigned to exactly
one facility.

We still need to add the customer demands - facility capacity constraints though
this time we don't need to create any helper variables to track which facilities
are built:

```Minizinc
% facilities' assigned demands are less than or equal to their respective
% capacities
constraint forall(f in 1..num_facilities)(
    (sum(c in f_to_c_assn[f])(customer_demands[c]))
        <= facility_capacities[f]);
```

Finally, for calculating the cost:

```
var int: cost = 
    sum(f in facility)((card(f_to_c_assn[f]) > 0) * facility_setup_costs[f])
    + sum(c in customer)(dist_matrix[c_to_f_assn[c],c]);

solve minimize cost;
```

While having two views of the same problem might seem superfluous, this approach
ends up being faster than the single view of facility to set of customers when
using constraint solvers. However, it's not as fast as the indicator vars
approach which is quite suitable for LP solvers. I'd love to have made some
graphs for visualization but for now I'll post the raw values:

With 50 customers and 25 facilities, I get:

- Indicator vars (cbc): 157.6 ms ± 3.6 ms
- Multiple views (cpsatlp): 490.6 ms ± 28.3 ms
- Pure set approach (cpsatlp): 1.196 s ± 0.050 s

With 200 customers and 50 facilities, I get

- Indicator vars (cbc): 1.172 s ± 0.017 s
- Multiple views (cpsatlp): 6.835 s ± 0.151 s
- Pure set approach (cpsatlp): 19.131 s ± 0.113 s

There's definitely other approaches for tackling this problem. If you've got any
that I should consider please reach out :)