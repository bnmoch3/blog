+++
title = "Layout Fixture: Footnotes, TOC and Code"
date = "2025-11-01"
summary = "Throwaway draft used to exercise the theme: long TOC, many footnotes, code in several languages."
tags = ["Misc", "PostgreSQL", "Golang"]
type = "post"
toc = true
tocDepth = 3
readTime = true
autonumber = true
showTags = true
slug = "layout-fixture"
draft = true
+++

This post exists only to stress the layout. It is a draft and never published.
It has a long table of contents, a dozen footnotes (some clustered so that
their margin notes would collide)[^1], and code blocks in many languages.

## Footnote-heavy section

Margin notes should sit beside the paragraph that references them. When two
references are close together[^2], the second note must be pushed down rather
than overlap the first[^3]. A third note in the same sentence makes the
collision worse[^4], and the standard footnote list must remain as the
fallback on narrow screens.

Here is a longer paragraph so that the notes spread out vertically. Lorem ipsum
dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
ut labore et dolore magna aliqua[^5]. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
nulla pariatur.

### A subsection with a long note

Notes can be long, containing multiple sentences and even `inline code`[^6].
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
deserunt mollit anim id est laborum.

#### A fourth-level heading

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
doloremque laudantium[^7], totam rem aperiam, eaque ipsa quae ab illo inventore
veritatis et quasi architecto beatae vitae dicta sunt explicabo.

#### Another fourth-level heading

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit[^8].

### Second subsection

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet[^9].

## SQL

```sql
-- a deliberately wide line to force horizontal scrolling in the code block, because long lines are the norm in real SQL
SELECT u.id, u.email, count(o.id) AS order_count, sum(o.total_cents) / 100.0 AS lifetime_value
FROM users AS u
LEFT JOIN orders AS o ON o.user_id = u.id AND o.status = 'paid'
WHERE u.created_at >= now() - interval '90 days'
GROUP BY u.id, u.email
HAVING count(o.id) > 3
ORDER BY lifetime_value DESC
LIMIT 20;
```

### Row-level security

```sql
alter table invoices enable row level security;

create policy tenant_isolation on invoices
    using (tenant_id = current_setting('app.tenant_id')::uuid);
```

## Python

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def dist(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5


if __name__ == "__main__":
    print(Point(0, 0).dist(Point(3, 4)))  # 5.0
```

## Go

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	results := make(chan int, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			results <- n * n
		}(i)
	}
	wg.Wait()
	close(results)
	for r := range results {
		fmt.Println(r)
	}
}
```

## Rust

```rust
use std::collections::HashMap;

fn word_count(text: &str) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}
```

## Shell and config

```bash
#!/usr/bin/env bash
set -euo pipefail
hugo --minify -d "$(mktemp -d)" && echo "build ok"
```

```json
{ "name": "fixture", "version": "1.0.0", "tags": ["a", "b"], "nested": { "ok": true, "n": 42 } }
```

```javascript
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, n = 3) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { await sleep(2 ** i * 100); }
  }
  throw new Error("exhausted retries");
}
```

A fenced block with no language:

```
plain text block
with no language label
```

## Math

```math
\displaystyle \sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

## Closing section

Some trailing text with the last few notes[^10]. A closing paragraph carries
two more references[^11] side by side[^12], then the page ends.

## Another top-level heading with a deliberately long title that wraps in the sidebar table of contents

Filler paragraph so the last heading has content to scroll to. Lorem ipsum
dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

[^1]: A short note.
[^2]: Another short note, referenced right next to the first.
[^3]: A third note that must not overlap the second one, even though its reference sits on the same line as the others.
[^4]: Four notes within a few lines. The marginal layout has to stack them with a small gap and keep each one next to, or just below, its reference.
[^5]: This note is deliberately long. It runs several sentences so that its height exceeds the vertical distance to the next reference, which forces the next note to be pushed down. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.
[^6]: A note containing `inline code` and a [link](https://example.com).
[^7]: Note seven.
[^8]: Note eight, near the end of the fourth-level section.
[^9]: Note nine.
[^10]: Note ten.
[^11]: Note eleven.
[^12]: Note twelve, adjacent to eleven.
