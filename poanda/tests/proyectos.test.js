/**
 * Almacén de proyectos: segmentos como filas independientes.
 *
 * Lo que se comprueba aquí, en orden de importancia:
 *
 * 1. Que un archivo abierto y guardado vuelve exactamente igual (ida y vuelta).
 * 2. Que guardar una traducción escribe UNA fila y no el proyecto entero, que es
 *    la razón de ser de todo este cambio.
 * 3. Que la actualización desde la versión anterior no pierde la copia de
 *    seguridad que alguien pudiera tener a medias.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENTRADAS = [
    {
        comments: ['# Copyright (C) 2025'],
        msgid: '',
        msgstr: 'Project-Id-Version: ejemplo\nLanguage: es\n',
        isHeader: true,
        fuzzy: false,
        sentenceSegments: [
            {
                original: '',
                translation: '',
                wordCountOriginal: 0,
                wordCountTranslation: 0,
                isTranslated: false,
            },
        ],
    },
    {
        comments: ['#: admin.php:42'],
        msgctxt: 'menu',
        msgid: 'Settings',
        msgstr: 'Ajustes',
        isHeader: false,
        fuzzy: false,
        sentenceSegments: [
            {
                original: 'Settings',
                translation: 'Ajustes',
                wordCountOriginal: 1,
                wordCountTranslation: 1,
                isTranslated: true,
            },
        ],
    },
    {
        comments: ['#, fuzzy', '#: admin.php:88'],
        msgid: 'Save changes',
        msgstr: '',
        isHeader: false,
        fuzzy: true,
        sentenceSegments: [
            {
                original: 'Save changes',
                translation: '',
                wordCountOriginal: 2,
                wordCountTranslation: 0,
                isTranslated: false,
            },
        ],
    },
];

let db;
let proyectos;

beforeEach(async () => {
    vi.resetModules();
    db = (await import('../src/js/db.js')).db;
    proyectos = await import('../src/js/projects.js');
});

afterEach(async () => {
    await db?.close();
    await new Promise((resolve) => {
        const borrado = indexedDB.deleteDatabase('PoandaBackup');
        borrado.onsuccess = resolve;
        borrado.onerror = resolve;
        borrado.onblocked = resolve;
    });
});

/** Crea un proyecto de ejemplo y devuelve su identificador. */
async function crearEjemplo(extra = {}) {
    return proyectos.crearProyecto({
        fileName: 'mi-plugin-es_ES.po',
        format: 'po',
        entradas: ENTRADAS,
        sourceLang: 'en',
        targetLang: 'es',
        ...extra,
    });
}

describe('separar y reunir entradas', () => {
    it('reunir deshace lo que hace separar', () => {
        const { meta, segmentos } = proyectos.separarEntradas(ENTRADAS);
        const vueltas = proyectos.reunirEntradas(meta, segmentos);

        expect(vueltas).toEqual(ENTRADAS);
    });

    it('separa un segmento por cada unidad traducible', () => {
        const { meta, segmentos } = proyectos.separarEntradas(ENTRADAS);
        expect(meta).toHaveLength(3);
        expect(segmentos).toHaveLength(3);
    });

    it('aguanta entradas con varios segmentos por frase', () => {
        const entrada = [
            {
                comments: [],
                msgid: 'One. Two.',
                msgstr: 'Uno. Dos.',
                isHeader: false,
                fuzzy: false,
                sentenceSegments: [
                    {
                        original: 'One. ',
                        translation: 'Uno. ',
                        wordCountOriginal: 1,
                        wordCountTranslation: 1,
                        isTranslated: true,
                    },
                    {
                        original: 'Two.',
                        translation: 'Dos.',
                        wordCountOriginal: 1,
                        wordCountTranslation: 1,
                        isTranslated: true,
                    },
                ],
            },
        ];
        const { meta, segmentos } = proyectos.separarEntradas(entrada);
        expect(segmentos).toHaveLength(2);
        expect(proyectos.reunirEntradas(meta, segmentos)).toEqual(entrada);
    });

    it('no se lía si los segmentos llegan desordenados', () => {
        const { meta, segmentos } = proyectos.separarEntradas(ENTRADAS);
        const desordenados = [...segmentos].reverse();
        expect(proyectos.reunirEntradas(meta, desordenados)).toEqual(ENTRADAS);
    });

    it('conserva los datos propios de cada formato', () => {
        // Cada formato trae lo suyo para saber devolver el texto a su sitio: de
        // qué línea salía, de qué párrafo, con qué estilo. Si el guardado del
        // proyecto los filtrara, el archivo se abriría bien y se exportaría mal.
        const conDatosPropios = [
            {
                comments: [],
                msgid: 'Save',
                msgctxt: 'boton.guardar',
                fuzzy: false,
                isHeader: false,
                lineaOriginal: 12,
                lineasOcupadas: 2,
                structureKind: 'heading',
                structureLevel: 2,
                sentenceSegments: [
                    {
                        original: 'Save',
                        translation: 'Guardar',
                        wordCountOriginal: 1,
                        wordCountTranslation: 1,
                        isTranslated: true,
                    },
                ],
            },
        ];

        const { meta, segmentos } = proyectos.separarEntradas(conDatosPropios);
        const vueltas = proyectos.reunirEntradas(meta, segmentos);

        expect(vueltas[0].lineaOriginal).toBe(12);
        expect(vueltas[0].lineasOcupadas).toBe(2);
        expect(vueltas[0].structureKind).toBe('heading');
        expect(vueltas[0].structureLevel).toBe(2);
    });

    it('conserva las entradas con formas de plural', () => {
        // Guardar el proyecto y volver a abrirlo tiene que devolver también el
        // original en plural: sin él, el archivo que se genere al guardar ya no
        // será un archivo con plurales aunque las traducciones sigan ahí.
        const conPlural = [
            {
                comments: [],
                msgid: 'One file',
                msgidPlural: '%d files',
                fuzzy: false,
                isHeader: false,
                sentenceSegments: [
                    {
                        original: 'One file',
                        translation: 'Un archivo',
                        wordCountOriginal: 2,
                        wordCountTranslation: 2,
                        isTranslated: true,
                        formaPlural: 0,
                    },
                    {
                        original: '%d files',
                        translation: '%d archivos',
                        wordCountOriginal: 2,
                        wordCountTranslation: 2,
                        isTranslated: true,
                        formaPlural: 1,
                    },
                ],
            },
        ];

        const { meta, segmentos } = proyectos.separarEntradas(conPlural);
        const vueltas = proyectos.reunirEntradas(meta, segmentos);

        expect(vueltas[0].msgidPlural).toBe('%d files');
        expect(vueltas[0].sentenceSegments.map((s) => s.translation)).toEqual([
            'Un archivo',
            '%d archivos',
        ]);
        // Y sin msgstr suelto, que junto a las formas dejaría el archivo inválido.
        expect(vueltas[0].msgstr).toBeUndefined();
    });
});

describe('crear y abrir un proyecto', () => {
    it('un proyecto abierto y guardado vuelve exactamente igual', async () => {
        const id = await crearEjemplo();
        const abierto = await proyectos.abrirProyecto(id);

        expect(abierto.fileName).toBe('mi-plugin-es_ES.po');
        expect(abierto.format).toBe('po');
        expect(abierto.entradas).toEqual(ENTRADAS);
    });

    it('guarda un segmento por cada unidad traducible', async () => {
        const id = await crearEjemplo();
        expect(await db.segments.where('projectId').equals(id).count()).toBe(3);
    });

    it('conserva el HTML original en los proyectos HTML', async () => {
        const id = await crearEjemplo({ format: 'html', rawHtml: '<html><p>Hi</p></html>' });
        expect((await proyectos.abrirProyecto(id)).rawHtml).toBe('<html><p>Hi</p></html>');
    });

    it('el comentario que escribe quien traduce sigue ahí al volver a abrir', async () => {
        // La nota vive con el proyecto, no en el archivo: si no se guardara
        // aquí, cerrar la pestaña se la llevaría, y una nota que se pierde es
        // peor que no poder escribirla.
        const id = await crearEjemplo();
        const fila = await db.segments
            .where('projectId')
            .equals(id)
            .and((s) => s.entryIndex === 1)
            .first();
        await db.segments.update(fila.id, { nota: 'Preguntar al cliente si es "Ajustes"' });

        const abierto = await proyectos.abrirProyecto(id);
        expect(abierto.entradas[1].sentenceSegments[0].nota).toBe(
            'Preguntar al cliente si es "Ajustes"',
        );
    });

    it('el segmento sin comentario no se inventa uno vacío', async () => {
        const id = await crearEjemplo();
        const abierto = await proyectos.abrirProyecto(id);
        expect(abierto.entradas[1].sentenceSegments[0]).not.toHaveProperty('nota');
    });

    it('devuelve null si el proyecto no existe', async () => {
        expect(await proyectos.abrirProyecto(9999)).toBeNull();
    });

    it('dos proyectos no se pisan entre sí', async () => {
        const uno = await crearEjemplo({ fileName: 'uno.po' });
        const dos = await crearEjemplo({ fileName: 'dos.po' });

        await proyectos.guardarTraduccion(uno, 1, 0, 'Cambiado en el primero');

        expect((await proyectos.abrirProyecto(uno)).entradas[1].msgstr).toBe(
            'Cambiado en el primero',
        );
        expect((await proyectos.abrirProyecto(dos)).entradas[1].msgstr).toBe('Ajustes');
    });
});

describe('guardar una traducción', () => {
    it('escribe la traducción del segmento indicado', async () => {
        const id = await crearEjemplo();
        await proyectos.guardarTraduccion(id, 2, 0, 'Guardar cambios');

        const abierto = await proyectos.abrirProyecto(id);
        expect(abierto.entradas[2].msgstr).toBe('Guardar cambios');
        expect(abierto.entradas[2].sentenceSegments[0].isTranslated).toBe(true);
    });

    it('no toca los demás segmentos', async () => {
        const id = await crearEjemplo();
        const antes = await db.segments.where('projectId').equals(id).sortBy('entryIndex');

        await proyectos.guardarTraduccion(id, 2, 0, 'Guardar cambios');

        const despues = await db.segments.where('projectId').equals(id).sortBy('entryIndex');
        expect(despues[0]).toEqual(antes[0]);
        expect(despues[1]).toEqual(antes[1]);
        expect(despues[2].translation).toBe('Guardar cambios');
    });

    it('vaciar una traducción la marca como no traducida', async () => {
        const id = await crearEjemplo();
        await proyectos.guardarTraduccion(id, 1, 0, '   ');

        const abierto = await proyectos.abrirProyecto(id);
        expect(abierto.entradas[1].sentenceSegments[0].isTranslated).toBe(false);
    });

    it('actualiza la fecha de última modificación del proyecto', async () => {
        const id = await crearEjemplo();
        const antes = (await db.projects.get(id)).lastModified;

        await new Promise((r) => setTimeout(r, 5));
        await proyectos.guardarTraduccion(id, 1, 0, 'Otra cosa');

        expect((await db.projects.get(id)).lastModified).toBeGreaterThan(antes);
    });

    it('no falla si el segmento no existe', async () => {
        const id = await crearEjemplo();
        await expect(proyectos.guardarTraduccion(id, 99, 0, 'x')).resolves.toBeUndefined();
    });
});

describe('proyectos recientes', () => {
    it('los ordena del más reciente al más antiguo', async () => {
        const primero = await crearEjemplo({ fileName: 'primero.po' });
        await new Promise((r) => setTimeout(r, 5));
        await crearEjemplo({ fileName: 'segundo.po' });
        await new Promise((r) => setTimeout(r, 5));
        await proyectos.guardarTraduccion(primero, 1, 0, 'Toco el primero');

        const recientes = await proyectos.listarRecientes();
        expect(recientes[0].fileName).toBe('primero.po');
        expect(recientes[1].fileName).toBe('segundo.po');
    });

    it('devuelve solo los datos de cabecera, sin los segmentos', async () => {
        await crearEjemplo();
        const [reciente] = await proyectos.listarRecientes();

        expect(reciente).toHaveProperty('fileName');
        expect(reciente).toHaveProperty('lastModified');
        expect(reciente).not.toHaveProperty('entriesMeta');
    });

    it('no devuelve más de los que se le piden', async () => {
        for (let i = 0; i < 8; i++) {
            await crearEjemplo({ fileName: `archivo-${i}.po` });
        }
        expect(await proyectos.listarRecientes(3)).toHaveLength(3);
    });

    it('con la base vacía devuelve una lista vacía', async () => {
        expect(await proyectos.listarRecientes()).toEqual([]);
    });
});

describe('limpieza de proyectos viejos', () => {
    it('conserva los más recientes y borra el resto', async () => {
        for (let i = 0; i < 8; i++) {
            await crearEjemplo({ fileName: `archivo-${i}.po` });
            await new Promise((r) => setTimeout(r, 2));
        }

        const borrados = await proyectos.podarProyectosViejos(5);

        expect(borrados).toBe(3);
        expect(await db.projects.count()).toBe(5);
        const quedan = (await proyectos.listarRecientes(10)).map((p) => p.fileName);
        expect(quedan).toContain('archivo-7.po');
        expect(quedan).not.toContain('archivo-0.po');
    });

    it('al borrar un proyecto se lleva sus segmentos', async () => {
        const id = await crearEjemplo();
        expect(await db.segments.where('projectId').equals(id).count()).toBe(3);

        await proyectos.borrarProyecto(id);

        expect(await db.segments.where('projectId').equals(id).count()).toBe(0);
        expect(await proyectos.abrirProyecto(id)).toBeNull();
    });

    it('borrar un proyecto no toca los demás', async () => {
        const uno = await crearEjemplo({ fileName: 'uno.po' });
        const dos = await crearEjemplo({ fileName: 'dos.po' });

        await proyectos.borrarProyecto(uno);

        expect(await proyectos.abrirProyecto(dos)).not.toBeNull();
        expect(await db.segments.where('projectId').equals(dos).count()).toBe(3);
    });
});

describe('avance del proyecto', () => {
    it('cuenta los segmentos traducidos sin cargar el proyecto', async () => {
        const id = await crearEjemplo();
        // Son tres entradas, pero la primera es la cabecera del archivo y no
        // cuenta: quedan dos cadenas traducibles, una ya traducida.
        expect(await proyectos.progresoDe(id)).toEqual({ total: 2, traducidos: 1 });

        await proyectos.guardarTraduccion(id, 2, 0, 'Guardar cambios');
        expect(await proyectos.progresoDe(id)).toEqual({ total: 2, traducidos: 2 });
    });
});

describe('actualización desde la versión anterior', () => {
    it('la copia de seguridad del formato antiguo sigue ahí', async () => {
        // Alguien tenía una sesión guardada con el formato de la v1.2.0 y
        // actualiza a la versión con proyectos: no puede perderla.
        await db.session.put({
            id: 'currentSession',
            poEntries: ENTRADAS,
            currentFileName: 'a-medias.po',
        });

        const recuperada = await db.session.get('currentSession');
        expect(recuperada.currentFileName).toBe('a-medias.po');
        expect(recuperada.poEntries).toHaveLength(3);
    });

    it('las tablas nuevas conviven con la vieja', async () => {
        await db.session.put({ id: 'currentSession', poEntries: ENTRADAS });
        const id = await crearEjemplo();

        expect(await db.session.count()).toBe(1);
        expect(await db.projects.count()).toBe(1);
        expect((await proyectos.abrirProyecto(id)).entradas).toEqual(ENTRADAS);
    });

    it('la base declara la versión 2', async () => {
        await db.open();
        expect(db.verno).toBe(2);
    });
});
