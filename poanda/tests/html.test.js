/**
 * Páginas web.
 *
 * El lector de HTML era el último que reescribía el archivo entero al guardar:
 * abría la página con el analizador del navegador y la volvía a escribir desde
 * el árbol resultante. Salían miles de líneas cambiadas —otra sangría, otro
 * orden de atributos, otras comillas— aunque solo se hubieran traducido dos
 * frases, y quien recibe la página no tenía forma de ver qué se había tocado.
 *
 * Ahora se sustituye solo el texto traducido, como en el resto de formatos.
 */
import { describe, it, expect } from 'vitest';
import { parseHtmlProject, reconstructHtml } from '../src/js/core/html-doc.js';

const PAGINA = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>The Quick Report</title>
    <meta name="description" content="Everything about the report">
    <style>body { margin: 0 }</style>
</head>
<body>
    <h1 class="titulo">Welcome</h1>
    <p>Press <strong>Save</strong> to finish.</p>
    <img src="foto.png" alt="The toolbar">
    <ul>
        <li>First item</li>
        <li>Second item</li>
    </ul>
    <script>console.log("no traducir");</script>
</body>
</html>`;

/** Traduce el segmento cuyo original se indica. */
function traducir(entradas, original, texto) {
    const entrada = entradas.find((e) => e.msgid === original);
    entrada.sentenceSegments[0].translation = texto;
    return entradas;
}

describe('leer una página', () => {
    it('los bloques con texto son segmentos', () => {
        const textos = parseHtmlProject(PAGINA).map((e) => e.msgid);
        expect(textos).toContain('Welcome');
        expect(textos).toContain('First item');
        expect(textos).toContain('The Quick Report');
    });

    it('el formato de dentro de la frase se queda dentro del segmento', () => {
        // Partir la frase en "Press", "Save" y "to finish" sería traducir a
        // ciegas; la negrita viaja como etiqueta y se coloca donde toque.
        expect(parseHtmlProject(PAGINA).map((e) => e.msgid)).toContain(
            'Press <strong>Save</strong> to finish.'
        );
    });

    it('el texto alternativo y la descripción también se traducen', () => {
        const textos = parseHtmlProject(PAGINA).map((e) => e.msgid);
        expect(textos).toContain('The toolbar');
        expect(textos).toContain('Everything about the report');
    });

    it('el código y los estilos no', () => {
        const textos = parseHtmlProject(PAGINA).map((e) => e.msgid);
        expect(textos.some((t) => t.includes('console.log'))).toBe(false);
        expect(textos.some((t) => t.includes('margin'))).toBe(false);
    });

    it('los segmentos salen en el orden en que se leen', () => {
        const textos = parseHtmlProject(PAGINA).map((e) => e.msgid);
        expect(textos.indexOf('The Quick Report')).toBeLessThan(textos.indexOf('Welcome'));
        expect(textos.indexOf('First item')).toBeLessThan(textos.indexOf('Second item'));
    });
});

describe('guardar una página', () => {
    it('abrir y guardar sin traducir devuelve la página igual', () => {
        expect(reconstructHtml(parseHtmlProject(PAGINA), PAGINA)).toBe(PAGINA);
    });

    it('solo cambia el texto traducido', () => {
        const entradas = traducir(parseHtmlProject(PAGINA), 'Welcome', 'Bienvenido');
        const salida = reconstructHtml(entradas, PAGINA);

        expect(salida).toContain('<h1 class="titulo">Bienvenido</h1>');
        // Lo demás está exactamente como estaba: la clase, la sangría, el
        // código y hasta el orden de las etiquetas del encabezado.
        expect(salida).toContain('<meta charset="utf-8">');
        expect(salida).toContain('<style>body { margin: 0 }</style>');
        expect(salida.split('\n')).toHaveLength(PAGINA.split('\n').length);
    });

    it('la etiqueta de dentro de la frase se puede mover al traducir', () => {
        const entradas = traducir(
            parseHtmlProject(PAGINA),
            'Press <strong>Save</strong> to finish.',
            'Para terminar, pulsa <strong>Guardar</strong>.'
        );
        expect(reconstructHtml(entradas, PAGINA)).toContain(
            '<p>Para terminar, pulsa <strong>Guardar</strong>.</p>'
        );
    });

    it('la traducción de un atributo se escapa como atributo', () => {
        const entradas = traducir(parseHtmlProject(PAGINA), 'The toolbar', 'La barra "principal"');
        expect(reconstructHtml(entradas, PAGINA)).toContain(
            'alt="La barra &quot;principal&quot;"'
        );
    });

    it('un "&" escrito en la traducción no rompe la página', () => {
        const entradas = traducir(parseHtmlProject(PAGINA), 'Welcome', 'Ana & Luis');
        expect(reconstructHtml(entradas, PAGINA)).toContain('<h1 class="titulo">Ana &amp; Luis');
    });

    it('un proyecto guardado antes de este cambio se sigue exportando', () => {
        // Aquellos segmentos no traían la posición en el archivo. Sin este
        // rescate, exportar devolvería la página sin ninguna traducción y sin
        // decir por qué.
        const antiguas = parseHtmlProject(PAGINA).map(({ valorInicio, valorFin, ...resto }) => resto);
        traducir(antiguas, 'Welcome', 'Bienvenido');

        expect(reconstructHtml(antiguas, PAGINA)).toContain('>Bienvenido</h1>');
    });

    it('aguanta la página vacía', () => {
        expect(parseHtmlProject('')).toEqual([]);
        expect(reconstructHtml([], '')).toBe('');
    });
});
