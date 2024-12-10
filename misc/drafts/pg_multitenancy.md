# 1. Designing Your Postgres Database for Multi-Tenancy

## Intro

Case scenario, you're handling multple customers and you need to figure out how
you'll handle all their data. So now you've got to choose and implement a
_tenancy model_ i.e. models on how each customer's data and operations will be
kept separate. This post will be going over various tenancy models with regards
to PostgreSQL, factors to consider, pros and cons.

As an aside, if you've ever wondered why we use the term 'tenancy model' instead
of something else, like 'isolation model', then here's a tidbit from one of
[Microsoft's dev article's](TODO, 2):

> In the Software as a Service (SaaS) model, your company doesn't sell licenses
> to your software. Instead, each customer makes rent payments to your company,
> making each customer a tenant of your company. In return for paying rent, each
> tenant receives access to your SaaS application components, and has its data
> stored in the SaaS system

There are three primary multi-tenancy modeling approaches in PostgreSQL:

1. **Separate Database per Customer**
2. **Shared Database, Separate Schema per Customer**
3. **Shared Database, Shared Schema across all customers**

Each model has various trade-offs. Therefore, when choosing one, we have to keep
the following factors in mind:

- **Scalability**: as we anticipate growth in customers, the model we choose
  should not be a limiting factor in the overall system.
- **Data Privacy & Isolation**: customers expect that no one else that isn't
  authorized should be able to access their data, the model we opt for might
  make data isolation easier or more involved.
- **Performance Isolation**: one customer's workload should not affect the
  expected performance of other customers (see the
  [Noisy Neighbor Problem](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/noisy-neighbor.html))
- **Operational Complexity**: there will be schema migrations, monitoring needs,
  debugging escapades, backups, recovery and so on that we have to account for
- **Cost Efficiency**: running a database costs money and resources, we should
  aim to keep costs as low as possible
- **Compliance**: there probably will be regulations concerning data residency
  and security that we have to adhere to
- **Customizability**: certain customers might want specific features, if we
  can't or won't say no, then the model should enable us to cater to them

Now, on to the models:

## Separate Database per Customer

With this model, we provision a separate database instance for each customer
that signs up. It is costly but has some merits:

- Maximum performance isolation.
- Maximum data isolation. This also simplifies development, partiuclarly our
  OLTP queries since once we've connected to a customer's database, we don't
  have to include extra logic to ensure we're not leaking any customer
  information.
- Geographical and Compliance Flexibility: it's easy to situate the database
  right where the customer is
- Customization Flexibility per customer

As for the demerits:

- Scalability: depending on the tooling (or lack thereof) used to manage _all_
  the databases, every new customer adds more burden to our system
- Operational Overhead: imagine having to upgrading or even carrying out schema
  migrations across _all_ the databases in a consistent manner
- Costs: resource utilization will be less efficient, some customers' workloads
  will be too small to justify having an entire database instance provisioned
  just for them.
- Limited Cross-customer operations: we'll have to run some queries across all
  the customers. If they each have separate DB instances, it's still doable
  though quite cumbersome

The one instance of database per customer I came across being done at massive
scale was iirc Apple maintaining an sqlite database per user for some service.
Which ought to work quite well since sqlite is quite lightweight.

But that's sqlite, if we're going with Postgres we'll need an entirely different
approach. That's where [Neon Database](https://neon.tech/) comes in. They've
built a platform for _serverless_ Postgres instances whereby compute is
separated from storage and compute can be scaled independently of storage and
vice versa. This solves the _resource utilization_ problem since small-scale
customers can consume resources proportionate to their usage. As for the other
challenges, they've proposed and developed tooling for building _control planes_
to manage multiple databases. For more information, check out the following
articles from Neon:

- [Database Per User at Scale - Neon](https://neon.tech/use-cases/database-per-tenant)
- [Multi-tenancy and Database-per-User Design in Postgres - Dian M Fay - Neon](https://neon.tech/blog/multi-tenancy-and-database-per-user-design-in-postgres)
- [Control Planes for Database-Per-User in Neon - Dian M Fay - Neon](https://neon.tech/blog/control-planes-for-database-per-user-in-neon)

There is also [atlas](https://atlasgo.io/) - open source tooling for managing
your DB schema as code. They have a section on their docs where they go over
using Atlas
[Database-per-Tenant Architectures](https://atlasgo.io/guides/database-per-tenant/intro).

## Shared Database, Separate Schema per Customer

Schemas mean two separate things as far as Postgres goes: (1) namespacing for
database objects such as tables and indexes (2) DDL: all the design and SQL we
invoke to define the actual tables and relationships across tables. This post is
concerned with the first meaning and usage. Therefore, if we're opting for this
tenancy model, it means we've got one database server, and for each customer we
take in, we will create a separate schema for them.

In this blog post,
[Multi-Tenancy Options](https://bmulholland.ca/for-developers/multi-tenancy-options/),
the author does a better job than I would summarizing all the key advantages of
this approach:

> it is a good option for many use cases as it provides a good mix of data
> isolation, cross-container query capability, application schema
> customizability, shared administration, and shared resource usage. This option
> is well-suited for a moderate number of tenants with a moderate set of tables
> in each application schema. Serving the middle ground, this option is often
> chosen as a starting point when requirements and long-term needs do not
> clearly point to using one of the other options.

I would still be cautious of opting for schema-based isolation as a starting
point. Why:

- No performance isolation across customers
- Limited data isolation since it's logical rather than physical
- Postgres' performance starts degrading (catalog bloat, cache inneficiency)
  once you have 100s of tables across 1000s or even 100,000s schemas
- We still have some degree of operational complexity since each schema has to
  be managed separately

For more details on this approach, check out:

- [Multitenancy with Postgres schemas: key concepts explained - Tomasz Wróbel](https://blog.arkency.com/multitenancy-with-postgres-schemas-key-concepts-explained/)
- ['Our Multi-tenancy Journey with Postgres Schemas and
  Apartment' - Brad Robertson](https://medium.com/infinite-monkeys/our-multi-tenancy-journey-with-postgres-schemas-and-apartment-6ecda151a21f)

Also if you opt for this approach, the
[pg-clone-schema](https://github.com/denishpatel/pg-clone-schema) tool might
come in handy if you've got a template schema and want to create a new customer
schema for each customer you sign up based on that template.

## Shared Database, Shared Schema with Tenant Discriminators

With this approach, we start off with one database and one schema. Rows from
different customers commingle which means every table has to have an additional
`customer_id` or `tenant_id` column for isolation/filtering (i.e. tenant
discriminators). Also, we have to make sure every query filters on the customer
ID. This is the approach I'd probably start with for a new product.

It's got its advantages:

- Operations and Maintainance are simplified, we've got one database and one
  main schema to manage
- It is resource efficient.
- Cross-customer operations are relatively trivial

And its disadvantages:

- Every customer has to be on the same schema, there's no room for some bespoke
  customization that your sales team might assure to a lead. On the other hand,
  if we make a customization for one customer, it also benefits all the other
  customers.
- Invasiveness: every query has to filter on customer ID
- We'll need lots and lots of testing to ensure none of our codepaths leak
  customer data. To be fair, we still do need testing with the other models - no
  approach offers 100% prevention of data breaches out of the box
- There's no performance isolation, we'll have to implement some other means
  atop the data-access layer to ensure fairness, e.g rate limiting or sharding
  by customer ID across a distributed setup

There are two customer filtering approaches:

- Explicit
- Implicit (using [Row])

## Further Reading

If you're interested in exploring multi-tenacy further, here are some articles I
found quite useful:

- [Designing Your Postgres Database for Multi-tenancy - Craig Kerstiens](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy)
- [Multitenant SaaS database tenancy patterns - Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns?view=azuresql)
- [Thread: Multi tenancy: schema vs databases - Postgres Mailing List](https://postgrespro.com/list/thread-id/2196817)
- [Multitenant Database Designs Strategies — with PostgreSQL - Satish Mishra](https://techtonics.medium.com/multitenant-database-designs-strategies-with-postgresql-55a9e3ec882c)
