import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as library from '../src/index.js'

const root = join(import.meta.dirname, '..')
const ALLOWED = new Set(['zod', 'mdast', 'mdast-util-from-markdown', 'mdast-util-gfm-strikethrough', 'mdast-util-gfm-table', 'micromark-extension-gfm-strikethrough', 'micromark-extension-gfm-table'])

describe('a stateless library (ADR-0011 §7)', () => {
  it('imports only zod and the Markdown parser: no Nuxt, Vue, server, storage or other layer', () => {
    for (const file of readdirSync(join(root, 'src'))) {
      const source = readFileSync(join(root, 'src', file), 'utf8')
      for (const [, specifier] of source.matchAll(/from '([^']+)'/g)) {
        if (specifier!.startsWith('./')) continue
        expect(ALLOWED, `${file} imports ${specifier}`).toContain(specifier)
      }
    }
  })

  it('never renders: no HTML, DOM or component in its surface', () => {
    const source = readdirSync(join(root, 'src')).map(file => readFileSync(join(root, 'src', file), 'utf8')).join('\n')
    expect(source).not.toMatch(/innerHTML|v-html|document\.|createElement|renderToString/)
    expect(Object.keys(library).sort()).toEqual([
      'ASSET_LINK_PATTERN', 'DOC_LINK_PATTERN', 'RICH_TEXT_CONSTRUCTS', 'RICH_TEXT_EXTENSIONS', 'RICH_TEXT_LINK_SCHEMES',
      'RICH_TEXT_MAX_DEPTH', 'RICH_TEXT_MAX_LENGTH', 'RICH_TEXT_META_KEY', 'RICH_TEXT_PROFILES', 'RICH_TEXT_PROFILE_CONSTRUCTS',
      'SITE_LINK_PATTERN', 'UNSAFE_CHARACTER_PATTERN', 'checkRichText', 'normaliseRichText', 'parseRichText', 'richTextFieldSchema', 'richTextFields', 'richTextNodeSchema',
      'richTextSchema', 'richTextTreeSchema', 'safeHref',
    ])
  })

  it('ships a build that matches its source', () => {
    for (const file of readdirSync(join(root, 'src'))) {
      const built = join(root, 'dist', file.replace(/\.ts$/, '.js'))
      expect(() => readFileSync(built), `dist is missing ${file}: run pnpm build`).not.toThrow()
    }
  })
})
