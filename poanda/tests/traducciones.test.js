/**
 * El diccionario de la interfaz.
 *
 * Poanda habla dos idiomas, y la clase de fallo que se cuela aquí no se ve al
 * probar la herramienta: se ve cuando alguien cambia a español y encuentra una
 * palabra en inglés, o un mensaje que dice "undefined". Son fallos que no
 * rompen nada y por eso se quedan meses.
 *
 * Estos tests miran tres cosas:
 *
 * 1. Que los dos idiomas tengan exactamente las mismas claves. Que falte una en
 *    español significa que ahí sale texto en inglés (o nada).
 * 2. Que toda clave que alguien pide exista. Pedir una que no está deja al
 *    usuario un hueco vacío o el nombre interno de la clave a la vista.
 * 3. Que no queden textos visibles escritos a mano en un idioma dentro del
 *    código, que es por donde se coló el "segments" de la barra de estado.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translations } from '../src/js/translations.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUENTE = path.resolve(AQUI, '../src');

/** Todos los archivos con una extensión, recorriendo las carpetas. */
function archivos(carpeta, extension, encontrados = []) {
    for (const nombre of readdirSync(carpeta)) {
        const ruta = path.join(carpeta, nombre);
        if (statSync(ruta).isDirectory()) archivos(ruta, extension, encontrados);
        else if (ruta.endsWith(extension)) encontrados.push(ruta);
    }
    return encontrados;
}

const html = readFileSync(path.join(FUENTE, 'index.html'), 'utf8');
const modulos = archivos(path.join(FUENTE, 'js'), '.js').map((ruta) => ({
    nombre: path.relative(FUENTE, ruta),
    texto: readFileSync(ruta, 'utf8'),
}));

/**
 * Las claves que alguien pide en algún sitio.
 *
 * Solo se recogen las que se piden por su nombre entero. Las que se arman sobre
 * la marcha (`pos_${categoria}`, `formato_${id}`) no se pueden ver desde aquí,
 * y por eso el test de claves sin usar no existe: daría falsos positivos.
 */
function clavesPedidas() {
    const pedidas = new Map();
    const anotar = (clave, donde) => {
        if (!pedidas.has(clave)) pedidas.set(clave, new Set());
        pedidas.get(clave).add(donde);
    };

    for (const m of html.matchAll(/data-i18n(?:-title|-placeholder)?="([\w.]+)"/g)) {
        anotar(m[1], 'index.html');
    }

    for (const { nombre, texto } of modulos) {
        // translations[loQueSea]['clave'] y t('clave'), que son las dos formas
        // que se usan en el proyecto.
        for (const m of texto.matchAll(/translations\[[^\]]+\]\??\.?\[['"]([\w.]+)['"]\]/g)) {
            anotar(m[1], nombre);
        }
        for (const m of texto.matchAll(/\bt\(\s*['"]([\w.]+)['"]\s*\)/g)) {
            anotar(m[1], nombre);
        }
        for (const m of texto.matchAll(/data-i18n(?:-title|-placeholder)?="([\w.]+)"/g)) {
            anotar(m[1], nombre);
        }
    }

    return pedidas;
}

describe('los dos idiomas dicen lo mismo', () => {
    it('tienen exactamente las mismas claves', () => {
        const en = Object.keys(translations.en);
        const es = Object.keys(translations.es);

        expect(en.filter((k) => !translations.es[k]).join(', ')).toBe('');
        expect(es.filter((k) => !translations.en[k]).join(', ')).toBe('');
        expect(es.length).toBe(en.length);
    });

    it('ninguna entrada está vacía', () => {
        for (const idioma of ['en', 'es']) {
            const vacias = Object.entries(translations[idioma])
                .filter(([, valor]) => String(valor).trim() === '')
                .map(([clave]) => clave);
            expect(vacias, `vacías en ${idioma}`).toEqual([]);
        }
    });

    it('los textos con huecos llevan los mismos huecos en los dos idiomas', () => {
        // Un {hechos} que se pierda al traducir deja un mensaje sin el dato.
        for (const [clave, valorEn] of Object.entries(translations.en)) {
            const huecos = (cadena) => (String(cadena).match(/\{\w+\}/g) || []).sort().join(' ');
            expect(huecos(translations.es[clave]), `huecos de ${clave}`).toBe(huecos(valorEn));
        }
    });
});

describe('todo lo que se pide existe', () => {
    it('no se pide ninguna clave que no esté en el diccionario', () => {
        const rotas = [];
        for (const [clave, donde] of clavesPedidas()) {
            const faltan = ['en', 'es'].filter((idioma) => !(clave in translations[idioma]));
            if (faltan.length) {
                rotas.push(`${clave} (falta en ${faltan.join(' y ')}) ← ${[...donde].join(', ')}`);
            }
        }
        expect(rotas).toEqual([]);
    });
});

describe('nada visible escrito a mano en un idioma', () => {
    /**
     * Un texto es "a mano" si son varias palabras seguidas y no sale del
     * diccionario. Una plantilla que mete dentro `translations[...]` sí sale de
     * él, aunque tenga texto alrededor, así que no cuenta.
     */
    const esTextoAMano = (cadena) =>
        !cadena.includes('${') && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){2,}/.test(cadena);

    it('los mensajes al usuario salen del diccionario', () => {
        // showMessage('Algo escrito aquí') es un mensaje que solo existe en un
        // idioma: quien tenga la herramienta en el otro lo ve igual.
        const sueltos = [];
        for (const { nombre, texto } of modulos) {
            for (const m of texto.matchAll(/showMessage\(\s*(['"`])([^'"`]{4,})\1/g)) {
                if (esTextoAMano(m[2])) sueltos.push(`${nombre}: ${m[2].slice(0, 50)}`);
            }
        }
        expect(sueltos).toEqual([]);
    });

    it('lo que se escribe en la pantalla tampoco', () => {
        // textContent = 'Frase con varias palabras' es lo mismo por otra vía.
        // Así se coló el "Cargando changelog..." y el "segments" de la barra.
        const sueltos = [];
        for (const { nombre, texto } of modulos) {
            const busca = /\.(?:textContent|placeholder|title)\s*=\s*(['"`])([^'"`]{6,})\1/g;
            for (const m of texto.matchAll(busca)) {
                if (esTextoAMano(m[2])) sueltos.push(`${nombre}: ${m[2].slice(0, 50)}`);
            }
        }
        expect(sueltos).toEqual([]);
    });
});
