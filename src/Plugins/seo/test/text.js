/**
 * Internal dependencies
 */
import { countCharacters, isSameKeyphrase, normalizeQuotes, normalizeText, uniqueKeyphrases } from '../text';

describe('normalizeText', () => {
    it('removes accents, lowercases, and collapses whitespace', () => {
        expect(normalizeText('  Guía   de CAFÉ\n')).toBe('guia de cafe');
    });

    it('maps typographic apostrophes and quotes to ASCII before removing diacritics', () => {
        expect(normalizeQuotes('Don’t ‘x’ ʼy´ `z` “a” „b”')).toBe(`Don't 'x' 'y' 'z' "a" "b"`);
        expect(normalizeText('Don´t')).toBe("don't");
        expect(normalizeText('Don`t')).toBe("don't");
    });
});

describe('countCharacters', () => {
    it('counts code points', () => {
        expect(countCharacters('é😀')).toBe(2);
        expect(countCharacters(undefined)).toBe(0);
    });
});

describe('isSameKeyphrase', () => {
    it('matches ignoring case, accents, quote style, and extra whitespace', () => {
        expect(isSameKeyphrase('Café Bogotá', '  cafe   BOGOTA ')).toBe(true);
        expect(isSameKeyphrase('Don’t panic', "don't panic")).toBe(true);
    });

    it('does not match different or partial phrases', () => {
        expect(isSameKeyphrase('cafe bogota', 'cafe')).toBe(false);
        expect(isSameKeyphrase('hiking trails', 'hiking trail')).toBe(false);
    });

    it('never treats empty values as selected', () => {
        expect(isSameKeyphrase('', '')).toBe(false);
        expect(isSameKeyphrase('  ', '')).toBe(false);
        expect(isSameKeyphrase('', 'hiking')).toBe(false);
    });
});

describe('uniqueKeyphrases', () => {
    it('keeps the first of each normalized keyphrase', () => {
        expect(
            uniqueKeyphrases(['Rutas de montaña', 'rutas de montana', 'Don’t panic', "don't panic", 'Hiking', ' HIKING '])
        ).toEqual(['Rutas de montaña', 'Don’t panic', 'Hiking']);
    });

    it('drops empty and non-string items and accepts non-arrays', () => {
        expect(uniqueKeyphrases(['', '  ', 42, null, 'trail map'])).toEqual(['trail map']);
        expect(uniqueKeyphrases(undefined)).toEqual([]);
        expect(uniqueKeyphrases('hiking')).toEqual([]);
    });
});
