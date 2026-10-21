import { type RichTextConstruct, type RichTextProfile } from './format.js';
import { type RichTextNode } from './tree.js';
/** Why a source may not be saved in a field. */
export type RichTextProblem = 'too-long' | 'unsafe-characters' | 'not-in-profile' | 'more-than-one-paragraph' | 'image-without-alt' | 'image-not-asset';
export interface RichTextCheck {
    /** Empty when the source may be saved. */
    problems: RichTextProblem[];
    /** The constructs used that the profile does not allow, once each. */
    outside: RichTextConstruct[];
    /** Every `doc:` target, once each. */
    documentIds: string[];
    /** Every `asset:` image, once each. */
    assetIds: string[];
}
export interface RichTextField {
    profile: RichTextProfile;
    /** The longest source allowed, in characters. */
    max: number;
}
/**
 * Parses a source into the safe tree a reader receives, holding only what the
 * profile allows: anything beyond it is its text. Never throws on any input.
 * An inline field's tree is phrasing only, with no paragraph around it.
 */
export declare function parseRichText(source: string, profile: RichTextProfile): RichTextNode[];
/**
 * What saving a source in a field needs to know: its problems, and the
 * documents and assets it names. Check the normalised source
 * (`normaliseRichText`): a carriage return is a control character.
 */
export declare function checkRichText(source: string, field: RichTextField): RichTextCheck;
