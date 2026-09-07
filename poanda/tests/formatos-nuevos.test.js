/**
 * Formatos nuevos: texto plano y .properties.
 *
 * La regla de la casa para cualquier formato que abra Poanda: **abrir un
 * archivo y guardarlo sin traducir nada tiene que devolver el mismo archivo,
 * byte a byte**. Es la única forma de saber que no se está tirando en silencio
 * lo que el programa no ha sabido leer, que es como se pierden los comentarios
 * de un archivo o las formas de plural de un PO.
 *
 * Por eso los dos lectores reconstruyen sobre el archivo original en lugar de
 * escribirlo de nuevo: se recorre lo que vino y solo se sustituye lo traducido.
 */
import { describe, it, expect } from 'vitest';
import { parseTxtContent, reconstructTxt } from '../src/js/core/txt.js';
import { parsePropertiesContent, reconstructProperties } from '../src/js/core/properties.js';

describe('texto plano', () => {
    const TXT = `Primera línea
Segunda línea

    Con sangría
Última`;

    it('cada línea con contenido es un segmento', () => {
        const entradas = parseTxtContent(TXT);
        expect(entradas).toHaveLength(4);
        expect(entradas.map((e) => e.msgid)).toEqual([
            'Primera línea',
            'Segunda línea',
            'Con sangría',
            'Última',
        ]);
    });

    it('las líneas en blanco no son segmentos', () => {
        expect(parseTxtContent('uno\n\n\ndos')).toHaveLength(2);
    });

    it('abrir y guardar sin tocar nada devuelve el archivo igual', () => {
        expect(reconstructTxt(parseTxtContent(TXT), TXT)).toBe(TXT);
    });

    it('la traducción respeta la sangría de la línea', () => {
        const entradas = parseTxtContent(TXT);
        entradas[2].sentenceSegments[0].translation = 'Indented';
        expect(reconstructTxt(entradas, TXT)).toContain('    Indented');
    });

    it('una traducción con signos de dólar entra tal cual', () => {
        // String.replace interpreta "$&" como "lo que se ha encontrado": pasando
        // la traducción como cadena, "100 $&" saldría convertido en otra cosa.
        const texto = 'Price';
        const entradas = parseTxtContent(texto);
        entradas[0].sentenceSegments[0].translation = 'Precio $& $1';
        expect(reconstructTxt(entradas, texto)).toBe('Precio $& $1');
    });

    it('aguanta el archivo vacío', () => {
        expect(parseTxtContent('')).toEqual([]);
        expect(reconstructTxt([], '')).toBe('');
    });
});

describe('archivos .properties', () => {
    const PROPS = `# Textos de la interfaz
# No traduzcas las claves

boton.guardar=Guardar
boton.cancelar : Cancelar
mensaje.bienvenida=Hola,\\n¿qué tal?

! Otro comentario
menu.archivo=Archivo`;

    it('lee la clave y el valor', () => {
        const entradas = parsePropertiesContent(PROPS);
        expect(entradas).toHaveLength(4);
        expect(entradas[0].msgctxt).toBe('boton.guardar');
        expect(entradas[0].msgid).toBe('Guardar');
    });

    it('entiende los dos separadores', () => {
        const entradas = parsePropertiesContent(PROPS);
        expect(entradas[1].msgctxt).toBe('boton.cancelar');
        expect(entradas[1].msgid).toBe('Cancelar');
    });

    it('deshace los escapes al leer', () => {
        const entradas = parsePropertiesContent(PROPS);
        expect(entradas[2].msgid).toBe('Hola,\n¿qué tal?');
    });

    it('los comentarios no son segmentos', () => {
        const entradas = parsePropertiesContent(PROPS);
        expect(entradas.every((e) => !e.msgid.startsWith('#'))).toBe(true);
    });

    it('el comentario de encima se le engancha a la cadena como contexto', () => {
        // Conservarlos en el archivo no basta: si quien traduce no los ve, las
        // notas del programador ("máximo 20 caracteres") no sirven de nada.
        const conNotas = `# Botón de la barra principal
# Máximo 20 caracteres
boton.guardar=Save
boton.cancelar=Cancel`;

        const entradas = parsePropertiesContent(conNotas);
        expect(entradas[0].comments).toEqual([
            '# Botón de la barra principal',
            '# Máximo 20 caracteres',
        ]);
        // Y no se le pegan también a la siguiente.
        expect(entradas[1].comments).toEqual([]);
    });

    it('una línea en blanco corta la relación con el comentario', () => {
        // El encabezado del archivo no es una nota sobre la primera cadena:
        // colgárselo solo ensucia su etiqueta de contexto.
        const conEncabezado = `# Traducciones de la aplicación
# (c) 2026

boton.guardar=Save`;

        expect(parsePropertiesContent(conEncabezado)[0].comments).toEqual([]);
    });

    it('los comentarios enganchados no se escriben dos veces al guardar', () => {
        // Salen del archivo original, así que el escritor no tiene que ponerlos:
        // si además los escribiera, aparecerían duplicados.
        const conNotas = `# Una nota
boton.guardar=Save`;

        expect(reconstructProperties(parsePropertiesContent(conNotas), conNotas)).toBe(conNotas);
    });

    it('abrir y guardar sin tocar nada devuelve el archivo igual', () => {
        expect(reconstructProperties(parsePropertiesContent(PROPS), PROPS)).toBe(PROPS);
    });

    it('al traducir se conserva la clave y el separador de cada línea', () => {
        const entradas = parsePropertiesContent(PROPS);
        entradas[0].sentenceSegments[0].translation = 'Save';
        entradas[1].sentenceSegments[0].translation = 'Cancel';

        const salida = reconstructProperties(entradas, PROPS);
        expect(salida).toContain('boton.guardar=Save');
        // El que venía con ":" y espacios alrededor lo mantiene.
        expect(salida).toContain('boton.cancelar : Cancel');
    });

    it('los comentarios y las líneas en blanco siguen ahí después de traducir', () => {
        const entradas = parsePropertiesContent(PROPS);
        entradas[0].sentenceSegments[0].translation = 'Save';

        const salida = reconstructProperties(entradas, PROPS);
        expect(salida).toContain('# Textos de la interfaz');
        expect(salida).toContain('! Otro comentario');
        expect(salida.split('\n').filter((l) => l === '')).toHaveLength(2);
    });

    it('vuelve a escapar los saltos de línea de la traducción', () => {
        const entradas = parsePropertiesContent(PROPS);
        entradas[2].sentenceSegments[0].translation = 'Hi,\nhow are you?';
        expect(reconstructProperties(entradas, PROPS)).toContain(
            'mensaje.bienvenida=Hi,\\nhow are you?'
        );
    });

    it('lee un valor repartido en varias líneas', () => {
        const partido = `mensaje.largo=Esto es una frase \\
que sigue en la línea siguiente
otra.clave=Corta`;

        const entradas = parsePropertiesContent(partido);
        expect(entradas).toHaveLength(2);
        expect(entradas[0].msgid).toBe('Esto es una frase que sigue en la línea siguiente');
        expect(entradas[1].msgctxt).toBe('otra.clave');
    });

    it('un valor repartido vuelve igual si no se traduce', () => {
        const partido = `mensaje.largo=Esto es una frase \\
que sigue
otra.clave=Corta`;
        expect(reconstructProperties(parsePropertiesContent(partido), partido)).toBe(partido);
    });

    it('no confunde un separador escapado con el de la clave', () => {
        const conEscape = 'clave\\=rara=Valor';
        const [entrada] = parsePropertiesContent(conEscape);
        expect(entrada.msgctxt).toBe('clave\\=rara');
        expect(entrada.msgid).toBe('Valor');
    });

    it('aguanta el archivo vacío', () => {
        expect(parsePropertiesContent('')).toEqual([]);
        expect(reconstructProperties([], '')).toBe('');
    });
});
