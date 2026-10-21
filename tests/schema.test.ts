import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { richTextFields, richTextSchema } from '../src/index.js'

describe('richTextSchema', () => {
  it('accepts what the profile allows and refuses the rest, with the problem as the message', () => {
    const bio = richTextSchema({ profile: 'block', max: 200 })
    expect(bio.safeParse('## About\n\n- one').success).toBe(true)
    const refused = bio.safeParse('| a |\n|---|\n| 1 |')
    expect(refused.success).toBe(false)
    expect(refused.error?.issues[0]?.message).toBe('not-in-profile')
    expect(bio.safeParse('x'.repeat(201)).success).toBe(false)
  })

  it('needs a profile and a bounded maximum', () => {
    expect(() => richTextSchema({ profile: 'label' as never, max: 10 })).toThrow()
    expect(() => richTextSchema({ profile: 'inline', max: 0 })).toThrow()
    expect(() => richTextSchema({ profile: 'inline', max: 2_000_000 })).toThrow()
  })
})

describe('richTextFields', () => {
  it('finds every formatted field, however deep, and never a plain string', () => {
    const fields = z.strictObject({
      title: z.string().max(200),
      intro: richTextSchema({ profile: 'inline', max: 300 }),
      blocks: z.array(z.strictObject({ body: richTextSchema({ profile: 'document', max: 5000 }), caption: z.string().max(80) })).max(10),
      note: richTextSchema({ profile: 'block', max: 1000 }).optional(),
    })
    expect(richTextFields(fields)).toEqual([
      { path: 'intro', profile: 'inline', max: 300 },
      { path: 'blocks[].body', profile: 'document', max: 5000 },
      { path: 'note', profile: 'block', max: 1000 },
    ])
  })
})
