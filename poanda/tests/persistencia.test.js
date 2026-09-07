/**
 * Sincronización entre el editor y la base de datos.
 *
 * Este módulo decide qué se escribe y qué no, así que un fallo aquí significa
 * perder traducciones. Lo que se comprueba:
 *
 * 1. Que se escribe lo que ha cambiado.
 * 2. Que NO se escribe lo que no ha cambiado (que es la razón de ser del módulo).
 * 3. Que un fallo al guardar no rompe el editor ni pierde lo que hay en memoria.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Construye una entrada del editor como las que produce el lector de PO. */
function entrada(msgid, traduccion = '', extra = {}) {
    return {
        comments: [],
        msgid,
        msgstr: traduccion,
        isHeader: false,
        fuzzy: false,
        sentenceSegments: [
            {
                original: msgid,
                translation: traduccion,
                wordCountOriginal: msgid.split(/\s+/).filter(Boolean).length,
                wordCountTranslation: traduccion.split(/\s+/).filter(Boolean).length,
                isTranslated: traduccion.trim() !== '',
            },
        ],
        ...extra,
    };
}

let db;
let state;
let persistencia;
let proyectos;

beforeEach(async () => {
    vi.resetModules();
    db = (await import('../src/js/db.js')).db;
    state = (await import('../src/js/state.js')).state;
    persistencia = await import('../src/js/persistencia.js');
    proyectos = await import('../src/js/projects.js');

    state.poEntries = [entrada('Settings', 'Ajustes'), entrada('Save'), entrada('Delete')];
    state.projectId = null;
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

describe('registrar el archivo que se abre', () => {
    it('crea el proyecto y lo deja apuntado en el estado', async () => {
        const id = await persistencia.registrarProyectoAbierto({
            fileName: 'plugin.po',
            format: 'po',
        });

        expect(id).toBeGreaterThan(0);
        expect(state.projectId).toBe(id);
        expect((await db.projects.get(id)).fileName).toBe('plugin.po');
        expect(await db.segments.where('projectId').equals(id).count()).toBe(3);
    });

    it('guarda el HTML original en los proyectos HTML', async () => {
        const id = await persistencia.registrarProyectoAbierto({
            fileName: 'pagina.html',
            format: 'html',
            rawHtml: '<html><p>Hola</p></html>',
        });
        expect((await db.projects.get(id)).rawHtml).toBe('<html><p>Hola</p></html>');
    });
});

describe('sincronizar los cambios', () => {
    beforeEach(async () => {
        await persistencia.registrarProyectoAbierto({ fileName: 'plugin.po', format: 'po' });
    });

    it('no escribe nada si no se ha tocado nada', async () => {
        expect(await persistencia.sincronizarCambios()).toBe(0);
    });

    it('escribe solo el segmento que ha cambiado', async () => {
        state.poEntries[1].sentenceSegments[0].translation = 'Guardar';

        expect(await persistencia.sincronizarCambios()).toBe(1);

        const abierto = await proyectos.abrirProyecto(state.projectId);
        expect(abierto.entradas[1].msgstr).toBe('Guardar');
        expect(abierto.entradas[0].msgstr).toBe('Ajustes');
        expect(abierto.entradas[2].msgstr).toBe('');
    });

    it('deja intactas las filas de los segmentos no tocados', async () => {
        const antes = await db.segments
            .where('projectId')
            .equals(state.projectId)
            .sortBy('entryIndex');

        state.poEntries[1].sentenceSegments[0].translation = 'Guardar';
        await persistencia.sincronizarCambios();

        const despues = await db.segments
            .where('projectId')
            .equals(state.projectId)
            .sortBy('entryIndex');
        expect(despues[0]).toEqual(antes[0]);
        expect(despues[2]).toEqual(antes[2]);
    });

    it('sincronizar dos veces seguidas no vuelve a escribir', async () => {
        state.poEntries[1].sentenceSegments[0].translation = 'Guardar';

        expect(await persistencia.sincronizarCambios()).toBe(1);
        expect(await persistencia.sincronizarCambios()).toBe(0);
    });

    it('escribe varios segmentos cuando se cambian varios', async () => {
        state.poEntries[1].sentenceSegments[0].translation = 'Guardar';
        state.poEntries[2].sentenceSegments[0].translation = 'Borrar';

        expect(await persistencia.sincronizarCambios()).toBe(2);
    });

    it('borrar una traducción también se guarda', async () => {
        state.poEntries[0].sentenceSegments[0].translation = '';

        expect(await persistencia.sincronizarCambios()).toBe(1);

        const abierto = await proyectos.abrirProyecto(state.projectId);
        expect(abierto.entradas[0].msgstr).toBe('');
        expect(abierto.entradas[0].sentenceSegments[0].isTranslated).toBe(false);
    });

    it('actualiza el recuento de palabras junto con el texto', async () => {
        state.poEntries[1].sentenceSegments[0].translation = 'Guardar los cambios';
        state.poEntries[1].sentenceSegments[0].wordCountTranslation = 3;
        await persistencia.sincronizarCambios();

        const fila = await db.segments
            .where('projectId')
            .equals(state.projectId)
            .and((s) => s.entryIndex === 1)
            .first();
        expect(fila.wordCountTranslation).toBe(3);
    });

    it('actualiza la fecha del proyecto solo cuando hay cambios', async () => {
        const original = (await db.projects.get(state.projectId)).lastModified;

        await new Promise((r) => setTimeout(r, 5));
        await persistencia.sincronizarCambios();
        expect((await db.projects.get(state.projectId)).lastModified).toBe(original);

        state.poEntries[1].sentenceSegments[0].translation = 'Guardar';
        await persistencia.sincronizarCambios();
        expect((await db.projects.get(state.projectId)).lastModified).toBeGreaterThan(original);
    });
});

describe('cuando no hay proyecto abierto', () => {
    it('sincronizar no hace nada y no falla', async () => {
        state.projectId = null;
        expect(await persistencia.sincronizarCambios()).toBe(0);
    });

    it('empezar un proyecto nuevo deja de apuntar al anterior', async () => {
        const id = await persistencia.registrarProyectoAbierto({
            fileName: 'plugin.po',
            format: 'po',
        });

        persistencia.olvidarProyecto();

        expect(state.projectId).toBeNull();
        // El proyecto no se borra: sigue en la lista de recientes.
        expect(await db.projects.get(id)).toBeDefined();
    });
});

describe('resistencia a fallos', () => {
    it('si la base falla al registrar, el editor sigue funcionando', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(db.projects, 'add').mockRejectedValue(new Error('disco lleno'));

        const id = await persistencia.registrarProyectoAbierto({
            fileName: 'plugin.po',
            format: 'po',
        });

        expect(id).toBeNull();
        expect(state.projectId).toBeNull();
        // Lo importante: el trabajo sigue en memoria, intacto.
        expect(state.poEntries).toHaveLength(3);
        vi.restoreAllMocks();
    });

    it('si la base falla al sincronizar, no se pierde lo que hay en memoria', async () => {
        await persistencia.registrarProyectoAbierto({ fileName: 'plugin.po', format: 'po' });
        state.poEntries[1].sentenceSegments[0].translation = 'Guardar';

        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(db.segments, 'where').mockImplementation(() => {
            throw new Error('base de datos caída');
        });

        expect(await persistencia.sincronizarCambios()).toBe(0);
        expect(state.poEntries[1].sentenceSegments[0].translation).toBe('Guardar');

        vi.restoreAllMocks();

        // Y al volver a funcionar, el cambio se guarda: no se ha dado por escrito.
        expect(await persistencia.sincronizarCambios()).toBe(1);
    });
});

describe('adoptar un proyecto ya guardado', () => {
    it('apunta al proyecto sin volver a escribirlo', async () => {
        const id = await proyectos.crearProyecto({
            fileName: 'antiguo.po',
            format: 'po',
            entradas: state.poEntries,
        });

        persistencia.adoptarProyecto(id);

        expect(state.projectId).toBe(id);
        expect(await persistencia.sincronizarCambios()).toBe(0);
    });
});

describe('el comentario de un segmento', () => {
    it('se escribe en la fila del segmento', async () => {
        const id = await persistencia.registrarProyectoAbierto({
            fileName: 'plugin.po',
            format: 'po',
        });

        expect(await persistencia.guardarNota(1, 0, 'Ojo: aquí el cliente prefiere usted')).toBe(
            true
        );

        const fila = await db.segments
            .where('projectId')
            .equals(id)
            .and((s) => s.entryIndex === 1)
            .first();
        expect(fila.nota).toBe('Ojo: aquí el cliente prefiere usted');
    });

    it('no toca la traducción del segmento', async () => {
        await persistencia.registrarProyectoAbierto({ fileName: 'plugin.po', format: 'po' });
        await persistencia.guardarNota(0, 0, 'Una nota');

        const fila = await db.segments
            .where('projectId')
            .equals(state.projectId)
            .and((s) => s.entryIndex === 0)
            .first();
        expect(fila.translation).toBe('Ajustes');
    });

    it('sin proyecto abierto no escribe nada y lo dice', async () => {
        // Puede pasar: si el archivo aún no se ha registrado, la nota se queda
        // en memoria y entra en la base cuando el proyecto se cree.
        expect(await persistencia.guardarNota(1, 0, 'Una nota')).toBe(false);
    });

    it('borrar el comentario deja el campo vacío, no lo deja como estaba', async () => {
        await persistencia.registrarProyectoAbierto({ fileName: 'plugin.po', format: 'po' });
        await persistencia.guardarNota(1, 0, 'Una nota');
        await persistencia.guardarNota(1, 0, '');

        const fila = await db.segments
            .where('projectId')
            .equals(state.projectId)
            .and((s) => s.entryIndex === 1)
            .first();
        expect(fila.nota).toBe('');
    });

    it('si la base falla, lo dice en vez de dar la nota por guardada', async () => {
        await persistencia.registrarProyectoAbierto({ fileName: 'plugin.po', format: 'po' });

        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(db.segments, 'where').mockImplementation(() => {
            throw new Error('base de datos caída');
        });

        expect(await persistencia.guardarNota(1, 0, 'Una nota')).toBe(false);
        vi.restoreAllMocks();
    });
});
