# Backblaze data

- before unzipping, the data is 782 MB
- after unzipping, it's 7.1 GB

```
> du -sh data_Q1_2023.zip
782M    data_Q1_2023.zip

> du -sh data_Q1_2023/
7.1G    data_Q1_2023/
```

## Some Basic CLI CSV Inspection

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

All the lines sum up to 21,455,082. And since we've got 91 files, we end up with
an average of 235,770 lines per file (Obviously I should discount the headers).

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

Right off the bat, a couple of details worth noting:

- `serial_number` and `model` are all strings
- `failure` seems to be a boolean(0,1)
- hmm, what does a -1 `capacity_bytes` mean?
- a lot of the `smart_*` columns are null (hence duckDB defaults to assigning
  them the data-type VARCHAR). However, when they have values, those are
  numerical and seem to be within the 0 - 200 range

It's probably worth heading back to Backblaze's info sections to get more
details on the data + schema. Here's what I got:

- the date is in the yyyy-mm-dd format, goes without saying at this point
- the serial number and model are assigned by the manufacturer.
- capacity is in bytes
- Once a drive is marked as failed (with "1"), its data is not logged anymore. A
  drive is considered 'failed' if it has totally stopped working or it's show
  evidence of failing soon [3].
- the `smart_*` columns are stats that each drive reports.

## More on SMART columns

- From the Backblaze blog post [1], "SMART stands for Self-Monitoring, Analysis,
  and Reporting Technology and is a monitoring system included in hard drives
  that reports on various attributes of the state of a given drive."
- SMART metrics are used to predict drive failures They are inconsistent from
  hard drive to hard drive, across different vendors and versions [3].
- Initially, Backblaze collected only subset of the SMART metrics daily but
  since 2014, they've been collecting all of them daily [3].
- Each SMART stat stands for some attribute. For example, Smart 1 is the "Read
  Error Rate" and Smart 193 is the "Load/Unload Cycle Count". For the full list
  of what each value means, check the
  [SMART Wikipedia entry](https://en.wikipedia.org/wiki/Self-Monitoring,_Analysis_and_Reporting_Technology)
- Backblaze engineers narrow in on the following SMART values:
  - Reallocated Sectors Count (SMART 5): From wikipedia: "Count of reallocated
    sectors. The raw value represents a count of the bad sectors that have been
    found and remapped... a drive which has had any reallocations at all is
    significantly more likely to fail in the immediate months". Raw values seem
    to range from 0 to 70,000, normalized values seem to range from 0 to 202?
  - Reported Uncorrectable Errors (SMART 187): reads that could not be corrected
    using hardware ECC. Related? to SMART 195 (Hardware ECC Recovered) though
    SMART 195 is reported inconsistently across vendors and may increase even
    though no error has occured [4]. Raw values seem to range from 0 to 120,
    mormalized values range from 0 to 104. Any drive with a value above zero is
    scheduled for replacement. Most drives through out their lifetime report
    zero. The stat is reported consistently across different manufacturers [3]
  - Command Timeout (SMART 188): From wikipedia: "The count of aborted
    operations due to HDD timeout. Normally this attribute value should be equal
    to zero". Raw values range from 0G to 104G (Not quite sure what the G unit
    means). Normalized to 100? (Does this mean any value greater than zero is
    normalized to 100, I'm not quite sure)
  - Current Pending Sector Count (SMART 197): From wikipedia: "Count of
    "unstable" sectors (waiting to be remapped because of unrecoverable read
    errors). If an unstable sector is subsequently read successfully, the sector
    is remapped and this value is decreased". The Wikipedia entry has more
    details. Raw values range from 0 to 1600. Normalized to 90-400?
  - Uncorrectable Sector Count (SMART 198): From Wikipedia: "The total count of
    uncorrectable errors when reading/writinga sector. A rise in the value of
    this attribute indicates defects of the disk surface and/or problems in the
    mechanical subsystem". Raw values range from 0 to 16, normalized from 90
    to 400.
  - Power Cycle Count (SMART 12) - number of times the power was turned off and
    turned back on - Correlates with failure but Backblaze does not use it since
    it might not be the case that cycling the power directly causes failure;
    power cycles occur infrequently. Maybe it's the pod? or ""new" drives have
    flaws that are exposed during the first few dozen power cycles and then
    things settle down" [3]. There's the raw value (ranges from 0 up to 91 with
    most drives having a value of less than 26), and the normalized value (in
    which 1 - worst, up to 253 - best). The normalized value is not usefule [3].
  - Read Error rate (SMART 1): From wikipedia: "The raw value has different
    structure for different vendors and is often not meaningful as a decimal
    number". Zero indicates drive is ok, any value large than zero indicates
    there might be a failure but the larger the value doesn't mean failure is
    more probable.
- However they only use the first 5 (5,187,188,197 and 198) to check for
  failure: whenever any of these is greater than zero, a drive is examined and
  in combination with other factors, its determined whether the drive has/is
  going to fail or not. More details in [1].
- Except for SMART 197, all other SMART stats tracked are cumulative

## References/Further Reading

1. [What SMART Stats Tell Us About Hard Drives - Andy Klein - Backblaze](https://www.backblaze.com/blog/what-smart-stats-indicate-hard-drive-failures/)
2. [The Shocking Truth — Managing for Hard Drive Failure and Data Corruption - Skip Levens - Backblaze](https://www.backblaze.com/blog/managing-for-hard-drive-failures-data-corruption/)
3. [Hard Drive SMART Stats - Brian Beach - Backblaze](https://www.backblaze.com/blog/hard-drive-smart-stats/)
4. [Self-Monitoring, Analysis and Reporting Technology - Wikipedia](https://en.wikipedia.org/wiki/Self-Monitoring,_Analysis_and_Reporting_Technology)
5. [List of SMART stats - Backblaze](https://www.backblaze.com/blog-smart-stats-2014-8.html#S198R)
6. [Overview of the Hard Drive Data](https://www.backblaze.com/b2/hard-drive-test-data.html#overview-of-the-hard-drive-data),
