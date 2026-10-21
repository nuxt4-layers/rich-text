import { z } from 'zod'
import { RICH_TEXT_MAX_LENGTH, RICH_TEXT_PROFILES, type RichTextProfile } from './format.js'
import { checkRichText, type RichTextField } from './parse.js'

/** The key under which a formatted field names its profile, in its schema's metadata and JSON Schema. */
export const RICH_TEXT_META_KEY = 'x-rich-text'

export const richTextFieldSchema = z.strictObject({
  profile: z.enum(RICH_TEXT_PROFILES),
  max: z.int().min(1).max(RICH_TEXT_MAX_LENGTH),
})

/**
 * A formatted field: a string no longer than `max`, refused when it uses
 * anything beyond its profile. The owning layer finds it from its schema
 * (`richTextFields`) and checks it on every save, whichever screen sent it.
 */
export function richTextSchema(field: RichTextField): z.ZodString {
  const { profile, max } = richTextFieldSchema.parse(field)
  return z.string()
    .max(max)
    .superRefine((value, context) => {
      if (value.length > max) return
      const checked = checkRichText(value, { profile, max })
      for (const problem of checked.problems) {
        context.addIssue({ code: 'custom', message: problem, params: { richText: problem, outside: checked.outside } })
      }
    })
    .meta({ [RICH_TEXT_META_KEY]: profile, maxLength: max })
}

type JsonNode = Record<string, unknown>

export interface RichTextFieldPath {
  /** A field name, then `.name` into an object or `[].name` into each item of an array: `intro`, `blocks[].body`. */
  path: string
  profile: RichTextProfile
  max: number
}

/** Every formatted field in a schema, found from its metadata. Plain strings are never listed. */
export function richTextFields(schema: z.ZodType): RichTextFieldPath[] {
  const root = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonNode
  const found = new Map<string, RichTextFieldPath>()
  const visit = (node: JsonNode | undefined, path: string, seen: ReadonlySet<JsonNode>) => {
    node = deref(root, node)
    if (!node || seen.has(node)) return
    const inner = new Set(seen).add(node)
    const profile = node[RICH_TEXT_META_KEY]
    if (path && typeof profile === 'string' && (RICH_TEXT_PROFILES as readonly string[]).includes(profile) && typeof node.maxLength === 'number') {
      found.set(path, { path, profile: profile as RichTextProfile, max: node.maxLength })
    }
    for (const branch of ['anyOf', 'oneOf', 'allOf'] as const) {
      if (Array.isArray(node[branch])) for (const option of node[branch] as JsonNode[]) visit(option, path, inner)
    }
    if (node.properties && typeof node.properties === 'object') {
      for (const [name, child] of Object.entries(node.properties as Record<string, JsonNode>)) visit(child, path ? `${path}.${name}` : name, inner)
    }
    if (node.items && typeof node.items === 'object' && path) visit(node.items as JsonNode, `${path}[]`, inner)
  }
  visit(root, '', new Set())
  return [...found.values()]
}

function deref(root: JsonNode, node: JsonNode | undefined): JsonNode | undefined {
  if (!node || typeof node.$ref !== 'string') return node
  if (node.$ref === '#') return root
  const match = /^#\/\$defs\/(.+)$/.exec(node.$ref)
  return match ? (root.$defs as Record<string, JsonNode> | undefined)?.[match[1]!] : undefined
}
