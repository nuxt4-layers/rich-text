import { z } from 'zod';
import { ASSET_LINK_PATTERN, RICH_TEXT_MAX_DEPTH, SITE_LINK_PATTERN } from './format.js';
const children = z.array(z.lazy(() => richTextNodeSchema)).max(10_000);
/** Checks a safe tree received from elsewhere, such as a stored or relayed answer. */
export const richTextNodeSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('text'), value: z.string().max(1_000_000) }),
    z.strictObject({ kind: z.enum(['paragraph', 'emphasis', 'strong', 'delete', 'blockquote', 'list-item']), children }),
    z.strictObject({ kind: z.literal('heading'), depth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]), children }),
    z.strictObject({ kind: z.literal('list'), ordered: z.boolean(), start: z.int().min(0).max(999_999_999).nullable(), children }),
    z.strictObject({ kind: z.literal('code'), value: z.string().max(1_000_000), inline: z.boolean() }),
    z.strictObject({ kind: z.literal('link'), href: z.string().max(2048).refine(safeHref, 'unsafe-link'), children }),
    z.strictObject({ kind: z.literal('document-link'), documentId: z.uuid(), children }),
    z.strictObject({ kind: z.literal('image'), assetId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/), alt: z.string().min(1).max(2000) }),
    z.strictObject({ kind: z.literal('table'), align: z.array(z.enum(['left', 'right', 'center']).nullable()).max(100), rows: z.array(z.array(children).max(100)).max(10_000) }),
    z.strictObject({ kind: z.literal('break') }),
    z.strictObject({ kind: z.literal('rule') }),
]);
/** A whole safe tree, nested no deeper than the format allows. */
export const richTextTreeSchema = z.array(richTextNodeSchema).max(10_000).refine(nodes => depthOf(nodes) <= RICH_TEXT_MAX_DEPTH + 2, 'too-deep');
/** Whether a link node's destination is one the format keeps. */
export function safeHref(href) {
    if (SITE_LINK_PATTERN.test(href) || ASSET_LINK_PATTERN.test(href))
        return true;
    if (/^mailto:[^\s<>"]+@[^\s<>"]+$/i.test(href))
        return true;
    try {
        const parsed = new URL(href);
        return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
    }
    catch {
        return false;
    }
}
function depthOf(nodes) {
    let deepest = 0;
    for (const node of nodes) {
        const inner = 'children' in node
            ? depthOf(node.children)
            : node.kind === 'table' ? Math.max(0, ...node.rows.flat().map(depthOf)) : 0;
        deepest = Math.max(deepest, inner + 1);
    }
    return deepest;
}
