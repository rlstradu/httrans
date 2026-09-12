/**
 * Dar forma al changelog.
 *
 * El archivo es texto plano y la ventana lo enseñaba tal cual: un muro donde no
 * se distinguía el título de la versión del cuerpo, ni una novedad de la
 * siguiente. Estos tests fijan cómo se reconoce la estructura del archivo —qué
 * es un título de versión, qué un encabezado de sección y qué una novedad— y,
 * sobre todo, que no se pierda ni se invente texto por el camino.
 */
import { describe, it, expect } from 'vitest';
import { formatearChangelog } from '@core/changelog-formato.js';

const ENTRADA = [
    '=======================================',
    'Poanda v1.4.0 - A Cleaner Way In',
    'Release Date: September 7, 2026',
    '=======================================',
    '',
    'The way you open files has been reworked. Instead of a row of buttons there',
    'is now a single drop area.',
    '',
    'New',
    'Drop Area: The empty editor is now a place to drop files. Drag a file onto it,',
    'or click it to pick one from your computer.',
    '',
    'Simpler File Menu: "Load file" replaces the three separate load entries.',
    '',
    'Fixed',
    'The large buttons are gone. Everything they did is in the File menu now, and',
    'nothing was lost on the way.',
].join('\n');

describe('formatearChangelog', () => {
    it('saca el título de la versión de entre las rayas', () => {
        const html = formatearChangelog(ENTRADA);
        expect(html).toContain('<h3 class="cl-version">Poanda v1.4.0 - A Cleaner Way In</h3>');
        // Y las rayas no salen a la vista.
        expect(html).not.toContain('=====');
    });

    it('pone la fecha aparte, sin la etiqueta "Release Date"', () => {
        const html = formatearChangelog(ENTRADA);
        expect(html).toContain('<p class="cl-fecha">September 7, 2026</p>');
        expect(html).not.toContain('Release Date');
    });

    it('reconoce los encabezados de sección', () => {
        const html = formatearChangelog(ENTRADA);
        expect(html).toContain('<h4 class="cl-seccion">New</h4>');
        expect(html).toContain('<h4 class="cl-seccion">Fixed</h4>');
    });

    it('convierte cada novedad en un punto de la lista', () => {
        const html = formatearChangelog(ENTRADA);
        expect(html).toContain('<ul class="cl-lista">');
        expect((html.match(/<li>/g) || []).length).toBe(3);
    });

    it('destaca el nombre de la novedad cuando lo lleva delante', () => {
        const html = formatearChangelog(ENTRADA);
        expect(html).toContain('<li><strong>Drop Area</strong> The empty editor');
        expect(html).toContain('<li><strong>Simpler File Menu</strong>');
    });

    it('el resumen de la versión se queda como párrafo, no como punto', () => {
        // Va antes del primer encabezado y resume de qué va la versión: leído
        // como punto de una lista parecería una novedad más.
        const html = formatearChangelog(ENTRADA);
        expect(html).toContain('<p class="cl-entradilla">The way you open files');
    });

    it('no parte por los dos puntos de mitad de frase', () => {
        const entrada = [
            'New',
            'This is a long sentence with a colon in the middle: and it carries on well',
            'past the point where a title would have stopped.',
        ].join('\n');

        const html = formatearChangelog(entrada);
        expect(html).not.toContain('<strong>');
    });

    it('las listas que ya venían escritas pierden su marca', () => {
        const entrada = ['Under the Hood', '* Primera cosa.', '1. Segunda cosa.'].join('\n');
        const html = formatearChangelog(entrada);

        expect(html).toContain('<li>Primera cosa.</li>');
        expect(html).toContain('<li>Segunda cosa.</li>');
    });

    it('escapa el HTML que venga en el texto', () => {
        const entrada = ['New', 'Tags: se admite <script>alert(1)</script> como texto.'].join('\n');
        const html = formatearChangelog(entrada);

        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('marca como código lo que va entre acentos graves', () => {
        const entrada = ['New', 'Abre el archivo `poanda.html` en el navegador.'].join('\n');
        expect(formatearChangelog(entrada)).toContain('<code>poanda.html</code>');
    });

    it('aguanta el texto vacío', () => {
        expect(formatearChangelog('')).toBe('');
        expect(formatearChangelog('   \n\n  ')).toBe('');
    });

    it('no pierde ni una palabra del texto original', () => {
        // La red de seguridad: se puede discutir qué es título y qué es punto,
        // pero el contenido tiene que llegar entero.
        const html = formatearChangelog(ENTRADA);
        const soloTexto = html
            .replace(/<[^>]+>/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&');

        // Los dos puntos del nombre de cada novedad sí desaparecen: los
        // sustituye la negrita, así que se ignoran al comparar.
        const palabras = (t) =>
            t
                .split(/\s+/)
                .filter(Boolean)
                .map((p) => p.replace(/:$/, ''));
        const esperadas = palabras(ENTRADA)
            .filter((p) => !/^[=]{3,}$/.test(p))
            .filter((p) => !['Release', 'Date'].includes(p));

        expect(palabras(soloTexto)).toEqual(esperadas);
    });

    it('cierra las listas antes de empezar otra sección', () => {
        // Un <ul> sin cerrar se lleva por delante todo lo que venga detrás.
        const html = formatearChangelog(ENTRADA);
        expect((html.match(/<ul/g) || []).length).toBe((html.match(/<\/ul>/g) || []).length);
    });
});
