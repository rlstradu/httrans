/**
 * Que no se quede nada sin traducir.
 *
 * Un texto sin traducir no falla: sale en el idioma en el que se escribió y
 * ahí se queda. El botón "Calcular" del planificador llevaba meses saliendo en
 * español con la interfaz en inglés porque su atributo estaba escrito
 * `data-i1admin` en vez de `data-i18n`: una letra de más y nadie se entera.
 *
 * Estas comprobaciones leen el HTML y los textos, y avisan de las tres maneras
 * en que esto se rompe: el atributo mal escrito, la clave que no existe, y la
 * clave que existe en un idioma y no en el otro.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { errorMessages, translations } from '../src/js/translations.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(AQUI, '..', 'src', 'index.html'), 'utf8');
const js = readFileSync(path.join(AQUI, '..', 'src', 'js', 'app.js'), 'utf8');

/** Los tres atributos que el traductor de la interfaz sabe leer. */
const ATRIBUTOS = ['data-i18n', 'data-i18n-placeholder', 'data-i18n-title'];

/** Todas las claves que se piden desde un atributo del HTML. */
function clavesDelHtml() {
    const claves = new Set();
    for (const attr of ATRIBUTOS) {
        for (const [, clave] of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) {
            claves.add(clave);
        }
    }
    return [...claves];
}

const existe = (clave) =>
    translations.en[clave] !== undefined || errorMessages.en[clave] !== undefined;

describe('los textos de la interfaz', () => {
    it('los dos idiomas tienen exactamente las mismas claves', () => {
        // Una clave que falta en un idioma sale como hueco en blanco: la
        // etiqueta desaparece y no queda ni rastro de qué había ahí.
        const en = Object.keys(translations.en);
        const es = Object.keys(translations.es);
        expect([...en].filter((k) => !es.includes(k))).toEqual([]);
        expect([...es].filter((k) => !en.includes(k))).toEqual([]);

        const errEn = Object.keys(errorMessages.en);
        const errEs = Object.keys(errorMessages.es);
        expect([...errEn].filter((k) => !errEs.includes(k))).toEqual([]);
        expect([...errEs].filter((k) => !errEn.includes(k))).toEqual([]);
    });

    it('ninguna traducción se ha quedado vacía', () => {
        for (const idioma of ['en', 'es']) {
            const vacias = Object.entries(translations[idioma])
                .filter(([, v]) => typeof v === 'string' && v.trim() === '')
                .map(([k]) => k);
            expect(vacias).toEqual([]);
        }
    });

    it('todas las claves que pide el HTML existen', () => {
        expect(clavesDelHtml().filter((clave) => !existe(clave))).toEqual([]);
    });

    it('no hay atributos de traducción mal escritos', () => {
        // Este es el que habría cazado el "Calcular": `data-i1admin` se parece
        // lo bastante a `data-i18n` como para no verlo al leer.
        const sospechosos = [...html.matchAll(/\sdata-i1[a-z0-9-]*="/gi)]
            .map((m) => m[0].trim().replace('="', ''))
            .filter((attr) => !ATRIBUTOS.includes(attr));
        expect(sospechosos).toEqual([]);
    });

    it('todas las claves que pide el código existen', () => {
        // Las que se piden desde JavaScript, con t.clave o t['clave'].
        const usadas = new Set();
        for (const [, clave] of js.matchAll(/\bt\.([a-z][a-z0-9_]*)\b/g)) usadas.add(clave);
        for (const [, clave] of js.matchAll(/\bt\['([^']+)'\]/g)) usadas.add(clave);
        for (const [, clave] of js.matchAll(
            /translations\[state\.currentLanguage\]\['([^']+)'\]/g,
        )) {
            usadas.add(clave);
        }
        expect([...usadas].filter((clave) => !existe(clave))).toEqual([]);
    });
});
