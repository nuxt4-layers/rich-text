import type { Definition, Nodes, Parents, PhrasingContent, Root, Table } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmTable } from 'micromark-extension-gfm-table'
import {
  ASSET_LINK_PATTERN,
  DOC_LINK_PATTERN,
  RICH_TEXT_MAX_DEPTH,
  RICH_TEXT_PROFILE_CONSTRUCTS,
  type RichTextConstruct,
  type RichTextProfile,
} from './format.js'
import { safeHref, type RichTextNode } from './tree.js'

/** Why a source may not be saved in a field. */
export type RichTextProblem =
  | 'too-long'
  | 'not-in-profile'
  | 'more-than-one-paragraph'
  | 'image-without-alt'
  | 'image-not-asset'

export interface RichTextCheck {
  /** Empty when the source may be saved. */
  problems: RichTextProblem[]
  /** The constructs used that the profile does not allow, once each. */
  outside: RichTextConstruct[]
  /** Every `doc:` target, once each. */
  documentIds: string[]
  /** Every `asset:` image, once each. */
  assetIds: string[]
}

export interface RichTextField {
  profile: RichTextProfile
  /** The longest source allowed, in characters. */
  max: number
}

function syntaxTree(source: string): Root {
  return fromMarkdown(source, {
    extensions: [gfmTable(), gfmStrikethrough({ singleTilde: false })],
    mdastExtensions: [gfmTableFromMarkdown(), gfmStrikethroughFromMarkdown()],
  })
}

function definitions(tree: Root): Map<string, Definition> {
  const found = new Map<string, Definition>()
  const visit = (node: Nodes) => {
    if (node.type === 'definition' && !found.has(node.identifier)) found.set(node.identifier, node)
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(tree)
  return found
}

/** The plain text of a syntax node, as written. */
function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? ''
  if ('children' in node) return (node.children as Nodes[]).map(textOf).join('')
  return ''
}

/** A link destination the format keeps, as a node, or `null` for its text alone. */
function linkTarget(url: string): { kind: 'link', href: string } | { kind: 'document-link', documentId: string } | null {
  const document = DOC_LINK_PATTERN.exec(url)
  if (document) return { kind: 'document-link', documentId: document[1]! }
  return safeHref(url) ? { kind: 'link', href: url } : null
}

function convert(node: Nodes, defined: Map<string, Definition>, depth: number): RichTextNode[] {
  if (depth > RICH_TEXT_MAX_DEPTH) return [{ kind: 'text', value: textOf(node) }]
  const children = (parent: Parents) => (parent.children as Nodes[]).flatMap(child => convert(child, defined, depth + 1))
  switch (node.type) {
    case 'root': return children(node)
    case 'text': return [{ kind: 'text', value: node.value }]
    // Raw HTML is never markup: it is the text written.
    case 'html': return [{ kind: 'text', value: node.value }]
    case 'paragraph': return [{ kind: 'paragraph', children: children(node) }]
    case 'emphasis': return [{ kind: 'emphasis', children: children(node) }]
    case 'strong': return [{ kind: 'strong', children: children(node) }]
    case 'delete': return [{ kind: 'delete', children: children(node) }]
    case 'blockquote': return [{ kind: 'blockquote', children: children(node) }]
    case 'heading': return [{ kind: 'heading', depth: node.depth, children: children(node) }]
    case 'list': return [{ kind: 'list', ordered: node.ordered === true, start: node.ordered ? node.start ?? 1 : null, children: children(node) }]
    case 'listItem': {
      // A tight list's items hold their text directly.
      const items = node.spread ? children(node) : node.children.flatMap(child => child.type === 'paragraph' ? children(child) : convert(child, defined, depth + 1))
      return [{ kind: 'list-item', children: items }]
    }
    case 'code': return [{ kind: 'code', value: node.value, inline: false }]
    case 'inlineCode': return [{ kind: 'code', value: node.value, inline: true }]
    case 'break': return [{ kind: 'break' }]
    case 'thematicBreak': return [{ kind: 'rule' }]
    case 'definition': return []
    case 'link':
    case 'linkReference': {
      const url = node.type === 'link' ? node.url : defined.get(node.identifier)?.url
      const target = url === undefined ? null : linkTarget(url)
      const inner = children(node)
      if (node.type === 'linkReference' && url === undefined) return [{ kind: 'text', value: '[' }, ...inner, { kind: 'text', value: ']' }]
      return target ? [{ ...target, children: inner }] : inner
    }
    case 'image':
    case 'imageReference': {
      const url = node.type === 'image' ? node.url : defined.get(node.identifier)?.url
      const asset = url === undefined ? null : ASSET_LINK_PATTERN.exec(url)
      const alt = (node.alt ?? '').trim()
      return asset && alt ? [{ kind: 'image', assetId: asset[1]!, alt }] : alt ? [{ kind: 'text', value: alt }] : []
    }
    case 'table': return [table(node, defined, depth)]
    default: return 'children' in node ? children(node as Parents) : 'value' in node && typeof node.value === 'string' ? [{ kind: 'text', value: node.value }] : []
  }
}

function table(node: Table, defined: Map<string, Definition>, depth: number): RichTextNode {
  return {
    kind: 'table',
    align: (node.align ?? []).map(align => align ?? null),
    rows: node.children.map(row => row.children.map(cell => (cell.children as PhrasingContent[]).flatMap(child => convert(child, defined, depth + 2)))),
  }
}

/** The construct a node belongs to, or `null` for text and parts of a construct. */
function constructOf(node: RichTextNode): RichTextConstruct | null {
  switch (node.kind) {
    case 'text':
    case 'list-item': return null
    default: return node.kind
  }
}

const PHRASING = new Set<RichTextNode['kind']>(['text', 'emphasis', 'strong', 'delete', 'link', 'document-link', 'code', 'image', 'break'])
const isPhrasing = (node: RichTextNode) => PHRASING.has(node.kind) && !(node.kind === 'code' && !node.inline)

/** Replaces each construct the profile does not allow with what it says, as text. */
function restrict(nodes: readonly RichTextNode[], allowed: ReadonlySet<RichTextConstruct>): RichTextNode[] {
  return nodes.flatMap((node): RichTextNode[] => {
    const construct = constructOf(node)
    if (construct === null || allowed.has(construct)) {
      if ('children' in node) return [{ ...node, children: restrict(node.children, allowed) }]
      if (node.kind === 'table') return [{ ...node, rows: node.rows.map(row => row.map(cell => restrict(cell, allowed))) }]
      return [node]
    }
    switch (node.kind) {
      case 'code': return node.inline ? [{ kind: 'text', value: node.value }] : [{ kind: 'paragraph', children: [{ kind: 'text', value: node.value }] }]
      case 'image': return [{ kind: 'text', value: node.alt }]
      case 'rule': return []
      case 'break': return [{ kind: 'text', value: ' ' }]
      case 'table': return node.rows.map(row => ({
        kind: 'paragraph',
        children: row.flatMap((cell, index) => [...(index ? [{ kind: 'text', value: ' ' } as const] : []), ...restrict(cell, allowed)]),
      }))
      default: return 'children' in node ? restrict(node.children, allowed) : []
    }
  })
}

/** An inline field's tree: phrasing only, with a break where blocks met. */
function phrasing(nodes: readonly RichTextNode[]): RichTextNode[] {
  const out: RichTextNode[] = []
  for (const node of nodes) {
    if (isPhrasing(node)) {
      out.push(node)
      continue
    }
    const inner = phrasing('children' in node ? node.children : [])
    if (!inner.length) continue
    if (out.length) out.push({ kind: 'break' })
    out.push(...inner)
  }
  return out
}

function parseAll(source: string): RichTextNode[] {
  try {
    const tree = syntaxTree(source)
    return convert(tree, definitions(tree), 0)
  }
  catch {
    return source ? [{ kind: 'paragraph', children: [{ kind: 'text', value: source }] }] : []
  }
}

/**
 * Parses a source into the safe tree a reader receives, holding only what the
 * profile allows: anything beyond it is its text. Never throws on any input.
 * An inline field's tree is phrasing only, with no paragraph around it.
 */
export function parseRichText(source: string, profile: RichTextProfile): RichTextNode[] {
  const restricted = restrict(parseAll(source), new Set(RICH_TEXT_PROFILE_CONSTRUCTS[profile]))
  return profile === 'inline' ? phrasing(restricted) : restricted
}

/** What saving a source in a field needs to know: its problems, and the documents and assets it names. */
export function checkRichText(source: string, field: RichTextField): RichTextCheck {
  const problems = new Set<RichTextProblem>()
  const outside = new Set<RichTextConstruct>()
  const documentIds = new Set<string>()
  const assetIds = new Set<string>()
  if (source.length > field.max) problems.add('too-long')
  let tree: Root
  try {
    tree = syntaxTree(source)
  }
  catch {
    return { problems: [...problems], outside: [], documentIds: [], assetIds: [] }
  }
  const defined = definitions(tree)
  let images = false

  // Images and document links, as written: a rejected image would otherwise vanish into its text.
  const visit = (node: Nodes) => {
    if (node.type === 'image' || node.type === 'imageReference') {
      images = true
      const url = node.type === 'image' ? node.url : defined.get(node.identifier)?.url ?? ''
      const asset = ASSET_LINK_PATTERN.exec(url)
      if (!asset) problems.add('image-not-asset')
      else if (!(node.alt ?? '').trim()) problems.add('image-without-alt')
      else assetIds.add(asset[1]!)
    }
    if (node.type === 'link' || node.type === 'linkReference') {
      const url = node.type === 'link' ? node.url : defined.get(node.identifier)?.url ?? ''
      const document = DOC_LINK_PATTERN.exec(url)
      if (document) documentIds.add(document[1]!)
    }
    if ('children' in node) for (const child of node.children as Nodes[]) visit(child)
  }
  visit(tree)

  // Constructs, from the safe tree, against the profile.
  const allowed = new Set(RICH_TEXT_PROFILE_CONSTRUCTS[field.profile])
  const nodes = convert(tree, defined, 0)
  const walk = (list: readonly RichTextNode[]) => {
    for (const node of list) {
      const construct = constructOf(node)
      if (construct !== null && !allowed.has(construct)) outside.add(construct)
      if ('children' in node) walk(node.children)
      if (node.kind === 'table') for (const cell of node.rows.flat()) walk(cell)
    }
  }
  walk(nodes)
  if (images && !allowed.has('image')) outside.add('image')
  if (outside.size) problems.add('not-in-profile')
  if (field.profile === 'inline' && nodes.filter(node => !isPhrasing(node)).length > 1) problems.add('more-than-one-paragraph')
  if (!allowed.has('image')) {
    // Images are refused by the profile itself; their own problems would only repeat it.
    problems.delete('image-not-asset')
    problems.delete('image-without-alt')
    assetIds.clear()
  }
  if (!allowed.has('document-link')) documentIds.clear()
  return { problems: [...problems], outside: [...outside], documentIds: [...documentIds], assetIds: [...assetIds] }
}
