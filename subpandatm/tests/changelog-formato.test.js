/**
 * Cómo se presenta el changelog en la ventana de la herramienta.
 *
 * El archivo es texto plano pensado para leerse en un editor. Lo que se marca a
 * mano dentro es poco —código y negrita— y si no se reconoce sale con los
 * signos a la vista en medio de la frase.
 */
import { describe, expect, it } from 'vitest';
import { formatearChangelog } from '@core/changelog-formato.js';

const UNA_VERSION = (cuerpo) => `=========================================
subpandaTM v2.0.0 - Una versión
=========================================

Release Date: September 11, 2026

${cuerpo}
`;

describe('lo que se marca dentro del texto', () => {
    it('la negrita sale en negrita y no con los asteriscos puestos', () => {
        const html = formatearChangelog(UNA_VERSION('Aquí manda una **regla importante** y punto.'));
        expect(html).toContain('<strong>regla importante</strong>');
        expect(html).not.toContain('**');
    });

    it('y el código sigue saliendo como código', () => {
        const html = formatearChangelog(UNA_VERSION('Se escribe con un `if` y ya está.'));
        expect(html).toContain('<code>if</code>');
    });

    it('un asterisco suelto no se convierte en nada', () => {
        const html = formatearChangelog(UNA_VERSION('Dos por tres son seis, 2 * 3 = 6.'));
        expect(html).not.toContain('<strong>');
    });

    it('el título y la fecha de la versión se reconocen', () => {
        const html = formatearChangelog(UNA_VERSION('Lo que trae.'));
        expect(html).toContain('subpandaTM v2.0.0 - Una versión');
        expect(html).toContain('September 11, 2026');
    });
});

/**
 * Los changelogs nuevos van en Markdown de verdad (AGENTS.md §8.2). Los dos
 * formatos tienen que convivir mientras dure la migración, así que lo que se
 * comprueba aquí es tanto que el Markdown se entiende como que el de siempre
 * sigue entendiéndose.
 */
const EN_MARKDOWN = `# subpandaTM

## v2.0.0 — The Same Tools as Poanda

*Released 11 September 2026*

Version 2 rebuilds the tool on the same foundations as Poanda.

### Four Subtitle Formats

- Reads SRT, WebVTT, TTML and ASS.
- Gives every file back the way it came.

### Quality Checks

- Nineteen checks instead of three.

## v1.1.7 — Lo de antes

### Bug Fixes

- Se arregló una cosa.
`;

describe('los changelogs en Markdown', () => {
    const html = formatearChangelog(EN_MARKDOWN);

    it('cada versión sale como título de versión', () => {
        expect(html).toContain('<h3 class="cl-version">v2.0.0 — The Same Tools as Poanda</h3>');
        expect(html).toContain('<h3 class="cl-version">v1.1.7 — Lo de antes</h3>');
    });

    it('el nombre de la herramienta no se repite dentro de la ventana', () => {
        // Ya lo dice el botón que la ha abierto. En el archivo sí está, para
        // que se entienda al abrirlo en GitHub.
        expect(html).not.toContain('>subpandaTM<');
    });

    it('los apartados salen como apartados', () => {
        expect(html).toContain('<h4 class="cl-seccion">Four Subtitle Formats</h4>');
        expect(html).toContain('<h4 class="cl-seccion">Quality Checks</h4>');
    });

    it('la fecha en cursiva se reconoce como fecha', () => {
        expect(html).toContain('<p class="cl-fecha">Released 11 September 2026</p>');
    });

    it('la entradilla es un párrafo y no un punto de la lista', () => {
        expect(html).toContain('<p class="cl-entradilla">Version 2 rebuilds');
    });

    it('los puntos salen como lista, y cada lista se cierra', () => {
        expect(html).toContain('<li>Reads SRT, WebVTT, TTML and ASS.</li>');
        expect((html.match(/<ul class="cl-lista">/g) || []).length).toBe(
            (html.match(/<\/ul>/g) || []).length,
        );
    });

    it('un punto partido en dos renglones es un solo punto', () => {
        const partido = formatearChangelog(
            '# X\n\n## v1.0.0 — Y\n\n### Z\n\n- Una frase larga que no cabe\n  en un solo renglón del archivo.\n',
        );
        expect(partido).toContain('<li>Una frase larga que no cabe en un solo renglón del archivo.</li>');
    });

    it('un título nunca se queda pegado al texto de debajo', () => {
        const pegado = formatearChangelog('# X\n\n## v1.0.0 — Y\n### Z\nUn párrafo.\n');
        expect(pegado).toContain('<h4 class="cl-seccion">Z</h4>');
        expect(pegado).toContain('<p class="cl-entradilla">Un párrafo.</p>');
    });

    it('la cursiva de media frase sale en cursiva', () => {
        const html = formatearChangelog('# X\n\n## v1.0.0 — Y\n\n### Z\n\n- Esto va *así*.\n');
        expect(html).toContain('<em>así</em>');
    });

    it('y lo que venga del archivo no puede meter HTML', () => {
        const html = formatearChangelog('# X\n\n## v1.0.0 — Y\n\n### Z\n\n- <script>alert(1)</script>\n');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('un archivo antiguo no se confunde con uno nuevo', () => {
        // Alguna entrada vieja traía un `##` suelto en medio; si se mirara eso
        // en vez de la primera línea, el archivo entero se leería mal.
        const viejo = `=========================================
subpandaTM v1.1.6 - Lo de antes
=========================================

Release Date: December 12, 2025

## New Features & Improvements

Se hizo una cosa.
`;
        const html = formatearChangelog(viejo);
        expect(html).toContain('subpandaTM v1.1.6 - Lo de antes');
        expect(html).not.toContain('<h3 class="cl-version">#');
    });
});
