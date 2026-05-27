# ADR 0001: Deno 2 as the runtime

**Status**: Accepted

## Context

We needed a runtime for a small, security-sensitive server with no existing codebase
to conform to. The main candidates were Node.js (with npm) and Deno 2.

## Decision

Use Deno 2 with native tooling (`deno.json`, `deno add`, `deno.lock`).

## Reasons

- **Secure by default** — explicit permission flags (`--allow-net`, `--allow-env`,
  `--allow-read`) make the attack surface visible and auditable in `deno.json`.
- **Built-in TypeScript** — no transpile step, no tsconfig to maintain.
- **Built-in test runner** — no test framework dependency; `@std/testing` and
  `@std/assert` from JSR cover everything needed.
- **npm compatibility** — Deno 2's npm compat layer lets us use `npm:ldapjs` and
  `npm:stripe` without a separate `node_modules` install step in CI or Docker.
- **Single binary** — the `denoland/deno` Docker image is minimal and the binary
  itself handles formatting, linting, type-checking, and testing.

## Trade-offs

- ldapjs is a Node.js library; some Node.js built-ins (notably `tls.Server.listen`
  with certain argument forms) behave differently under Deno's compat layer.
  See ADR 0003.
- Deno's npm compat is not 100% identical to Node.js — any new npm dependency
  should be tested under Deno before committing.
