/**
 * The format's rules (ADR-0011 §2, §3). Loosening a profile, or widening
 * what the format allows, needs a new ADR.
 */
/** CommonMark, plus these GitHub Flavored Markdown extensions only. Raw HTML is never markup. */
export declare const RICH_TEXT_EXTENSIONS: readonly ["gfm-table", "gfm-strikethrough"];
/** The only link destinations kept, with site-relative paths: anything else is its text. */
export declare const RICH_TEXT_LINK_SCHEMES: readonly ["https:", "mailto:", "doc:", "asset:"];
/** A link to a document, by id: `[text](doc:<uuid>)`. */
export declare const DOC_LINK_PATTERN: RegExp;
/** An image from the host's asset store: `![alt](asset:<id>)`. */
export declare const ASSET_LINK_PATTERN: RegExp;
/** A site-relative link: one leading `/`, never `//`. */
export declare const SITE_LINK_PATTERN: RegExp;
/** Constructs nested deeper than this become text: the format bounds the tree a renderer walks. */
export declare const RICH_TEXT_MAX_DEPTH = 64;
/** The longest source any field may declare, in characters. */
export declare const RICH_TEXT_MAX_LENGTH = 1000000;
/** Every construct the format has. Text is always allowed. */
export declare const RICH_TEXT_CONSTRUCTS: readonly ["paragraph", "emphasis", "strong", "link", "break", "heading", "list", "blockquote", "delete", "code", "document-link", "image", "table", "rule"];
export type RichTextConstruct = typeof RICH_TEXT_CONSTRUCTS[number];
/** The profiles a formatted field declares. Plain text is not rich text: it is an ordinary string. */
export declare const RICH_TEXT_PROFILES: readonly ["inline", "block", "document"];
export type RichTextProfile = typeof RICH_TEXT_PROFILES[number];
/** What each profile allows. An inline field is also a single paragraph. */
export declare const RICH_TEXT_PROFILE_CONSTRUCTS: Readonly<Record<RichTextProfile, readonly RichTextConstruct[]>>;
