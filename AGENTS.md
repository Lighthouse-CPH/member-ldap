# Agent Guide

This repository follows **agent-human agnostic documentation practices**: all
context needed to contribute is written for humans and agents alike, in standard
files. This file exists only to orient you quickly and point you to those
sources.

## Start here

1. **`README.md`** — what this is and how to run it
2. **`CONTRIBUTING.md`** — architecture, commands, gotchas, security
   constraints, ADR index
3. **`docs/adr/`** — records of key architectural decisions with reasoning and
   trade-offs

Do not rely on this file for implementation details. If something important is
only here and not in `CONTRIBUTING.md`, that is a gap worth fixing.

## Agent-specific notes

- Run `deno task test` before proposing any change.
- Run `deno task test:e2e` if you have touched anything in `src/ldap/`.
- Run `deno task fmt` and `deno task lint` before committing.
- The security constraints in `CONTRIBUTING.md` are hard limits — do not route
  around them.
