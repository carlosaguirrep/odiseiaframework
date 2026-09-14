/**
 * Text helpers shared by the SEO sidebar, the content analysis, and the SEO checks.
 */

/**
 * Counts characters by code point so emoji and accented characters count once.
 *
 * @param {string} value Text to count.
 * @return {number} Number of characters.
 */
export const countCharacters = (value) => Array.from(value || '').length;

/**
 * Decodes a URI component, returning the input unchanged when it is not valid encoding.
 *
 * @param {string} value Encoded value.
 * @return {string} Decoded value.
 */
export const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
};

/**
 * Collapses runs of whitespace into single spaces and trims the result.
 *
 * @param {string} value Text to collapse.
 * @return {string} Collapsed text.
 */
export const collapseWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// Right and left single quotes, modifier letter apostrophe, acute accent, and grave accent.
const APOSTROPHES = /[’‘ʼ´`]/g;
// Left and right double quotes, and double low-9 quote.
const DOUBLE_QUOTES = /[“”„]/g;

/**
 * Replaces typographic apostrophes and quotes with their ASCII forms, so "Don’t" matches "Don't".
 *
 * @param {string} value Text.
 * @return {string} Text with ASCII apostrophes and double quotes.
 */
export const normalizeQuotes = (value) =>
    String(value ?? '')
        .replace(APOSTROPHES, "'")
        .replace(DOUBLE_QUOTES, '"');

/**
 * Normalizes text for matching: quote-, accent-, and case-insensitive, with collapsed whitespace.
 *
 * Quotes are mapped first because some of them (´ and `) are diacritics that would otherwise be removed.
 *
 * @param {string} value Text to normalize.
 * @return {string} Normalized text.
 */
export const normalizeText = (value) =>
    collapseWhitespace(
        normalizeQuotes(value)
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
    );

/**
 * Whether two keyphrases are the same, ignoring case, accents, quote style, and extra whitespace.
 *
 * @param {string} a First keyphrase.
 * @param {string} b Second keyphrase.
 * @return {boolean} True when both are non-empty and equal after normalization.
 */
export const isSameKeyphrase = (a, b) => {
    const normalized = normalizeText(a);
    return normalized !== '' && normalized === normalizeText(b);
};

/**
 * Keeps the first of each keyphrase that is the same after normalization, dropping empty and
 * non-string items.
 *
 * @param {*} keyphrases List of keyphrases.
 * @return {string[]} Unique keyphrases.
 */
export const uniqueKeyphrases = (keyphrases) => {
    const seen = new Set();
    return (Array.isArray(keyphrases) ? keyphrases : []).filter((keyphrase) => {
        if (typeof keyphrase !== 'string') {
            return false;
        }
        const key = normalizeText(keyphrase);
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};
