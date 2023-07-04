# Backblaze data

- before unzipping, the data is 782 MB
- after unzipping, it's 7.1 GB

```
> du -sh data_Q1_2023.zip
782M    data_Q1_2023.zip

> du -sh data_Q1_2023/
7.1G    data_Q1_2023/
```

The dataset consists of a single file per day for January, February and March:

```
> ls -l data_Q1_2023/ | less
2023-01-01.csv
2023-01-02.csv
2023-01-03.csv
...
2023-03-29.csv
2023-03-30.csv
2023-03-31.csv
```

Let's check the header of one of the csv files. `head` outputs the first part of
files, I've limited it to the first line (csv header). Since the columns have
been separated by commas, I've then replaced each occurence of a comma with a
newline using `tr`. Finally, I've pipe it to `bat` since there are many columns
and I want to be able to page through the results (179 using
`head -n1 2023-01-01.csv | tr , '\n' | wc -l` to count).
`[bat](https://github.com/sharkdp/bat)` is a `cat` clone that I prefer since
it's got automatic paging and syntax highlighting (also I'm obligated by the
"Rewrite It In Rust" task force to mention that it is written in Rust).

```
> head -n1 2023-01-01.csv | tr , '\n' | bat

   1   │ date
   2   │ serial_number
   3   │ model
   4   │ capacity_bytes
   5   │ failure
   6   │ smart_1_normalized
   7   │ smart_1_raw
   8   │ smart_2_normalized
   9   │ smart_2_raw
:
```

The file has 235,597 rows:

```
> wc -l 2023-01-03.csv
235559 2023-01-03.csv
```

Let's see the average number of rows per file.

All the lines sum up to X. And since we've got Y files, we end up with an
average of Z lines per file.

```bash
# number of files
> files=$(ls -l | wc -l)
> echo $files
91

# number of lines
> lines=$(find . -name '2023-*.csv' -exec cat {} + | wc -l)
> echo $lines
21455082

# average
> python -c "print($lines/$files)"
235770.13186813187
```

DuckDB does provide the `describe` command that we could use as an alternative
for getting an overview of the csv's schema.

```
> duckdb ':memory:' "describe select * from read_csv_auto('./2023-01-01.csv')"
   1   │ ┌──────────────────────┬─────────────┬─────────┬─────────┬─────────┬─────────┐
   2   │ │     column_name      │ column_type │  null   │   key   │ default │  extra  │
   3   │ │       varchar        │   varchar   │ varchar │ varchar │ varchar │ varchar │
   4   │ ├──────────────────────┼─────────────┼─────────┼─────────┼─────────┼─────────┤
   5   │ │ date                 │ DATE        │ YES     │         │         │         │
   6   │ │ serial_number        │ VARCHAR     │ YES     │         │         │         │
   7   │ │ model                │ VARCHAR     │ YES     │         │         │         │
   8   │ │ capacity_bytes       │ BIGINT      │ YES     │         │         │         │
   9   │ │ failure              │ BIGINT      │ YES     │         │         │         │
  10   │ │ smart_1_normalized   │ BIGINT      │ YES     │         │         │         │
  11   │ │ smart_1_raw          │ BIGINT      │ YES     │         │         │         │
  12   │ │ smart_2_normalized   │ BIGINT      │ YES     │         │         │         │
```

Next, let's get a quick summary for a single CSV using DuckDB's `summarize`.
Since I tend to use this query a lot with CSVs, I've wrapped it into a bash
function:

```bash
#!/usr/bin/bash

function csv_summarize() {
	duckdb ':memory:' <<-EOF
		summarize select *
		from
		read_csv_auto('$1')
	EOF
}
```

Usage:

```
> csv_summarize 2023-01-01.csv
   1   │ ┌──────────────────────┬─────────────┬──────────────────┬───┬────────────────┬────────┬─────────────────┐
   2   │ │     column_name      │ column_type │       min        │ … │      q75       │ count  │ null_percentage │
   3   │ │       varchar        │   varchar   │     varchar      │   │    varchar     │ int64  │     varchar     │
   4   │ ├──────────────────────┼─────────────┼──────────────────┼───┼────────────────┼────────┼─────────────────┤
   5   │ │ date                 │ DATE        │ 2023-01-01       │ … │                │ 235597 │ 0.0%            │
   6   │ │ serial_number        │ VARCHAR     │ 000a43e7dee60010 │ … │                │ 235597 │ 0.0%            │
   7   │ │ model                │ VARCHAR     │ CT250MX500SSD1   │ … │                │ 235597 │ 0.0%            │
   8   │ │ capacity_bytes       │ BIGINT      │ 240057409536     │ … │ 14000519643136 │ 235597 │ 0.0%            │
   9   │ │ failure              │ BIGINT      │ 0                │ … │ 0              │ 235597 │ 0.0%            │
  10   │ │ smart_1_normalized   │ BIGINT      │ 43               │ … │ 100            │ 235597 │ 0.21%           │
  11   │ │ smart_1_raw          │ BIGINT      │ 0                │ … │ 115853954      │ 235597 │ 0.21%           │
  12   │ │ smart_2_normalized   │ BIGINT      │ 70               │ … │ 134            │ 235597 │ 48.67%          │
```
