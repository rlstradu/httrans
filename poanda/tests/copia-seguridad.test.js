/**
 * Comprueba el almacén local de Poanda, ahora sobre Dexie.
 *
 * Lo más importante que hay aquí es la compatibilidad: hasta la v1.1.0 Poanda
 * escribía en IndexedDB directamente. Quien tenga una traducción a medias en el
 * navegador cuando llegue esta versión NO puede perderla, así que el primer
 * bloque de tests escribe una sesión exactamente como lo hacía el código viejo
 * y comprueba que Dexie la encuentra.
 *
 * Se usa fake-indexeddb porque los tests corren en Node, donde no hay navegador
 * ni, por tanto, IndexedDB.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Escribe un registro tal y como lo hacía Poanda antes de Dexie. */
function guardarComoLaVersionAntigua(sesion) {
    return new Promise((resolve, reject) => {
        const peticion = indexedDB.open('PoandaBackup', 1);
        peticion.onerror = () => reject(peticion.error);
        peticion.onupgradeneeded = (evento) => {
            const base = evento.target.result;
            if (!base.objectStoreNames.contains('session')) {
                base.createObjectStore('session', { keyPath: 'id' });
            }
        };
        peticion.onsuccess = (evento) => {
            const base = evento.target.result;
            const transaccion = base.transaction(['session'], 'readwrite');
            transaccion.objectStore('session').put(sesion);
            transaccion.oncomplete = () => {
                base.close();
                resolve();
            };
            transaccion.onerror = () => reject(transaccion.error);
        };
    });
}

const SESION_ANTIGUA = {
    id: 'currentSession',
    poEntries: [{ msgid: 'Settings', msgstr: 'Ajustes' }],
    currentFileType: 'po',
    currentFileName: 'mi-plugin-es_ES.po',
    currentRawHtml: '',
    glossary: [{ srcTerm: 'file', tgtTerm: 'archivo' }],
    glossarySourceLanguage: 'en',
    glossaryTargetLanguage: 'es',
    translationMemory: [{ srcText: 'Hello', tgtText: 'Hola' }],
    tmSourceLanguage: 'en',
    tmTargetLanguage: 'es',
    timestamp: new Date('2026-09-01T10:00:00Z'),
};

let db;
let ID_SESION;

beforeEach(async () => {
    // Módulo nuevo en cada test, para que Dexie no reutilice una conexión ya abierta.
    vi.resetModules();
    const modulo = await import('../src/js/db.js');
    db = modulo.db;
    ID_SESION = modulo.ID_SESION;
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

describe('compatibilidad con las sesiones guardadas antes de Dexie', () => {
    it('encuentra una sesión escrita por la versión antigua', async () => {
        await guardarComoLaVersionAntigua(SESION_ANTIGUA);

        const recuperada = await db.session.get('currentSession');

        expect(recuperada).toBeDefined();
        expect(recuperada.currentFileName).toBe('mi-plugin-es_ES.po');
        expect(recuperada.poEntries[0].msgstr).toBe('Ajustes');
    });

    it('conserva el glosario y la memoria de la sesión antigua', async () => {
        await guardarComoLaVersionAntigua(SESION_ANTIGUA);

        const recuperada = await db.session.get('currentSession');

        expect(recuperada.glossary[0].tgtTerm).toBe('archivo');
        expect(recuperada.translationMemory[0].tgtText).toBe('Hola');
        expect(recuperada.glossarySourceLanguage).toBe('en');
        expect(recuperada.tmTargetLanguage).toBe('es');
    });

    it('conserva la fecha de la última copia', async () => {
        await guardarComoLaVersionAntigua(SESION_ANTIGUA);

        const recuperada = await db.session.get('currentSession');

        expect(recuperada.timestamp).toBeInstanceOf(Date);
        expect(recuperada.timestamp.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    });

    it('la sesión sobrevive a la subida de esquema a la versión 2', async () => {
        // La v1.3.0 añade las tablas de proyectos y sube el esquema a la
        // versión 2. Eso dispara una migración de IndexedDB, y hay que
        // comprobar que la tabla de sesión sale intacta: si no, quien tuviera
        // una traducción a medias la perdería solo por actualizar.
        await guardarComoLaVersionAntigua(SESION_ANTIGUA);

        await db.open();
        expect(db.name).toBe('PoandaBackup');
        expect(db.verno).toBe(2);

        const recuperada = await db.session.get('currentSession');
        expect(recuperada.poEntries[0].msgstr).toBe('Ajustes');
        expect(recuperada.currentFileName).toBe('mi-plugin-es_ES.po');
    });

    it('las tablas nuevas quedan vacías tras la migración, sin inventarse nada', async () => {
        await guardarComoLaVersionAntigua(SESION_ANTIGUA);
        await db.open();

        expect(await db.projects.count()).toBe(0);
        expect(await db.segments.count()).toBe(0);
    });
});

describe('guardar y recuperar la sesión', () => {
    it('guarda una sesión y la vuelve a leer igual', async () => {
        await db.session.put({ ...SESION_ANTIGUA, id: ID_SESION });

        const recuperada = await db.session.get(ID_SESION);

        expect(recuperada.poEntries).toEqual(SESION_ANTIGUA.poEntries);
        expect(recuperada.currentFileName).toBe('mi-plugin-es_ES.po');
    });

    it('guardar de nuevo sustituye la sesión anterior, no la duplica', async () => {
        await db.session.put({ ...SESION_ANTIGUA, id: ID_SESION });
        await db.session.put({ ...SESION_ANTIGUA, id: ID_SESION, currentFileName: 'otro.po' });

        expect(await db.session.count()).toBe(1);
        expect((await db.session.get(ID_SESION)).currentFileName).toBe('otro.po');
    });

    it('devuelve undefined cuando no hay ninguna sesión guardada', async () => {
        expect(await db.session.get(ID_SESION)).toBeUndefined();
    });

    it('borrar deja el almacén vacío', async () => {
        await db.session.put({ ...SESION_ANTIGUA, id: ID_SESION });
        await db.session.clear();

        expect(await db.session.count()).toBe(0);
        expect(await db.session.get(ID_SESION)).toBeUndefined();
    });

    it('aguanta una sesión grande sin perder datos', async () => {
        const muchosSegmentos = Array.from({ length: 5000 }, (_, i) => ({
            msgid: `Cadena original número ${i}`,
            msgstr: `Traducción número ${i}`,
        }));

        await db.session.put({ ...SESION_ANTIGUA, id: ID_SESION, poEntries: muchosSegmentos });
        const recuperada = await db.session.get(ID_SESION);

        expect(recuperada.poEntries).toHaveLength(5000);
        expect(recuperada.poEntries[4999].msgstr).toBe('Traducción número 4999');
    });
});
