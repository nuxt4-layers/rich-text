# @nuxt4-layers/rich-text

> **In short:** the platform's one rich-text format. A layer that stores formatted text checks every save with it; readers receive only its safe tree. It holds no state and draws nothing.

Governed by [ADR-0011](https://github.com/nuxt4-layers/platform-architecture/blob/667e5310a66c56327f0ef80d43ce01b573ce6d86/docs/decisions/ADR-0011-shared-rich-text-and-configurable-copy.md). A stateless library, not a layer: no pages, routes, storage, ports or configuration.

## What it holds

| Part | Gives |
|---|---|
| **The format** | A safe subset of Markdown: CommonMark with GFM tables and strikethrough. Raw HTML is always text |
| **Profiles** | What each formatted field may use: inline, block or document |
| **Checks** | `checkRichText` and `richTextSchema`: what a save must refuse, and which documents and assets a source names |
| **The safe tree** | `parseRichText`: nodes that carry no markup and only the format's links, for any renderer to draw |

Plain text is not rich text. A label, name or title is an ordinary string with a length limit, edited with a standard form control.

## Profiles

| Profile | Allows | Typical use |
|---|---|---|
| **Inline** | One paragraph: bold, italic, links, line breaks | A tagline, a caption, a short notice |
| **Block** | Inline, plus headings, lists and quotes | A bio, a description, a summary |
| **Document** | Everything: also strikethrough, code, tables, rules, `asset:` images and `doc:` links | An article or a page |

A save that uses anything beyond its profile is refused. A tree read from such a source holds it as text.

## Links

| Kept | As |
|---|---|
| `https:` (no credentials), `mailto:`, site-relative `/path` | A link |
| `doc:<uuid>` | A link to a document, by id, which the owning layer resolves |
| `asset:<id>` image with alt text | An image, which the host's asset store resolves |

Any other destination, such as `javascript:`, `data:`, `http:` or `//host`, is its text.

## Using it

```ts
import { z } from 'zod'
import { checkRichText, parseRichText, richTextFields, richTextSchema } from '@nuxt4-layers/rich-text'

// Declare: a formatted field names its profile and maximum length
const fields = z.strictObject({
  title: z.string().max(200), // plain
  bio: richTextSchema({ profile: 'block', max: 2000 }),
})

// Find: the owning layer lists its formatted fields from the schema
richTextFields(fields) // [{ path: 'bio', profile: 'block', max: 2000 }]

// Check before saving: problems are codes, never values
checkRichText(source, { profile: 'block', max: 2000 })
// { problems: ['not-in-profile'], outside: ['table'], documentIds: [], assetIds: [] }

// Read: answer the safe tree, never the source rendered as HTML
const nodes = parseRichText(source, 'block')
```

| Export | Does |
|---|---|
| `richTextSchema({ profile, max })` | A zod string refused beyond its profile; its profile is in its metadata (`x-rich-text`) |
| `richTextFields(schema)` | Every formatted field in a schema, with its path (`blocks[].body`), profile and maximum |
| `checkRichText(source, { profile, max })` | Problems (`too-long`, `not-in-profile`, `more-than-one-paragraph`, `image-without-alt`, `image-not-asset`), constructs beyond the profile, and the documents and assets named |
| `parseRichText(source, profile)` | The safe tree. Never throws; nesting is bounded. An inline tree is phrasing only |
| `richTextTreeSchema`, `richTextNodeSchema` | Check a safe tree received from elsewhere |
| `RICH_TEXT_*`, link patterns, `safeHref` | The format's rules, as data |

Drawing the tree is `nuxt4-layers/ui`'s; editing a formatted field is `content-editor`'s, or a plain `<textarea>`.

## Guardrails

- Never renders HTML; returns safe trees only.
- Loosening a profile, or widening what the format allows, needs a new ADR.
- Imports only `zod` and the Markdown parser; `tests/surface.test.ts` holds it to that.

## Development

`pnpm install`, then `pnpm check` (type check and tests). After changing `src/`, run `pnpm build` and commit `dist/`: hosts install from Git and receive it as committed. `python3 scripts/check_markdown.py` checks the documentation.
