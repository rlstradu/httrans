/**
 * Desenvolver los párrafos del changelog.
 *
 * El CHANGELOG.md está escrito con saltos de línea duros a unas 78 columnas,
 * que es lo cómodo para leerlo en un editor de texto. La ventana que lo enseña
 * dentro de Poanda es más estrecha, así que el navegador vuelve a partir esas
 * líneas ya partidas y queda un texto lleno de renglones de dos palabras.
 *
 * La solución es quitar los saltos que solo estaban ahí para dar forma al
 * archivo, dejando que el navegador reparta el texto a lo ancho de la ventana.
 * Lo difícil es distinguirlos de los saltos que sí significan algo: los títulos
 * de sección, las líneas de guiones, las listas y el final de cada párrafo.
 */
import { describe, it, expect } from 'vitest';
import { desenvolverParrafos } from '../src/js/core/text.js';

describe('desenvolverParrafos', () => {
    it('une las líneas de un mismo párrafo', () => {
        const entrada = [
            'The way you open files has been reworked. Instead of a row of buttons and a',
            'File menu with an entry per format, there is now a single drop area.',
        ].join('\n');

        expect(desenvolverParrafos(entrada)).toBe(
            'The way you open files has been reworked. Instead of a row of buttons and a ' +
                'File menu with an entry per format, there is now a single drop area.'
        );
    });

    it('respeta las líneas en blanco que separan párrafos', () => {
        const entrada = 'Primer párrafo que es largo de verdad y llega hasta el final.\n\nSegundo.';
        expect(desenvolverParrafos(entrada)).toBe(
            'Primer párrafo que es largo de verdad y llega hasta el final.\n\nSegundo.'
        );
    });

    it('deja solos los títulos de sección', () => {
        // "New" es un encabezado, no el principio de la frase siguiente.
        const entrada = [
            'New',
            'Drop Area: The empty editor is now a place to drop files. Drag a file onto it,',
            'or click it to pick one from your computer.',
        ].join('\n');

        const salida = desenvolverParrafos(entrada).split('\n');
        expect(salida[0]).toBe('New');
        expect(salida[1]).toBe(
            'Drop Area: The empty editor is now a place to drop files. Drag a file onto it, ' +
                'or click it to pick one from your computer.'
        );
    });

    it('no toca las líneas de guiones ni el título de la versión', () => {
        const entrada = [
            '=======================================',
            'Poanda v1.4.0 - A Cleaner Way In',
            'Release Date: September 7, 2026',
            '=======================================',
        ].join('\n');

        expect(desenvolverParrafos(entrada)).toBe(entrada);
    });

    it('une una línea corta cuando la siguiente es claramente continuación', () => {
        // Esta línea se queda corta porque la palabra siguiente no cabía, pero
        // el párrafo sigue: se nota en que la siguiente empieza en minúscula o
        // por un signo de puntuación.
        const entrada = [
            'Poanda now lives at httrans.org/poanda/. The old address',
            '(httrans.org/poanda.html) still works and redirects here automatically.',
        ].join('\n');

        expect(desenvolverParrafos(entrada)).toBe(
            'Poanda now lives at httrans.org/poanda/. The old address ' +
                '(httrans.org/poanda.html) still works and redirects here automatically.'
        );
    });

    it('no mete las listas dentro del párrafo anterior', () => {
        const entrada = [
            'Estas son las novedades de esta versión, que son unas cuantas y vienen así:',
            '* Primera cosa.',
            '* Segunda cosa.',
            '1. Tercera cosa.',
        ].join('\n');

        expect(desenvolverParrafos(entrada)).toBe(entrada);
    });

    it('no une nada después de una línea que termina en dos puntos', () => {
        const entrada = ['New Features and other things that are worth telling you about:', 'Algo.'].join(
            '\n'
        );
        expect(desenvolverParrafos(entrada)).toBe(entrada);
    });

    it('respeta las líneas sangradas', () => {
        const entrada = [
            'Lo que puedes hacer con el glosario, que es bastante más de lo que parece:',
            '    * Build and maintain a project-specific glossary.',
        ].join('\n');
        expect(desenvolverParrafos(entrada)).toBe(entrada);
    });

    it('aguanta el texto vacío y el texto de una sola línea', () => {
        expect(desenvolverParrafos('')).toBe('');
        expect(desenvolverParrafos('Una sola línea.')).toBe('Una sola línea.');
    });

    it('no pierde ni una palabra del changelog de verdad', () => {
        // La red de seguridad: se puede discutir dónde va cada salto, pero el
        // texto tiene que llegar entero.
        const original = [
            '=======================================',
            'Poanda v1.4.0 - A Cleaner Way In',
            '=======================================',
            '',
            'The way you open files has been reworked. Instead of a row of buttons and a',
            'File menu with an entry per format, there is now a single drop area.',
            '',
            'New',
            'Drop Area: The empty editor is now a place to drop files.',
        ].join('\n');

        const palabras = (t) => t.split(/\s+/).filter(Boolean);
        expect(palabras(desenvolverParrafos(original))).toEqual(palabras(original));
    });
});
