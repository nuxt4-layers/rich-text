import { z } from 'zod';
import { normaliseRichText, RICH_TEXT_MAX_LENGTH, RICH_TEXT_PROFILES } from './format.js';
import { checkRichText } from './parse.js';
/** The key under which a formatted field names its profile, in its schema's metadata and JSON Schema. */
export const RICH_TEXT_META_KEY = 'x-rich-text';
export const richTextFieldSchema = z.strictObject({
    profile: z.enum(RICH_TEXT_PROFILES),
    max: z.int().min(1).max(RICH_TEXT_MAX_LENGTH),
});
/**
 * A formatted field: a string, normalised (`normaliseRichText`), no longer
 * than `max`, refused when it uses anything beyond its profile or holds a
 * control character. The owning layer finds it from its schema
 * (`richTextFields`) and checks it on every save, whichever screen sent it.
 */
export function richTextSchema(field) {
    const { profile, max } = richTextFieldSchema.parse(field);
    return z.string()
        .overwrite(normaliseRichText)
        .max(max)
        .superRefine((value, context) => {
        if (value.length > max)
            return;
        const checked = checkRichText(value, { profile, max });
        for (const problem of checked.problems) {
            context.addIssue({ code: 'custom', message: problem, params: { richText: problem, outside: checked.outside } });
        }
    })
        .meta({ [RICH_TEXT_META_KEY]: profile, maxLength: max });
}
/** Every formatted field in a schema, found from its metadata. Plain strings are never listed. */
export function richTextFields(schema) {
    const root = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
    const found = new Map();
    const visit = (node, path, seen) => {
        node = deref(root, node);
        if (!node || seen.has(node))
            return;
        const inner = new Set(seen).add(node);
        const profile = node[RICH_TEXT_META_KEY];
        if (path && typeof profile === 'string' && RICH_TEXT_PROFILES.includes(profile) && typeof node.maxLength === 'number') {
            found.set(path, { path, profile: profile, max: node.maxLength });
        }
        for (const branch of ['anyOf', 'oneOf', 'allOf']) {
            if (Array.isArray(node[branch]))
                for (const option of node[branch])
                    visit(option, path, inner);
        }
        if (node.properties && typeof node.properties === 'object') {
            for (const [name, child] of Object.entries(node.properties))
                visit(child, path ? `${path}.${name}` : name, inner);
        }
        if (node.items && typeof node.items === 'object' && path)
            visit(node.items, `${path}[]`, inner);
    };
    visit(root, '', new Set());
    return [...found.values()];
}
function deref(root, node) {
    if (!node || typeof node.$ref !== 'string')
        return node;
    if (node.$ref === '#')
        return root;
    const match = /^#\/\$defs\/(.+)$/.exec(node.$ref);
    return match ? root.$defs?.[match[1]] : undefined;
}
