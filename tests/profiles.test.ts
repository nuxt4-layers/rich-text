import { describe, expect, it } from 'vitest'
import { checkRichText, normaliseRichText, parseRichText, RICH_TEXT_PROFILE_CONSTRUCTS, RICH_TEXT_PROFILES } from '../shared/index.js'

const target = '01928c4e-0000-7000-8000-000000000042'
const max = 10_000

const samples = {
  'paragraph': 'Plain words.',
  'emphasis': '*soft*',
  'strong': '**firm**',
  'link': '[here](https://example.org)',
  'break': 'one  \ntwo',
  'heading': '## Heading',
  'list': '- item',
  'blockquote': '> quoted',
  'delete': '~~gone~~',
  'code': '`code`',
  'document-link': `[there](doc:${target})`,
  'image': '![A door](asset:door-1)',
  'table': '| a |\n|---|\n| 1 |',
  'rule': 'above\n\n---\n\nbelow',
} as const

describe('profiles', () => {
  it('match ADR-0011: inline, block and document, each wider than the last', () => {
    expect(RICH_TEXT_PROFILES).toEqual(['inline', 'block', 'document'])
    expect(RICH_TEXT_PROFILE_CONSTRUCTS.inline).toEqual(['paragraph', 'emphasis', 'strong', 'link', 'break'])
    expect(RICH_TEXT_PROFILE_CONSTRUCTS.block).toEqual([...RICH_TEXT_PROFILE_CONSTRUCTS.inline, 'heading', 'list', 'blockquote'])
    expect(RICH_TEXT_PROFILE_CONSTRUCTS.document).toEqual(Object.keys(samples))
  })

  for (const profile of RICH_TEXT_PROFILES) {
    it(`${profile}: accepts what it allows and refuses everything else`, () => {
      for (const [construct, source] of Object.entries(samples)) {
        const checked = checkRichText(source, { profile, max })
        if (RICH_TEXT_PROFILE_CONSTRUCTS[profile].includes(construct as never)) expect(checked.problems, construct).toEqual([])
        else {
          expect(checked.problems, construct).toContain('not-in-profile')
          expect(checked.outside, construct).toContain(construct)
        }
      }
    })

    it(`${profile}: reads anything beyond it as text, never as the construct`, () => {
      const allowed = new Set<string>(RICH_TEXT_PROFILE_CONSTRUCTS[profile])
      for (const [construct, source] of Object.entries(samples)) {
        if (allowed.has(construct)) continue
        expect(JSON.stringify(parseRichText(source, profile)), construct).not.toContain(`"kind":"${construct}"`)
      }
    })
  }

  it('inline: one paragraph only, read as phrasing with no paragraph around it', () => {
    expect(checkRichText('One.\n\nTwo.', { profile: 'inline', max }).problems).toEqual(['more-than-one-paragraph'])
    expect(parseRichText('A **bold** claim', 'inline')).toEqual([{ kind: 'text', value: 'A ' }, { kind: 'strong', children: [{ kind: 'text', value: 'bold' }] }, { kind: 'text', value: ' claim' }])
    expect(parseRichText('One.\n\nTwo.', 'inline')).toEqual([{ kind: 'text', value: 'One.' }, { kind: 'break' }, { kind: 'text', value: 'Two.' }])
  })

  it('refuses control characters, carriage returns among them: check the normalised source', () => {
    expect(checkRichText('a\u0000b', { profile: 'inline', max })).toMatchObject({ problems: ['unsafe-characters'] })
    expect(checkRichText('a\r\nb', { profile: 'block', max }).problems).toEqual(['unsafe-characters'])
    expect(checkRichText(normaliseRichText('a\r\nb'), { profile: 'block', max }).problems).toEqual([])
  })

  it('refuses a source longer than its field', () => {
    expect(checkRichText('x'.repeat(11), { profile: 'block', max: 10 }).problems).toEqual(['too-long'])
  })

  it('document: refuses an image without alt text, or from anywhere but the asset store, and lists what a source names', () => {
    const field = { profile: 'document', max } as const
    expect(checkRichText('![](asset:door-1)', field).problems).toEqual(['image-without-alt'])
    expect(checkRichText('![   ](asset:door-1)', field).problems).toEqual(['image-without-alt'])
    expect(checkRichText('![A door](https://example.org/door.png)', field).problems).toEqual(['image-not-asset'])
    expect(checkRichText(`![A door](asset:door-1) [a](doc:${target}) [b](doc:${target}) ![Again](asset:door-1)`, field))
      .toEqual({ problems: [], outside: [], documentIds: [target], assetIds: ['door-1'] })
  })

  it('block: refuses any image, wherever it points', () => {
    expect(checkRichText('![A door](https://example.org/door.png)', { profile: 'block', max })).toMatchObject({ problems: ['not-in-profile'], outside: ['image'], assetIds: [] })
  })
})
