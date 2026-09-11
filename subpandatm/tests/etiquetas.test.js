/**
 * Vigilar que la traducción lleve el mismo formato que el original.
 *
 * El peligro aquí no es partir una etiqueta por la mitad —el campo es
 * contenteditable y la cursiva se ve en cursiva— sino el contrario, que no se ve
 * al leer la traducción: que el formato se quede por el camino. El original
 * tenía el título de una película en cursiva, quien traduce escribe encima, y la
 * cursiva desaparece sin que nada avise.
 */
import { describe, expect, it } from 'vitest';
import { compararEtiquetas, estilosDe } from '@core/etiquetas.js';

describe('qué formato lleva un texto', () => {
    it('lo lee de las etiquetas de siempre', () => {
        expect(estilosDe('Hola <i>mundo</i>')).toEqual(['italic']);
        expect(estilosDe('<b>uno</b> <u>dos</u>')).toEqual(['bold', 'underline']);
        expect(estilosDe('<em>x</em> y <strong>z</strong>')).toEqual(['bold', 'italic']);
    });

    it('y de los atributos, que es como lo escribe TTML', () => {
        expect(estilosDe('Hello <span tts:fontStyle="italic">world</span>')).toEqual(['italic']);
        expect(estilosDe('<span tts:fontWeight="bold">x</span>')).toEqual(['bold']);
        expect(estilosDe('<span tts:color="yellow">x</span>')).toEqual(['color']);
    });

    it('y del estilo en línea, que es lo que deja el navegador', () => {
        expect(estilosDe('<span style="font-style: italic">x</span>')).toEqual(['italic']);
        expect(estilosDe('<font color="#ffff00">x</font>')).toEqual(['color']);
    });

    it('un <span> que solo agrupa no lleva formato', () => {
        expect(estilosDe('<span style="s2">Hola</span>')).toEqual([]);
        expect(estilosDe('Hola mundo')).toEqual([]);
    });

    it('el salto de línea no es formato', () => {
        expect(estilosDe('dos<br/>líneas')).toEqual([]);
    });

    it('quién habla sí lo es, que en WebVTT decide de qué color sale', () => {
        expect(estilosDe('<v Ana>Hola')).toEqual(['voz']);
    });
});

describe('comparar el original con la traducción', () => {
    it('no dice nada cuando cuadran', () => {
        expect(compararEtiquetas('Hola <i>mundo</i>', 'Hello <i>world</i>')).toEqual({
            faltan: [],
            sobran: [],
        });
    });

    it('aunque cada uno lo escriba a su manera', () => {
        // Ésta es la razón de comparar lo que significan y no cómo se escriben:
        // en el editor la cursiva es <i> y en el archivo TTML es un atributo.
        expect(
            compararEtiquetas(
                'Hello <span tts:fontStyle="italic">world</span>',
                'Hola <i>mundo</i>',
            ),
        ).toEqual({ faltan: [], sobran: [] });
    });

    it('avisa de la cursiva que se quedó por el camino', () => {
        const { faltan, sobran } = compararEtiquetas('Hola <i>mundo</i>', 'Hello world');

        expect(faltan).toEqual(['italic']);
        expect(sobran).toEqual([]);
    });

    it('cuenta las repeticiones: dos cursivas no son una', () => {
        const { faltan } = compararEtiquetas(
            '<i>uno</i> y <i>dos</i>',
            '<i>one</i> and two',
        );

        expect(faltan).toEqual(['italic']);
    });

    it('y también de la que se ha puesto de más', () => {
        const { faltan, sobran } = compararEtiquetas('Hola mundo', 'Hello <i>world</i>');

        expect(faltan).toEqual([]);
        expect(sobran).toEqual(['italic']);
    });

    it('un subtítulo sin traducir todavía no es un subtítulo con un error', () => {
        expect(compararEtiquetas('Hola <i>mundo</i>', '')).toEqual({ faltan: [], sobran: [] });
        expect(compararEtiquetas('Hola <i>mundo</i>', '<br>')).toEqual({ faltan: [], sobran: [] });
    });
});

describe('el formato que no son etiquetas', () => {
    it('ve la cursiva de un ASS, que va entre llaves y no entre picos', () => {
        // Este era el agujero: en ASS el formato no son etiquetas, así que
        // buscando "<" no se encontraba nada y el aviso no saltaba nunca.
        expect(estilosDe('{\\i1}Hola{\\i0}')).toEqual(['italic']);
    });

    it('y la negrita y el subrayado', () => {
        expect(estilosDe('{\\b1}Hola{\\b0}')).toEqual(['bold']);
        expect(estilosDe('{\\u1}Hola{\\u0}')).toEqual(['underline']);
    });

    it('y el color, en sus dos formas', () => {
        expect(estilosDe('{\\c&H00FFFF&}Hola')).toEqual(['color']);
        expect(estilosDe('{\\1c&H00FFFF&}Hola')).toEqual(['color']);
    });

    it('varias marcas en una sola llave cuentan cada una', () => {
        // En ASS se escriben seguidas: {\i1\b1} es cursiva y negrita.
        expect(estilosDe('{\\i1\\b1}Hola')).toEqual(['bold', 'italic']);
    });

    it('apagar una marca no cuenta como ponerla', () => {
        // {\i0} es "quita la cursiva". Si contara, un subtítulo con cursiva
        // daría dos y la traducción con una sola parecería que va corta.
        expect(estilosDe('{\\i1}Hola{\\i0} mundo')).toEqual(['italic']);
    });

    it('la posición no es formato del texto y no cuenta', () => {
        // Colocar un subtítulo arriba no es ponerlo en cursiva: si contara,
        // avisaría en todos los carteles de un ASS sin que falte nada.
        expect(estilosDe('{\\an8}Hola')).toEqual([]);
        expect(estilosDe('{\\pos(100,200)}Hola')).toEqual([]);
    });

    it('avisa cuando la cursiva de un ASS se queda por el camino', () => {
        expect(compararEtiquetas('{\\i1}Hello{\\i0}', 'Hola')).toEqual({
            faltan: ['italic'],
            sobran: [],
        });
    });

    it('y no avisa cuando la traducción la lleva, aunque venga del editor', () => {
        // El original trae la marca del ASS y la traducción un <i> del editor:
        // es la misma cursiva escrita de dos maneras.
        expect(compararEtiquetas('{\\i1}Hello{\\i0}', '<i>Hola</i>')).toEqual({
            faltan: [],
            sobran: [],
        });
    });

    it('ve el color de un WebVTT, que va en una clase', () => {
        expect(estilosDe('<c.yellow>Hola</c>')).toEqual(['color']);
        expect(estilosDe('<c.color-00ffcc>Hola</c>')).toEqual(['color']);
    });

    it('y avisa si se pierde al traducir', () => {
        expect(compararEtiquetas('<c.yellow>Hello</c>', 'Hola')).toEqual({
            faltan: ['color'],
            sobran: [],
        });
    });

    it('una clase de WebVTT que no es un color no cuenta como color', () => {
        // <c.grito> es una clase del archivo, no necesariamente un color, y
        // marcarla daría un aviso falso en cada subtítulo.
        expect(estilosDe('<c.grito>Hola</c>')).toEqual([]);
    });
});
