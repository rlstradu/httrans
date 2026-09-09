/**
 * La memoria y el glosario, cada uno con su proyecto.
 *
 * El fallo que esto arregla no se ve trabajando: se ve semanas después. Había
 * una sola memoria y un solo glosario para todo, así que al abrir el encargo de
 * otro cliente te llevabas puestos los del anterior. Con dos clientes que
 * traducen "file" de maneras distintas, la herramienta propone la del otro con
 * toda naturalidad, y al revisar parece una decisión propia.
 *
 * Lo que se comprueba aquí es que lo de cada proyecto se queda en su proyecto,
 * en las dos direcciones: que se guarda y que no se cuela.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const unidad = (srcText, tgtText) => ({
    srcLang: 'en',
    srcText,
    tgtLang: 'es',
    tgtText,
    srcWordCount: 1,
    tgtWordCount: 1,
});

const termino = (srcTerm, tgtTerm) => ({ srcTerm, tgtTerm, srcLang: 'en', tgtLang: 'es' });

let db;
let state;
let recursos;

beforeEach(async () => {
    vi.resetModules();
    db = (await import('../src/js/db.js')).db;
    state = (await import('../src/js/state.js')).state;
    recursos = await import('../src/js/recursos.js');

    state.projectId = null;
    state.translationMemory = [];
    state.glossary = [];
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

describe('guardar', () => {
    it('no escribe si nadie ha tocado nada', async () => {
        state.projectId = 1;
        state.translationMemory = [unidad('Save', 'Guardar')];

        expect(await recursos.guardarRecursos()).toBeNull();
        expect(await db.tm.count()).toBe(0);
    });

    it('escribe lo que hay cuando se ha marcado un cambio', async () => {
        state.projectId = 1;
        state.translationMemory = [unidad('Save', 'Guardar'), unidad('Open', 'Abrir')];
        state.glossary = [termino('file', 'archivo')];
        recursos.marcarRecursosCambiados();

        expect(await recursos.guardarRecursos()).toEqual({ memoria: 2, glosario: 1 });
        expect(await db.tm.where('projectId').equals(1).count()).toBe(2);
        expect(await db.glossary.where('projectId').equals(1).count()).toBe(1);
    });

    it('sin proyecto no escribe nada', async () => {
        // Un archivo abierto que aún no se ha podido registrar sigue
        // traduciéndose; lo que no puede es escribir en un proyecto que no hay.
        state.projectId = null;
        state.translationMemory = [unidad('Save', 'Guardar')];
        recursos.marcarRecursosCambiados();

        expect(await recursos.guardarRecursos()).toBeNull();
        expect(await db.tm.count()).toBe(0);
    });

    it('guardar dos veces no duplica', async () => {
        // Se borra y se reescribe, así que la segunda pasada tiene que dejar lo
        // mismo y no el doble.
        state.projectId = 1;
        state.translationMemory = [unidad('Save', 'Guardar')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        state.translationMemory.push(unidad('Open', 'Abrir'));
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        expect(await db.tm.where('projectId').equals(1).count()).toBe(2);
    });

    it('una unidad que se borra desaparece de la base', async () => {
        state.projectId = 1;
        state.translationMemory = [unidad('Save', 'Guardar'), unidad('Open', 'Abrir')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        state.translationMemory = [unidad('Save', 'Guardar')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        expect(await db.tm.where('projectId').equals(1).count()).toBe(1);
    });
});

describe('cada proyecto con lo suyo', () => {
    it('lo de un proyecto no se cuela en el otro', async () => {
        // El fallo entero, en un test: dos clientes que traducen "file" de
        // maneras distintas.
        state.projectId = 1;
        state.translationMemory = [unidad('file', 'archivo')];
        state.glossary = [termino('file', 'archivo')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        state.projectId = 2;
        state.translationMemory = [unidad('file', 'fichero')];
        state.glossary = [termino('file', 'fichero')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        await recursos.ponerRecursosDelProyecto(1);
        expect(state.translationMemory).toHaveLength(1);
        expect(state.translationMemory[0].tgtText).toBe('archivo');
        expect(state.glossary[0].tgtTerm).toBe('archivo');

        await recursos.ponerRecursosDelProyecto(2);
        expect(state.translationMemory[0].tgtText).toBe('fichero');
        expect(state.glossary[0].tgtTerm).toBe('fichero');
    });

    it('un proyecto sin memoria la trae vacía, no la del anterior', async () => {
        state.projectId = 1;
        state.translationMemory = [unidad('file', 'archivo')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        await recursos.ponerRecursosDelProyecto(2);

        expect(state.translationMemory).toEqual([]);
        expect(state.glossary).toEqual([]);
    });

    it('lo que vuelve es lo que el editor espera, sin cosas de la base', async () => {
        // El id de la fila y el del proyecto son cosas de la base de datos. Si
        // se colaran, acabarían dentro de un TMX exportado.
        state.projectId = 1;
        state.translationMemory = [unidad('Save', 'Guardar')];
        recursos.marcarRecursosCambiados();
        await recursos.guardarRecursos();

        await recursos.ponerRecursosDelProyecto(1);

        expect(state.translationMemory[0]).toEqual(unidad('Save', 'Guardar'));
    });
});

describe('lo pendiente', () => {
    it('se sabe si queda algo por escribir', async () => {
        expect(recursos.hayRecursosSinGuardar()).toBe(false);

        recursos.marcarRecursosCambiados();
        expect(recursos.hayRecursosSinGuardar()).toBe(true);

        state.projectId = 1;
        await recursos.guardarRecursos();
        expect(recursos.hayRecursosSinGuardar()).toBe(false);
    });

    it('vaciar deja las dos listas y lo pendiente a cero', () => {
        state.translationMemory = [unidad('Save', 'Guardar')];
        state.glossary = [termino('file', 'archivo')];
        recursos.marcarRecursosCambiados();

        recursos.vaciarRecursos();

        expect(state.translationMemory).toEqual([]);
        expect(state.glossary).toEqual([]);
        expect(recursos.hayRecursosSinGuardar()).toBe(false);
    });
});
