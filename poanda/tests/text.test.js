import { describe, it, expect } from 'vitest';
import {
    countWords,
    splitTextIntoSentences,
    levenshteinDistance,
    calculateSimilarity,
} from '../src/js/core/text.js';

describe('countWords', () => {
    it('cuenta las palabras separadas por espacios', () => {
        expect(countWords('hola mundo cruel')).toBe(3);
    });

    it('no se confunde con espacios de más ni saltos de línea', () => {
        expect(countWords('  hola   mundo \n cruel  ')).toBe(3);
    });

    it('devuelve 0 con texto vacío o nulo', () => {
        expect(countWords('')).toBe(0);
        expect(countWords(null)).toBe(0);
        expect(countWords(undefined)).toBe(0);
    });

    it('cuenta una sola palabra', () => {
        expect(countWords('hola')).toBe(1);
    });
});

describe('splitTextIntoSentences', () => {
    it('parte por punto conservando el signo y el espacio que le sigue', () => {
        // El espacio posterior se conserva a propósito: es lo que permite volver
        // a montar el texto exactamente igual que estaba (corregido en v1.0.5).
        expect(splitTextIntoSentences('Hola. Adiós.')).toEqual(['Hola. ', 'Adiós.']);
    });

    it('reconoce interrogaciones y exclamaciones', () => {
        expect(splitTextIntoSentences('¿Qué tal? ¡Bien!')).toEqual(['¿Qué tal? ', '¡Bien!']);
    });

    it('al volver a unir las frases sale el texto original, sin espacios de más', () => {
        const texto = 'One. Two. Three.';
        expect(splitTextIntoSentences(texto).join('')).toBe(texto);
    });

    it('devuelve una sola frase si no hay puntuación final', () => {
        expect(splitTextIntoSentences('Sin punto final')).toEqual(['Sin punto final']);
    });

    it('devuelve [""] con texto vacío', () => {
        expect(splitTextIntoSentences('')).toEqual(['']);
        expect(splitTextIntoSentences('   ')).toEqual(['']);
    });
});

describe('levenshteinDistance', () => {
    it('es 0 entre dos cadenas idénticas', () => {
        expect(levenshteinDistance('casa', 'casa')).toBe(0);
    });

    it('cuenta una sustitución', () => {
        expect(levenshteinDistance('casa', 'cosa')).toBe(1);
    });

    it('cuenta una inserción', () => {
        expect(levenshteinDistance('casa', 'casas')).toBe(1);
    });

    it('con una cadena vacía es la longitud de la otra', () => {
        expect(levenshteinDistance('', 'casa')).toBe(4);
        expect(levenshteinDistance('casa', '')).toBe(4);
    });
});

describe('calculateSimilarity', () => {
    it('da 100 con textos idénticos', () => {
        expect(calculateSimilarity('the cat', 'the cat')).toBe(100);
    });

    it('da un porcentaje intermedio con textos parecidos', () => {
        const s = calculateSimilarity('the cat is black', 'the cat is white');
        expect(s).toBeGreaterThan(60);
        expect(s).toBeLessThan(100);
    });

    it('da 0 si falta alguno de los dos textos', () => {
        expect(calculateSimilarity('', 'algo')).toBe(0);
        expect(calculateSimilarity('algo', '')).toBe(0);
    });

    it('nunca se sale del rango 0-100', () => {
        const s = calculateSimilarity('abcdefghij', 'zyxwvutsrq');
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
    });
});
