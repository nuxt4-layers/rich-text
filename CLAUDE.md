# @nuxt4-layers/rich-text — notes for Claude

## What this is
The platform's one rich-text format ([ADR-0011](https://github.com/nuxt4-layers/platform-architecture/blob/667e5310a66c56327f0ef80d43ce01b573ce6d86/docs/decisions/ADR-0011-shared-rich-text-and-configurable-copy.md)): a safe subset of Markdown, its profiles (inline, block, document), the checks before saving and the safe tree readers receive. A stateless library, not a Nuxt layer. British spelling everywhere.

## Commands
- `pnpm install`, then `pnpm check` (= `tsc --noEmit` + `vitest run`); run it after every code change
- `pnpm build` after changing `src/`, and commit `dist/`: hosts install from Git, so `dist/` is what they run. CI fails when it is stale. Never add a `prepare`/`postinstall` script
- `python3 scripts/check_markdown.py` after every documentation change

## Rules
- Stateless: no storage, ports, screens, configuration, Nuxt or Vue. Imports only `zod` and the Markdown parser packages; `tests/surface.test.ts` enforces it.
- Never renders HTML. Readers receive the safe tree only.
- Plain text is not rich text: there is no label profile.
- Loosening a profile, or widening what the format or its links allow, needs a new ADR. Tightening is a major release.
- Problems are codes; never put a source's text in a problem, message or log.
- Never throws on any input; nesting is bounded by `RICH_TEXT_MAX_DEPTH`.
- Keep the README in step with the exports, briefly. Link to other `nuxt4-layers` documents pinned to a commit.
- Package manager: pnpm. Commit `pnpm-lock.yaml`.
