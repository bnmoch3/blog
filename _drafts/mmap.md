# MMAP

- 5: do no exceed main-memory
- 28
- 29
- 34

"One possible solution is to rely on the VM layer to deal with any spills out of
memory. For instance, some databases (such as Tokyo Cabinet) simply mmap their
backing store [6]. This leads to several problems. The first is that the OS VM
layer is particularly poor at making eviction decisions for transactional
workloads (as we show later in our exper- iments). The second is that the
operating system consid- ers itself free to flush dirty pages opportunistically,
with- out notifying the application. This can cause data integrity problems when
a page dirtied by an in-flight transaction is written back without the matching
log records." - [3, Pointer swizzling paper]

"With respect to correctness, the problem is durability and control over writes
to the backing store. Write-ahead log- ging requires that a modified database
page must not be written until the modifications (relevant log records) have
been logged on stable storage, and virtual memory might write a database page
too early. Similarly, virtual memory may write a database page too late – e.g.,
in many imple- mentations of database check-pointing, a checkpoint is not
complete until all dirty pages have been written to the back- ing store.
Finally, if the latency-optimized logging space is limited and requires periodic
recycling, log records must not be recycled until all database changes have been
persisted." - [3, Pointer swizzling paper]

"Some operating systems provide mechanisms to control physical I/O to
memory-mapped files, e.g., POSIX msync, mlock, and elated system calls.
Unfortunately, there are no mechanisms for asynchronous read-ahead and for writ-
ing multiple pages concurrently, i.e., multiple msync calls execute serially. As
observed by [37], without extensive ex- plicit control, the virtual memory
manager may swap out hot data along with the cold. Our experiments in Section 5
demonstrate this performance penalty." - [3, Pointer swizzling paper]

"The disadvantage is that the database system loses control over page eviction,
which virtually precludes in-place updates and full-blown ARIES-style recovery.
The problems of letting the operating system decide when to evict pages have
been discussed by Graefe et al. [18]. Another disadvantage is that the operating
system does not have database-specific knowledge about access patterns (e.g.,
scans of large tables). In addition, experimental results (cf. [18] and Fig. 9)
show that swapping on Linux, which is the most common server operating system,
does not perform well for database workloads. We therefore believe that relying
on the operating system’s swapping/mmap mechanism is not a viable alternative to
software-managed approaches. Indeed, main- memory database vendors recommend to
car" - leanstore 1 paper
