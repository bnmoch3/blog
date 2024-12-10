# Optimistic Lock Coupling

## References

1. [Optimistic Lock Coupling: A Scalable and Efficient General-Purpose
   Synchronization Method - Viktor Leis, Michael Haubenschild, Thomas Neumann](https://web.archive.org/web/20220306194839id_/http://sites.computer.org/debull/A19mar/p73.pdf)
2. [Modern B-Tree Techniques - Goetz Graefe](https://w6113.github.io/files/papers/btreesurvey-graefe.pdf)

"When a root-to-leaf traversal advances from one B-tree node to one of its
children, there is a brief window of vulnerability between reading a pointer
value (the page identifier of the child node) and accessing the child node. In
the worst case, another thread deletes the child page from the B-tree during
that time and perhaps even starts using the page in another B-tree. The
probability is low if the child page is present in the buffer pool, but it
cannot be ignored. If ignored or not implemented correctly, identifying this
vulnerability as the cause for a corrupted database is very difficult." [2]

"A technique called latch coupling avoids this problem. The root- to-leaf search
retains the latch on the parent page, thus protecting the page from updates,
until it has acquired a latch on the child page. Once the child page is located,
pinned, and latched in the buffer pool, the latch on the parent page is
released. If the child page is readily available in the buffer pool, latches on
parent and child pages overlap only for a very short period of time." [2]

"Latch coupling was invented fairly early in the history of B-trees [9]. For
read-only queries, at most two nodes need to be locked (latched) at a time, both
in shared mode. In the original design for insertions, exclusive locks are
retained on all nodes along a root-to-leaf path until a node is found with
sufficient free space to permit splitting a child and posting a separator key"
