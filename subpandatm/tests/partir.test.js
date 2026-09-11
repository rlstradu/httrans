/**
 * Partir un subtítulo en dos sin romper lo que lleva dentro.
 *
 * Partir es de las cosas que más se hacen al ajustar, y el texto casi nunca es
 * texto pelado. Cortar por un número de caracteres a secas parte la etiqueta por
 * la mitad, y eso no es un subtítulo con una etiqueta rara: es un archivo que no
 * abre.
 */
import { describe, expect, it } from 'vitest';
import { cuantoSeVe, partirEnDos } from '../src/js/core/partir.js';

describe('contar lo que se ve', () => {
    it('no cuenta las etiquetas', () => {
        expect(cuantoSeVe('Hello world')).toBe(11);
        expect(cuantoSeVe('Hello <i>world</i>')).toBe(11);
        expect(cuantoSeVe('<span tts:fontStyle="italic">Hello</span>')).toBe(5);
    });

    it('cuenta una entidad como el carácter que es', () => {
        expect(cuantoSeVe('Tom &amp; Jerry')).toBe(11);
    });

    it('y el <br/> como el salto de línea que es', () => {
        expect(cuantoSeVe('Dos<br/>líneas')).toBe(10);
    });
});

describe('partir por la mitad', () => {
    it('parte el texto pelado por el espacio más cercano', () => {
        // Con el corte a mitad de palabra se va al hueco de al lado; en un
        // empate manda el de atrás, que deja la frase más corta arriba.
        expect(partirEnDos('Hello world again', 8)).toEqual(['Hello', 'world again']);
        expect(partirEnDos('Hello world again', 12)).toEqual(['Hello world', 'again']);
    });

    it('no parte una palabra por la mitad', () => {
        const [antes, despues] = partirEnDos('una frase bastante larga', 12);
        expect(antes.endsWith('bastante') || antes.endsWith('frase')).toBe(true);
        expect(`${antes} ${despues}`).toBe('una frase bastante larga');
    });

    it('parte por el salto de línea cuando lo hay, que es lo natural', () => {
        expect(partirEnDos('primera línea\nsegunda línea', 14)).toEqual([
            'primera línea',
            'segunda línea',
        ]);
    });
});

describe('lo que hay dentro no se rompe', () => {
    it('cierra y vuelve a abrir la etiqueta abierta', () => {
        // Sin esto salía "Hello <span tts:fon" y "tStyle=…", que no es un
        // archivo con una etiqueta rara: es un archivo que no abre.
        const [antes, despues] = partirEnDos(
            '<span tts:fontStyle="italic">Hello world again</span>',
            11,
        );

        expect(antes).toBe('<span tts:fontStyle="italic">Hello world</span>');
        expect(despues).toBe('<span tts:fontStyle="italic">again</span>');
    });

    it('con la etiqueta entera a un lado, no la duplica', () => {
        const [antes, despues] = partirEnDos('Hello <i>world</i> again', 12);

        expect(antes).toBe('Hello <i>world</i>');
        expect(despues).toBe('again');
    });

    it('con varias etiquetas metidas una dentro de otra, las cierra en su orden', () => {
        const [antes, despues] = partirEnDos('<b>uno <i>dos tres</i></b>', 8);

        expect(antes).toBe('<b>uno <i>dos</i></b>');
        expect(despues).toBe('<b><i>tres</i></b>');
    });

    it('no deja etiquetas vacías al partir justo en el borde', () => {
        const [antes, despues] = partirEnDos('Hello <i>world</i>', 5);

        expect(antes).toBe('Hello');
        expect(despues).toBe('<i>world</i>');
        expect(antes).not.toContain('<i>');
    });

    it('y lo que sale de las dos partes, junto, es lo que había', () => {
        const texto = 'Hello <span tts:fontStyle="italic">brave new</span> world';
        const [antes, despues] = partirEnDos(texto, 11);

        // Menos uno: el espacio por el que se corta es la costura y no va a
        // ninguno de los dos trozos.
        expect(cuantoSeVe(antes) + cuantoSeVe(despues)).toBe(cuantoSeVe(texto) - 1);
        expect(antes).toBe('Hello <span tts:fontStyle="italic">brave</span>');
        expect(despues).toBe('<span tts:fontStyle="italic">new</span> world');
    });
});

describe('los casos de los bordes', () => {
    it('cortar en cero deja el texto entero en el segundo trozo', () => {
        expect(partirEnDos('Hola mundo', 0)).toEqual(['', 'Hola mundo']);
    });

    it('cortar más allá del final deja el texto entero en el primero', () => {
        expect(partirEnDos('Hola mundo', 99)).toEqual(['Hola mundo', '']);
    });

    it('con el texto vacío no se rompe', () => {
        expect(partirEnDos('', 3)).toEqual(['', '']);
        expect(partirEnDos(null, 3)).toEqual(['', '']);
    });
});
