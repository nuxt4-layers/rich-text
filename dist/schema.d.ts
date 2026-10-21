import { z } from 'zod';
import { type RichTextProfile } from './format.js';
import { type RichTextField } from './parse.js';
/** The key under which a formatted field names its profile, in its schema's metadata and JSON Schema. */
export declare const RICH_TEXT_META_KEY = "x-rich-text";
export declare const richTextFieldSchema: z.ZodObject<{
    profile: z.ZodEnum<{
        inline: "inline";
        block: "block";
        document: "document";
    }>;
    max: z.ZodInt;
}, z.core.$strict>;
/**
 * A formatted field: a string no longer than `max`, refused when it uses
 * anything beyond its profile. The owning layer finds it from its schema
 * (`richTextFields`) and checks it on every save, whichever screen sent it.
 */
export declare function richTextSchema(field: RichTextField): z.ZodString;
export interface RichTextFieldPath {
    /** A field name, then `.name` into an object or `[].name` into each item of an array: `intro`, `blocks[].body`. */
    path: string;
    profile: RichTextProfile;
    max: number;
}
/** Every formatted field in a schema, found from its metadata. Plain strings are never listed. */
export declare function richTextFields(schema: z.ZodType): RichTextFieldPath[];
