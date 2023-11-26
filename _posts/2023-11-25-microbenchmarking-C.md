---
layout: post
title:  "Microbenchmarking: Way more than I set out to know"
slug: microbenchmarking-c
tag: ["C", "systems development", "low-level programming"]
categories: Misc
excerpt_separator: <!--start-->
---

RDTSC, Out-of-order execution, OS interrupts, cycles, frequency and more.

<!--start-->

## Intro

Benchmarking in systems programming is quite a different beast from what I'm
used to. My past experience has been with higher level language tooling where I
could get away with ballpark figures for some quick comparison.

In C & low-level programming though, all of a sudden there's talk of accuracy,
clock precision, kinds of clocks, granularity of the benchmark, cycles spent,
statistical rigor and a whole other bunch of stuff I've never really put that
much thought into. What's more, there's as much concern for the _why_ as there
is for the _how_, if not more: is the benchmark even useful, what's its goal, am
I making the correct comparisons, what would the results portend for the overall
system and so on. It's quite easy to end up getting hyperfixated on some piece
of code that doesn't even contribute much to overall runtime or instead
increases performance at the expense of some other critical resource.

To be fair, the same kind of attention ought to and does carry over to
higher-level development, it just so happens that there's more material and
practitioners concerned with the finer details of benchmarking in systems
programming. Lower level components don't change as much so a lot of the
development effort and expertise tends towards debugging and improving
performance - hence the over-representation.

So this post details (in a mostly informal manner) all the stuff I picked up
while trying to figure out how to carry out microbenchmarks in C (Linux, Intel
x86-64).

## Measuring clock cycles

Let's start with measuring cycles - the basic unit of time in a processor within
which some chunk of work is carried out. Intel (64 & IA-32) provides the RDTSC
"read timestamp counter" instruction for reading the timestamp counter that's
incremented every cycle. From Intel's manual [1], RDTSC is described as follows:

> Reads the current value of the processor’s time-stamp counter (a 64-bit MSR)
> into the EDX:EAX registers. The EDX register is loaded with the high-order 32
> bits of the MSR and the EAX register is loaded with the low-order 32 bits.

As an aside, MSR stands for
[Model specific register](https://en.wikipedia.org/wiki/Model-specific_register) -
control registers within the CPU for debugging/monitoring/performance stuff.

There are two ways to read the timestamp value: via the `__rdtsc()` gcc compiler
intrinsic, or by writing some inlined assembly as shown below [5]. Using inlined
assembly has to be done carefully since the RDTSC instruction overwrites the EAX
and EDX registers - you don't want to end up with a segmentation fault, or
worse.

```c
#include <stdint.h>

uint64_t inline rdtsc() {
    uint32_t int lo, hi;
    __asm__ __volatile__("rdtsc" : "=a"(lo), "=d"(hi));
    return ((uint64_t)hi << 32) | lo;
}
```

As a working example, let's benchmark a simple add function using RDTSC:

```c
void sum(int* nums, size_t n, int* res) {
    int s = 0;
    for (size_t i = 0; i < n; i++) {
        s += nums[i];
    }
    *res = s;
}
```

To get the number of cycles a piece of code takes, we read the counter at the
start of the benchmark, then at the end:

```c
int main() {
    // ...

    // benchmark
    uint64_t start = rdtsc();
    sum(nums, n, &res);
    uint64_t end = rdtsc();

    printf("res=%d, cycles taken: %lu\n", res, (end - start));
    return 0;
}
```

On my first run summing up 10,000 values, I get 13,380 cycles taken - great.

Running once more, I get 42,392 - not so great.

A couple more times I get: 37,592, 37,118, 42,028, 19,780, 42,196 - seems that
even though the values keep on wobbling with each run, there's a typical result.

Next step then is to comb around for how other folks address this noise
(variability in time taken) when benchmarking. Given it's referenced a lot, my
first go-to was Intel's guide on benchmarking, penned by Gabriele Paoloni [2].

Right at the start, the Paoloni points out two sources of noise when using
RDTSC:

- out of order execution
- interrupts & preemption

Let's start with the former:

## Out of order execution

Modern Intel CPU carry out out-of-order execution for instructions. From Agner
Fog's Software Optimization Resources [6], out-of-order execution is described
as:

> ... if the execution of a particular instruction is delayed because the input
> data for the instruction are not available yet, then the microprocessor will
> try to find later instructions that it can do first, if the input data for the
> later instructions are ready. Obviously, the microprocessor has to check if
> the later instructions need the outputs from the earlier instruction.

Since the RDTSC instruction does not rely on earlier nor on later instructions,
it can be executed entirely out-of-order way before or after the benchmark has
started/ended. Therefore, we cannot assume the measured count necessarily
represents the 'actual' duration of the benchmark.

The Paoloni guide offers a solution - place a serializing instruction before
RDTSC. Such instructions ensure that the CPU has completed all preceding
instructions before continuing: "all modifications to flags, registers, and
memory by previous instructions are completed, draining all buffered writes to
memory" [8]. The serializing instruction used is CPUID which is used to retrieve
processor identification and feature information [1]. Thus, we end up with the
following pseudocode:

```
Warm up instruction cache

loop N times:
    CPUID
    RDTSC - for start
    call benchmarked function
    CPUID 
    RDTSC - for end
    Record cycles (end - start)
```

However, the CPUID instruction takes time to execute (100-250 cycles for my CPU
per Agner Fog's instruction tables), and even then, the first instance might
take longer than subsequent instances. So we have to take into account its
overhead plus high variance.

The guide then offers a better approach (in terms of consistency of
measurement): use the RDTSCP instruction. It's similar to RDTSC in that it reads
the counter, but it also reads the CPU identifier. Of note, RDTSCP waits until
all previous instructions have been executed before reading the counter. Here's
the updated benchmarking pseudocode:

```
Warm up instruction cache

loop N times:
    CPUID
    RDTSC - for start
    call benchmarked function
    RDTSCP - for end
    CPUID
```

Notice that in between getting the start and end there's no CPUID call. However,
the CPUID call is placed after RDTSCP since "subsequent instructions may begin
execution before the read operation is performed" [2]. This updated version has
lower variance - loosely speaking: you're more likely to get measurement values
that are closer to each other (provided you've also removed other sources of
noise).

Before proceeding, it's worth giving a quick overview of how the guide arrives
at the 'final' measurement value. Suppose we've removed all sources of noise
(out-of-order execution, interrupts e.t.c). The steps are as follows:

- Loop N times storing the number of cycles taken per a given function/piece of
  code. These are all the samples
- Divide the N samples into M equally sized ensembles in the order they were
  collected. In the code, by default, each ensemble has 100,000 values and there
  are 1000 ensembles collected. Therefore N is 100,000,000. I find this number a
  bit too high but I'm guessing it's the price to pay for accuracy.
- For each ensemble, calculate the variance and the minimum/smallest value.
- If all sources of noise are eliminated, the variance of all the variances
  should be zero, and the variance of minimum values across all the ensembles
  should be zero.
- Therefore, the minimum value across all the ensembles is the final measurement
  value.

From how the measurement value is determined, you can see why the author insists
that the most important characteristic of a benchmarking methodology is that it
should be completely _ergodic_. If you're into statistics and error analysis, I
do recommend going over the entire Paoloni guide - there's a lot more than I
could cover for now plus it contains the entire code listing.

## Using LFENCE instead of CPUID for serializing RDTSC

Separately, Intel's manual[1] does offer its own solution for serializing
RDTSC - using LFENCE and MFENCE:

> - If software requires RDTSC to be executed only after all previous
  > instructions have executed and all previous loads are globally visible, it
  > can execute LFENCE immediately before RDTSC.
> - If software requires RDTSC to be executed only after all previous
  > instructions have executed and all previous loads and stores are globally
  > visible, it can execute the sequence MFENCE;LFENCE immediately before RDTSC.
> - If software requires RDTSC to be executed prior to execution of any
  > subsequent instruction (including any memory accesses), it can execute the
  > sequence LFENCE immediately after RDTSC [1].

Given that the Paoloni guide is from 2010, it seems LFENCE & MFENCE (2-4 cycles)
usage is the more modern approach. Also I might be wrong here, but I don't think
MFENCE is necessary for my case.

Using LFENCE, we end up with the following:

```
Warm up instruction cache

loop N times:
    LFENCE
    RDTSC - for start
    LFENCE

    call benchmarked function

    LFENCE
    RDTSC - for end
    LFENCE

    Record cycles (end - start)
```

Elsewhere, I've read that compiler barriers should be added to prevent the
compiler from reordering stuff. However, in the disassembly for my code so far,
the compiler hasn't done anything mischievous yet to warrant compiler barriers.

## CSAPP benchmarking methodology

An alternative to the Paoloni methodology that I've come across is the
[CSAPP](https://csapp.cs.cmu.edu/3e/code.html) one that Bryant & O'Hallaron use
throughout the code samples for their Computer Systems textbook. It still uses
RDTSC under the hood but differs in the way they pick the representative/typical
measurement value:

The benchmark involves 3 main knobs to configure:

- `max_samples`: the max number of times to repeat the benchmark or rather, the
  max number of samples to collect. By default, it's 500
- `k`: the size of the subset of the samples consisting of the smallest values
  i.e. k-minimum. By default, it's 3
- `epsilon`: for determining whether the measurement values have converged. By
  default, it's 0.05. Therefore, suppose the smallest value is 20 cycles, the
  k-minimum subset can only contain values in the range of `[20,21]`, both
  bounds inclusive. In general, the range of k-minimum is:
  `[min,(1+epsilon)*min]`.

There are other additional knobs like whether to clear the l2 cache before
benchmarking and whether to use a different counter that compensates for timer
interrupt overhead but I didn't look too much into those.

Once the benchmark has converged to a value, the smallest value within the
k-minimum subset is returned as the 'final' value. However, if it runs up to max
samples and it hasn't converged - either there's too much noise, or we need to
tweak the knobs. It might even be case that the function being benchmarked
behaves quite differently given the same input (it's not deterministic).

Overall, CSAPP's benchmarking method is easier to grok and it's more tractable.
However, I do have some pending questions:

- why is the minimum considered the 'final' value, why not something like median
  or mode. The Paoloni guide also picks the minimum.
  ([Answer](https://ocw.mit.edu/courses/6-172-performance-engineering-of-software-systems-fall-2018/resources/lecture-10-measurement-and-timing/):
  compared to the mean or even the median, the minimum does best at noise
  rejection)
- why doesn't it take into account the possibility of out-of-order execution.
  The code is open-source though, so I added serializing instructions to mine
  just in case the processor does its thing.

As an aside, CSAPP does provide the `ovhd` function for getting the counter's
overhead (has to be subtracted from the measurement, though I don't see it
getting used as much in the code samples). There's also the `mhz` function for
determining the clock rate of the processor, which we shall get to when
converting cycles into 'human' time.

## Interrupts & preemption

Back to the Paoloni guide. Other than out-of-order execution, the author also
points out that benchmarks can be tainted by interrupts. The OS can always move
the benchmark to a different core or even preempt it entirely for a sustained
period.

The guide's solution is to write the benchmark as a kernel module and right
within the benchmark section, disable pre-emption and guarantee exclusive
ownership of the CPU core.

I guess I'll have to bite the bullet and learn kernel module programming at some
point so as to use this method though I'm a bit hesitant for now: I don't want
to end up doing something really dumb and breaking my system.

For the time being, a workable solution seems to be some variant of either using
the [`taskset`](https://man7.org/linux/man-pages/man1/taskset.1.html) command to
run the entire benchmark with a given CPU core affinity or to set
process/thread-level CPU affinity directly within the code using the
`sched_setaffinity` function:

```c
#include <sched.h>

void assign_to_core(int core_id) {
    cpu_set_t mask;
    CPU_ZERO(&mask);
    CPU_SET(core_id, &mask);
    sched_setaffinity(1, sizeof(mask), &mask);
}
```

The OS might still preempt the benchmark but at least it'll be pinned to the
same core. It's worth nothing that my specific microbenchmark was
single-threaded.

## Converting cycles to wall time

Cycles are all good, but I can't help but convert them into wall clock time aka
'human' time.

There's the formula:

```
time taken = cycles/frequency
```

So we need to get RDTSC's frequency and plug it above.

Using the cli tool `dmidecode` to retrieve the nominal value, I get 2600 MHz
(2.6 GHz). There are two values, luckily I don't have to disambiguate them since
they're both the same :).

```
$ sudo dmidecode -t processor | grep 'Speed'
    Max Speed: 2600 MHz
    Current Speed: 2600 MHz
```

A different approach is to calculate the _approximate_ frequency of the RDTSC
counter by using a different clock in the system. This involves calculating the
number of RDTSC cycles per a given OS wall clock duration (frequency = time
taken/cycles). CSAPP's `mhz` function does essentially the same thing though it
uses the `sleep` function to do the waiting (an updated version might use
`nanosleep`or `clock_nanosleep` instead).

I used the code sample below to calculate the frequency. It's adopted from
[here](https://github.com/cmuratori/computer_enhance/blob/main/perfaware/part2/listing_0073_cpu_timer_guessfreq_main.cpp).

```c
#include <stdint.h>
#include <stdio.h>
#include <time.h>
#include <x86intrin.h>

static inline uint64_t read_OS_timer_ns(void) {
    struct timespec now;
    clockid_t clock_id = CLOCK_MONOTONIC;
    clock_gettime(clock_id, &now);
    uint64_t now_ns = (now.tv_sec * 1000000000) + now.tv_nsec;
    return now_ns;
}

double get_cpu_frequency_GHz(uint64_t wait_time_milliseconds) {
    uint64_t os_start_ns = 0, os_end_ns = 0, os_elapsed_ns = 0;
    uint64_t os_wait_time_ns = wait_time_milliseconds * 1000000;

    uint64_t cpu_start = __rdtsc();          // read CPU start
    os_start_ns        = read_OS_timer_ns(); // read start OS time

    // wait until wait_time duration is over
    while (os_elapsed_ns < os_wait_time_ns) {
        os_end_ns     = read_OS_timer_ns();
        os_elapsed_ns = os_end_ns - os_start_ns;
    }

    uint64_t cpu_end    = __rdtsc();
    uint64_t cpu_cycles = cpu_end - cpu_start;

    return (double)cpu_cycles / (double)os_elapsed_ns;
}
```

Setting the duration to 100 milliseconds, I got frequencies hovering around
2.5925 GHz. Not quite 2.6 GHz but I'll choke it off to clock precision and
various overheads here and there.

Elsewhere, I've read that one should check the kernel logs to retrieve the
actual RDTSC frequency. Interestingly, using this method, I get 3 different
values when grepping the the `dmesg` kernel logs:

```
$ sudo dmesg | grep '.*tsc.*MHz'
[    0.000000] tsc: Detected 2600.000 MHz processor
[    0.000000] tsc: Detected 2599.992 MHz TSC
[    1.682221] tsc: Refined TSC clocksource calibration: 2592.001 MHz
```

And from the `turbostat` command:

```
$ sudo turbostat --num_iterations 1 --interval 1
TSC: 2592 MHz (24000000 Hz * 216 / 2 / 1000000)
CPUID(0x16): base_mhz: 2600 max_mhz: 5000 bus_mhz: 100
```

There seems to be a base/processor frequency and a TSC frequency and both are
quite close though not quite equal. Anyway, since I was doing the conversion to
wall clock time as a final reporting step, I decided to go with the calculated
approximate value (2.5925).

## Conclusion: Down the Systems Rabbit Hole

The running theme so far has been that without accounting for how some
lower-level component actually works, whether it's the CPU's out-of-order
execution or interrupts caused by the OS, we risk deriving erroneous values.

So far, I've only scratched the surface. To make microbenchmarking measurements
sensible, there's a lot more that we've got to account for:

1. **BIOS Settings** - Paoloni mentions that BIOS settings have to be optimized
   to remove all factors that could cause indeterminism, though he doesn't
   specifier which ones - some could be peculiar to his computer.
2. **Hyperthreading**: CPUs can run two threads on the same physical cores with
   both sharing the same L1 and L2 cache. It's recommended to turn off
   hyperthreading when benchmarking so as to increase reproducibility [2].
3. **CPU Power management**: Core frequencies can be lowered or even paused
   entirely to reduce temperature and power consumption. This should also be
   disabled when benchmarking - for the same reasons [2].
4. **Turbo boost**: Given CPU-intensive workloads - Intel CPUs can increase
   frequency way above the nominal value. Once more, this should be disabled
   when benchmarking [2]. An implication of both this point and the previous one
   is that the actual frequency of our program varies throughout its lifetime -
   even though the TSC frequency remains invariant.
5. **Cache effects**: Code might run slower the first time due to cache misses.
   Both the CSAPP and Paoloni code involve some warm up steps for both
   instructions and data to reduce variability.
6. **Program's memory layout**. Turns out the link order, environment variables
   and even the directory from which we run our program can cause our code to
   run slower/faster than it should (as detailed in Mytkowicz et al's paper
   ['Producing Wrong Data Without Doing Anything Obviously Wrong!'](https://users.cs.northwestern.edu/~robby/courses/322-2013-spring/mytkowicz-wrong-data.pdf)).
   All these change the layout of a program once it's loaded which in turn
   affects caching, TLB lookups, prefetching & branch predictions. To derive
   meaningful benchmark results, Charlie Curtsinger and Emery D. Berger propose
   [Stabilizer](https://people.cs.umass.edu/~emery/pubs/stabilizer-asplos13.pdf),
   a tool that repeatedly randomizes a program's memory layout so to eliminate
   its effect in measurements. Emery has a great intro on how Stabilier works in
   his 2019 Strange Loop talk
   ['Performance Matters'](https://www.youtube.com/watch?v=r-TLSBdHe1A).
7. **Correctness**: this should go without mentioning but as Tim Harris points
   out in
   [Five ways not to fool yourself](https://timharris.uk/misc/five-ways.pdf),
   incorrect algorithms are often fast. One might place lightweight correctness
   checks throughout the code or even as a post-benchmarking step.
8. **Configuration**: Ideally, this should fall under correctness but it's worth
   having it as its own separate point - after all
   [configuration mishaps do cause a huge chunk of production failures](https://blog.acolyer.org/2016/11/29/early-detection-of-configuration-errors-to-reduce-failure-damage/).
   Values used in execution should match the configuration values, or better
   yet, as Tim Harris recommends, always collect values from the execution
   rather than from the config - it'll be easier to spot any mismatch that
   arises [9].
9. **The 'overall' system** - Gernot Heiser puts it best in
   [System Benchmarking Crimes](http://gernot-heiser.org/benchmarking-crimes.html#ubm):
   "Micro-benchmarks specifically probe a particular aspect of a system. Even if
   they are very comprehensive, they will not be representative of overall
   system performance. Macro-benchmarks (representing real-world workloads) must
   be used to provide a realistic picture of overall performance". The least we
   can do when carrying out microbenchmarks is to ensure the workloads are
   meaningful and represent production settings. On a similar note, Curtsinger &
   Emery Berger created [Coz](https://github.com/plasma-umass/coz) - a causal
   profiling tool that narrows down which parts of the codebase ought to be
   optimized in order to actually increase overall performance. The 'Performance
   Matters' video also goes over Coz in the second half.
10. **Actual audible noise** -
    [shouting at your hard disk makes it slower X`D](https://www.youtube.com/watch?v=tDacjrSCeq4),
    please don't.

Even with benchmarking, you can see why computer science programs have some
mandatory systems classes and even self-taught programmers are
[highly encouraged](https://teachyourselfcs.com/) to learn systems development.
A lot of these stuff won't directly apply to day-to-day programming but code
doesn't run on abstract machines - all software ultimately runs on systems (well
duh) and it's worth understanding the foundations upon which we're building on.

## References & Further Reading

1. [Intel® 64 and IA-32 Architectures Software Developer Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
2. How to Benchmark Code Execution Times in Intel IA-32 and IA-64 Instruction
   Set Architectures - Gabriele Paoloni - September 2010
3. [How to write benchmarks in Go - Dave Cheney](https://dave.cheney.net/2013/06/30/how-to-write-benchmarks-in-go)
4. [MSR & MSR_FASE - Energy Efficiency in HPC - PTC Lecture slide - pdf](https://events.it4i.cz/event/39/attachments/150/349/09-2020-01-30_MSR_SAFE.pdf)
5. [How to get the CPU cycle count in x86_64 from C++? - StackOverflow](https://stackoverflow.com/questions/13772567/how-to-get-the-cpu-cycle-count-in-x86-64-from-c)
6. [The microarchitecture of Intel, AMD and VIA CPUs - Agner Fog - Software Optimization Resources - pdf](https://www.agner.org/optimize/microarchitecture.pdf)
7. [Comments on timing short code sections on Intel processors - John McCalpin -
   blog](https://sites.utexas.edu/jdm4372/2018/07/23/comments-on-timing-short-code-sections-on-intel-processors/)
8. [SERIALIZE - serialize instruction execution - Felix Cloutier - x86 and amd64 instruction reference - derived from Intel's](https://www.felixcloutier.com/x86/serialize)
9. [Five ways not to fool yourself - Tim Harris - pdf](https://timharris.uk/misc/five-ways.pdf)
10. [sled theoretical performance guide - Tyler Neely](https://sled.rs/perf.html)
11. [Producing Wrong Data Without Doing Anything Obviously Wrong! - Mytkowicz et al - pdf](https://users.cs.northwestern.edu/~robby/courses/322-2013-spring/mytkowicz-wrong-data.pdf)').
12. [Stabilizer - Charlie Curtsinger, Emery D. Berger - pdf](https://people.cs.umass.edu/~emery/pubs/stabilizer-asplos13.pdf),
13. [Performance Matters - Emery Berger - Video](https://www.youtube.com/watch?v=r-TLSBdHe1A)
14. [Coz: Finding Code that Counts - Charlie Curtsinger, Emery D. Berger](https://github.com/plasma-umass/coz)
15. [System Benchmarking Crimes - Gernot Heiser](http://gernot-heiser.org/benchmarking-crimes.html)
