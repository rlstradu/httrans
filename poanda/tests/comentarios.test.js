/**
 * Repartir los comentarios de un segmento.
 *
 * Antes iban todos juntos a la etiqueta gris de encima del segmento, y eso
 * mezclaba dos cosas que no se usan igual: la referencia al código te ubica de
 * un vistazo, y la nota del programador hay que leerla entera. Ahora la
 * referencia se queda en la etiqueta y la nota se va al icono de comentario.
 */
import { describe, it, expect } from 'vitest';
import { repartirComentarios } from '../src/js/core/comentarios.js';

describe('repartirComentarios', () => {
    it('la referencia al código es referencia', () => {
        const { referencias, notas } = repartirComentarios(['#: templates/home.html:42']);
        expect(referencias).toEqual(['templates/home.html:42']);
        expect(notas).toEqual([]);
    });

    it('la nota del programador es nota', () => {
        const { referencias, notas } = repartirComentarios(['#. Máximo 20 caracteres']);
        expect(notas).toEqual(['Máximo 20 caracteres']);
        expect(referencias).toEqual([]);
    });

    it('un comentario suelto también es nota', () => {
        // Es el que deja quien tradujo antes.
        expect(repartirComentarios(['# Ojo con el tuteo']).notas).toEqual(['Ojo con el tuteo']);
    });

    it('la marca de exclamación de los .properties es nota', () => {
        expect(repartirComentarios(['! No traducir']).notas).toEqual(['No traducir']);
    });

    it('las marcas del formato no se enseñan', () => {
        // fuzzy ya tiene su propia insignia; el original anterior y las cadenas
        // retiradas son sintaxis del archivo, no información para traducir.
        const { referencias, notas } = repartirComentarios([
            '#, fuzzy',
            '#| msgid "Old text"',
            '#~ msgid "Retirada"',
        ]);
        expect(referencias).toEqual([]);
        expect(notas).toEqual([]);
    });

    it('reparte una entrada con de todo', () => {
        const { referencias, notas } = repartirComentarios([
            '#. Es el botón de la barra principal',
            '#: admin/menu.php:120',
            '#: admin/menu.php:245',
            '#, fuzzy',
            '# Antes decía "Grabar"',
        ]);

        expect(referencias).toEqual(['admin/menu.php:120', 'admin/menu.php:245']);
        expect(notas).toEqual(['Es el botón de la barra principal', 'Antes decía "Grabar"']);
    });

    it('no deja notas vacías de una almohadilla suelta', () => {
        expect(repartirComentarios(['#', '#  ']).notas).toEqual([]);
    });

    it('aguanta la lista vacía y lo que no sea una lista', () => {
        expect(repartirComentarios([])).toEqual({ referencias: [], notas: [] });
        expect(repartirComentarios(undefined)).toEqual({ referencias: [], notas: [] });
    });
});
