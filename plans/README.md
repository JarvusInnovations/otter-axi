# plans

Work-in-flight that bridges [specs](../specs/) to merged code. Specs describe *state* (what
should be true); plans describe *motion* (how we get there next). Each plan declares its
scope, the specs it implements, its dependencies, and concrete validation criteria; once
merged it freezes as the record of what got built.

See the **specops** skill's `references/plans-protocol.md` for the full frontmatter schema,
status lifecycle, and closeout ritual. Query the DAG with the bundled `specops` CLI
(`scripts/specops next`, `scripts/specops dag`) — this README intentionally keeps no
hand-maintained status table or graph.
