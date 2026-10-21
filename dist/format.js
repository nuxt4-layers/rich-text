/**
 * The format's rules (ADR-0011 §2, §3). Loosening a profile, or widening
 * what the format allows, needs a new ADR.
 */
/** CommonMark, plus these GitHub Flavored Markdown extensions only. Raw HTML is never markup. */
export const RICH_TEXT_EXTENSIONS = ['gfm-table', 'gfm-strikethrough'];
/** The only link destinations kept, with site-relative paths: anything else is its text. */
export const RICH_TEXT_LINK_SCHEMES = ['https:', 'mailto:', 'doc:', 'asset:'];
/** A link to a document, by id: `[text](doc:<uuid>)`. */
export const DOC_LINK_PATTERN = /^doc:([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
/** An image from the host's asset store: `![alt](asset:<id>)`. */
export const ASSET_LINK_PATTERN = /^asset:([A-Za-z0-9][A-Za-z0-9._-]{0,199})$/;
/** A site-relative link: one leading `/`, never `//`. */
export const SITE_LINK_PATTERN = /^\/(?!\/)[^\s\\]*$/;
/** Constructs nested deeper than this become text: the format bounds the tree a renderer walks. */
export const RICH_TEXT_MAX_DEPTH = 64;
/** The longest source any field may declare, in characters. */
export const RICH_TEXT_MAX_LENGTH = 1_000_000;
/** Every construct the format has. Text is always allowed. */
export const RICH_TEXT_CONSTRUCTS = [
    'paragraph', 'emphasis', 'strong', 'link', 'break',
    'heading', 'list', 'blockquote',
    'delete', 'code', 'document-link', 'image', 'table', 'rule',
];
/** The profiles a formatted field declares. Plain text is not rich text: it is an ordinary string. */
export const RICH_TEXT_PROFILES = ['inline', 'block', 'document'];
const inline = ['paragraph', 'emphasis', 'strong', 'link', 'break'];
const block = [...inline, 'heading', 'list', 'blockquote'];
/** What each profile allows. An inline field is also a single paragraph. */
export const RICH_TEXT_PROFILE_CONSTRUCTS = Object.freeze({
    inline: Object.freeze([...inline]),
    block: Object.freeze([...block]),
    document: Object.freeze([...RICH_TEXT_CONSTRUCTS]),
});
