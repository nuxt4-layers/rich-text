import { z } from 'zod';
/**
 * The safe tree: the only form in which readers receive rich text. Its nodes
 * carry no markup and no link but the format's, so whatever draws them
 * cannot be handed anything unsafe.
 */
export type RichTextNode = {
    kind: 'text';
    value: string;
} | {
    kind: 'paragraph' | 'emphasis' | 'strong' | 'delete' | 'blockquote' | 'list-item';
    children: RichTextNode[];
} | {
    kind: 'heading';
    depth: 1 | 2 | 3 | 4 | 5 | 6;
    children: RichTextNode[];
} | {
    kind: 'list';
    ordered: boolean;
    start: number | null;
    children: RichTextNode[];
} | {
    kind: 'code';
    value: string;
    inline: boolean;
} | {
    kind: 'link';
    href: string;
    children: RichTextNode[];
} | {
    kind: 'document-link';
    documentId: string;
    children: RichTextNode[];
} | {
    kind: 'image';
    assetId: string;
    alt: string;
} | {
    kind: 'table';
    align: ('left' | 'right' | 'center' | null)[];
    rows: RichTextNode[][][];
} | {
    kind: 'break';
} | {
    kind: 'rule';
};
/** Checks a safe tree received from elsewhere, such as a stored or relayed answer. */
export declare const richTextNodeSchema: z.ZodType<RichTextNode>;
/** A whole safe tree, nested no deeper than the format allows. */
export declare const richTextTreeSchema: z.ZodArray<z.ZodType<RichTextNode, unknown, z.core.$ZodTypeInternals<RichTextNode, unknown>>>;
/** Whether a link node's destination is one the format keeps. */
export declare function safeHref(href: string): boolean;
