# Lateral joins

Let's use a rather contrived example to introduce lateral joins. Suppose we're
running a site for listing travel spots. Users submit the cities they want to
travel to. The site then provides the top 3 recommended sites based on the
ratings. Once more, this is entirely contrived and for the sake of
demonstration:

```sql
begin;

create table tour_sites(
    city text,
    site text,
    rating numeric
);

insert into tour_sites values
    ('London'  ,'Buckingham Palace' ,8.5),
    ('London'  ,'The London Eye'    ,9  ),
    ('London'  ,'Tower of London'   ,8.1),
    ('Paris'   ,'Eiffel Tower'      ,7.1),
    ('Paris'   ,'Les Catacombes'    ,8.7),
    ('Paris'   ,'Arc de Triomphe'   ,8.8),
    ('Berlin'  ,'Brandenburg Gate'  ,9.2),
    ('Berlin'  ,'Berlin Wall'       ,8.6),
    ('Berlin'  ,'Victory Column'    ,8.3);

commit;
```

In version 1 of the service, we're used a client-side for loop to build up the
results. Not quite efficient, but hey, it gets the job done:

```python
user_selections = ["London", "Paris"]
recommendations = []
with conn.cursor() as cur:
    for city in user_selections:
        cur.execute(
            """
        select city, site, rating
        from tour_sites
        where city=%s
            and rating >= 8.5
        """,
            (city,),
        )
        recommendations.extend(cur.fetchall())
for rec in recommendations:
    print(rec)
```

Now let's use lateral joins to fetch everything with a single query:
