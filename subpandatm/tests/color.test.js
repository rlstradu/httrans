/**
 * Los colores.
 *
 * El navegador escribe el mismo color de varias maneras según por dónde se le
 * pida. Un archivo de subtítulos quiere una sola, y la que no entiende no la
 * avisa: sale el subtítulo en blanco y nadie se entera hasta que lo ve el
 * cliente.
 */
import { describe, expect, it } from 'vitest';
import { aComponentes, aHex, comoLoEntiendeUnArchivo } from '@core/color.js';

describe('aHex', () => {
    it('deja en paz un color que ya viene en hexadecimal', () => {
        expect(aHex('#ffff00')).toBe('#ffff00');
    });

    it('estira el hexadecimal corto', () => {
        expect(aHex('#f0c')).toBe('#ff00cc');
    });

    it('lo pone en minúsculas, para que dos iguales se reconozcan como uno', () => {
        expect(aHex('#FFFF00')).toBe('#ffff00');
    });

    it('entiende el rgb() que deja el navegador', () => {
        expect(aHex('rgb(0, 255, 255)')).toBe('#00ffff');
    });

    it('y el rgba(), quedándose con el color y soltando la transparencia', () => {
        // Un archivo de subtítulos de texto no sabe decir "medio transparente".
        expect(aHex('rgba(255, 0, 0, 0.5)')).toBe('#ff0000');
    });

    it('entiende la forma nueva, con barra y sin comas', () => {
        expect(aHex('rgb(0 128 255 / 50%)')).toBe('#0080ff');
    });

    it('entiende los colores con nombre que se usan en subtítulos', () => {
        expect(aHex('yellow')).toBe('#ffff00');
        expect(aHex('cyan')).toBe('#00ffff');
        expect(aHex('White')).toBe('#ffffff');
    });

    it('redondea y no se sale de sitio', () => {
        expect(aHex('rgb(255.6, -20, 300)')).toBe('#ff00ff');
    });

    it('devuelve vacío cuando no lo entiende, que es "no toques esto"', () => {
        // Preferimos dejar en el archivo algo raro que alguien puso a propósito
        // antes que borrárselo.
        expect(aHex('var(--mi-color)')).toBe('');
        expect(aHex('')).toBe('');
        expect(aHex(null)).toBe('');
    });
});

describe('aComponentes', () => {
    it('devuelve los tres números', () => {
        expect(aComponentes('#0080ff')).toEqual({ rojo: 0, verde: 128, azul: 255 });
    });

    it('y null cuando no hay color que valga', () => {
        expect(aComponentes('no soy un color')).toBeNull();
    });
});

describe('comoLoEntiendeUnArchivo', () => {
    it('no reescribe un color que ya está bien puesto', () => {
        // La misma norma que con los tiempos: no se toca lo que funciona. Un
        // archivo que decía "red" no tiene por qué volver diciendo "#ff0000".
        expect(comoLoEntiendeUnArchivo('red')).toBe('red');
        expect(comoLoEntiendeUnArchivo('#ff0000')).toBe('#ff0000');
        expect(comoLoEntiendeUnArchivo('#FF0000')).toBe('#FF0000');
    });

    it('arregla lo que el navegador escribe y un reproductor no entiende', () => {
        expect(comoLoEntiendeUnArchivo('rgb(0, 255, 255)')).toBe('#00ffff');
        expect(comoLoEntiendeUnArchivo('#0fc')).toBe('#00ffcc');
    });

    it('y lo que no se entiende vuelve tal cual', () => {
        expect(comoLoEntiendeUnArchivo('var(--mi-color)')).toBe('var(--mi-color)');
    });
});
