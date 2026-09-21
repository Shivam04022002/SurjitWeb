const sanitizeHtml = require('sanitize-html');

// HTML allowlists for blog content that did not come straight from a trusted
// editor. The public site renders blog content as raw HTML, so anything that
// reaches a blog record from a model has to be reduced to plain formatting
// first — a topic string can steer a model into emitting markup.

const TEXT_TAGS = [
    'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

// Raw model output: formatting only. No links, images, embeds, attributes or
// styles. An <h1> becomes <h2>, since the page already renders the title.
const GENERATED = {
    allowedTags: TEXT_TAGS,
    allowedAttributes: {},
    transformTags: { h1: 'h2' },
    disallowedTagsMode: 'discard'
};

// The same content after an admin has edited it in the CMS rich-text editor,
// which can add links, uploaded images, YouTube embeds, table spans and text
// alignment. Anything else is still removed.
const EDITED = {
    allowedTags: [...TEXT_TAGS, 'a', 'img', 'div', 'iframe', 'colgroup', 'col'],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        div: ['data-youtube-video'],
        iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
        th: ['colspan', 'rowspan'],
        td: ['colspan', 'rowspan'],
        col: ['style'],
        '*': ['style']
    },
    allowedStyles: {
        '*': { 'text-align': [/^(left|right|center|justify)$/] },
        col: { 'min-width': [/^\d+(px|em|%)$/], width: [/^\d+(px|em|%)$/] }
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'],
    allowProtocolRelative: false,
    transformTags: {
        h1: 'h2',
        a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' })
    },
    disallowedTagsMode: 'discard'
};

const sanitizeGenerated = (html) => sanitizeHtml(String(html || ''), GENERATED).trim();
const sanitizeEdited = (html) => sanitizeHtml(String(html || ''), EDITED).trim();

// Tag-free text, for fields that must hold no markup at all.
const plainText = (value) => sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const wordCount = (html) => plainText(html).split(/\s+/).filter(Boolean).length;

module.exports = { sanitizeGenerated, sanitizeEdited, plainText, wordCount };
