---
layout: post
title:  "Malloc excess bytes"
slug: malloc-excess
date:   2022-09-15 12:00:00 +0000
tag: ["C"]
categories: Misc
excerpt_separator: <!--start-->
---

Space requested from malloc is a lower bound (at least or more)

<!--start-->

`malloc` is used to allocate space in C. If successful (for sizes greater
than 0) it is required to return a non-null pointer that can hold objects of the
given size. Due to constraints such as alignment, `malloc` might return more
bytes than were requested even though it's expected that only the requested
bytes will be used. To inspect excess bytes allocated, if any, we use
`malloc_usable_size`.

## Viz

I wrote a small program to track excess bytes for the first `malloc` made,
across different sizes. Here are a couple of graphs to visualize the "excess
bytes".

From afar, it seems there aren't any 'excess' bytes allocated:

![all](/assets/images/malloc_excess/fig_all.png)

However, on zooming in, the difference is observable:

![zoomed](/assets/images/malloc_excess/fig_zoomed.png)

## Code

For reference, here's the program

```c
#include <errno.h>
#include <malloc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_BYTES 1073741824

int main(int argc, char *argv[]) {
    // get n
    if (argc != 2) {
        fprintf(stderr, "invalid number of arguments: %d\n", argc - 1);
        exit(EXIT_FAILURE);
    }
    char *err_addr = NULL;
    long int n = strtol(argv[1], &err_addr, 10);
    if (err_addr == argv[1] || n < 1 || n > MAX_BYTES) {
        fprintf(stderr, "invalid num: '%s'\n", argv[1]);
        exit(EXIT_FAILURE);
    }
    // alloc n
    size_t req_size = (size_t)n;
    void *p = malloc(req_size);
    if (!p) {
        fprintf(stderr, "malloc %ld\n", req_size);
        exit(EXIT_FAILURE);
    }
    size_t actual_size = malloc_usable_size(p);
    printf("%ld,%ld\n", req_size, actual_size);
    free(p);
    return 0;
}
```

Then its invoked using bash:

```bash
max=11588990 # Upto 11 MB
for ((i = 1; i <= $max; i++)); do
	./a.out $i >>results
done
```

The whole process could be made faster via parallelization and even some
micro-stuff like removing the `free` at the end but this works for now.
