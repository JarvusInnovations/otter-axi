# otter-axi specs

Source of truth for what `otter-axi` *should be*. Code is brought into conformance with these specs; divergence is a bug, not debt.

`otter-axi` is an agent-facing CLI (an [AXI](https://github.com/JarvusInnovations/axi) tool) that wraps Otter.ai's **hosted MCP server** so meeting transcripts can be found and pulled from any shell — headlessly, after a one-time browser login.

## Directory layout

```
specs/
├── README.md          # this file
├── principles.md      # decisive, project-wide rules (the philosophy)
├── architecture.md    # stack, structure, foundational decisions
├── api/
│   └── mcp-server.md   # the upstream contract: transport, OAuth, tools
├── behaviors/
│   └── auth.md         # OAuth login, token storage, refresh, logout
└── commands/           # one file per CLI command (the CLI analogue of "screens")
    ├── search.md
    └── fetch.md
```

For a CLI, **`commands/`** plays the role the specops skill calls `screens/` — what the user
(an agent) can invoke and what it sees back. `behaviors/` holds cross-command rules (auth).
`api/` is the contract with the upstream we consume (Otter's MCP server) — owned by Otter,
captured here as the surface we depend on.

## Workflow

1. Change the spec first; get it accepted.
2. Bring code into conformance.
3. Verify running behavior against the spec.
4. Plans in `plans/` track the work-in-flight that bridges specs to code.

## Conventions

- Commands return plain objects; the AXI SDK serializes to TOON at the boundary.
- "Confirmed" fields are verified against real usage or live probes; fields marked
  **(TBD: spike)** await the plan-01 auth spike that captures real upstream output schemas.
