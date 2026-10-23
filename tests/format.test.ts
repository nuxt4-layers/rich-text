import { describe, expect, it } from 'vitest'
import { parseRichText, richTextTreeSchema, type RichTextNode } from '../shared/index.js'

const target = '01928c4e-0000-7000-8000-000000000042'

/** Every node in a tree, depth first. */
function nodes(tree: readonly RichTextNode[]): RichTextNode[] {
  return tree.flatMap(node => [node, ...('children' in node ? nodes(node.children) : node.kind === 'table' ? node.rows.flat().flatMap(nodes) : [])])
}

describe('the format', () => {
  it('parses CommonMark with GFM tables and strikethrough into the safe tree', () => {
    const tree = parseRichText('# Title\n\nSome *emphasis*, **strong** and ~~struck~~ text.\n\n| a | b |\n|---|:-:|\n| 1 | 2 |\n\n- one\n- two\n\n```\ncode <b>\n```', 'document')
    const kinds = new Set(nodes(tree).map(node => node.kind))
    for (const kind of ['heading', 'emphasis', 'strong', 'delete', 'table', 'list', 'list-item', 'code'] as const) expect(kinds).toContain(kind)
    expect(tree.find(node => node.kind === 'table')).toMatchObject({ align: [null, 'center'] })
    expect(nodes(tree)).toContainEqual({ kind: 'code', value: 'code <b>', inline: false })
    expect(richTextTreeSchema.safeParse(tree).success).toBe(true)
  })

  it('keeps raw HTML, scripts and event handlers as the text written', () => {
    const tree = parseRichText('<script>alert(1)</script>\n\nText <span onclick="alert(1)">inline</span>', 'document')
    const texts = nodes(tree).filter(node => node.kind === 'text').map(node => node.value).join('')
    expect(texts).toContain('<script>alert(1)</script>')
    expect(texts).toContain('<span onclick="alert(1)">')
    expect(nodes(tree).every(node => ['paragraph', 'text'].includes(node.kind))).toBe(true)
  })

  it('keeps only https, mailto, doc, asset and site-relative links; the rest are their text', () => {
    const tree = parseRichText([
      '[safe](https://example.org/a)', '[mail](mailto:hello@example.org)', '[local](/about)', `[doc](doc:${target})`,
      '[script](javascript:alert(1))', '[encoded](jav&#x61;script:alert(1))', '[data](data:text/html;base64,PHNjcmlwdD4=)',
      '[plain](http://example.org)', '[protocol-relative](//evil.example)', '[vb](vbscript:msgbox)', '[creds](https://a:b@example.org)', '<javascript:alert(1)>',
    ].join('\n\n'), 'document')
    const links = nodes(tree).filter(node => node.kind === 'link').map(node => node.href)
    expect(links).toEqual(['https://example.org/a', 'mailto:hello@example.org', '/about'])
    expect(nodes(tree)).toContainEqual({ kind: 'document-link', documentId: target, children: [{ kind: 'text', value: 'doc' }] })
    const texts = nodes(tree).filter(node => node.kind === 'text').map(node => node.value)
    for (const text of ['script', 'data', 'plain', 'protocol-relative', 'vb', 'creds']) expect(texts).toContain(text)
  })

  it('keeps asset: images with alt text only; any other image is its alt text', () => {
    const tree = parseRichText('![A red door](asset:door-1)\n\n![Elsewhere](https://evil.example/x.png)\n\n![](asset:door-2)', 'document')
    expect(nodes(tree).filter(node => node.kind === 'image')).toEqual([{ kind: 'image', assetId: 'door-1', alt: 'A red door' }])
    expect(nodes(tree)).toContainEqual({ kind: 'text', value: 'Elsewhere' })
  })

  it('never throws, and bounds how deep a tree goes', () => {
    for (const source of ['', '['.repeat(10_000), '\u0000', '| a |\n|', '<'.repeat(5000), '*'.repeat(5000), '>'.repeat(5000) + ' deep']) {
      for (const profile of ['inline', 'block', 'document'] as const) {
        const tree = parseRichText(source, profile)
        expect(richTextTreeSchema.safeParse(tree).success).toBe(true)
      }
    }
  })

  it('refuses an unsafe tree received from elsewhere', () => {
    for (const tree of [
      [{ kind: 'link', href: 'javascript:alert(1)', children: [] }],
      [{ kind: 'html', value: '<b>' }],
      [{ kind: 'text', value: 'x', extra: true }],
      [{ kind: 'image', assetId: 'https://evil.example/x.png', alt: 'x' }],
    ]) expect(richTextTreeSchema.safeParse(tree).success).toBe(false)
  })
})
