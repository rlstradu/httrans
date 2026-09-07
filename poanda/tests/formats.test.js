import { describe, it, expect, beforeEach } from 'vitest';
import { parseJsonProject, reconstructJson } from '../js/core/json.js';
import { parsePoForMo, compileMo } from '../js/core/mo.js';
import { generateTBX } from '../js/core/tbx.js';
import { generateTMX } from '../js/core/tmx.js';
import { state } from '../js/state.js';

describe('archivos JSON', () => {
    const JSON_EJEMPLO = JSON.stringify({
        greeting: 'Hello',
        farewell: 'Goodbye',
        empty: '',
    });

    it('convierte cada clave en contexto y cada valor en texto original', () => {
        const entradas = parseJsonProject(JSON_EJEMPLO);
        expect(entradas.length).toBe(3);
        const saludo = entradas.find((e) => e.msgctxt === 'greeting');
        expect(saludo.msgid).toBe('Hello');
        expect(saludo.msgstr).toBe('');
    });

    it('ordena las claves alfabéticamente', () => {
        const entradas = parseJsonProject(JSON_EJEMPLO);
        expect(entradas.map((e) => e.msgctxt)).toEqual(['empty', 'farewell', 'greeting']);
    });

    it('cuenta las palabras del texto original', () => {
        const entradas = parseJsonProject(JSON.stringify({ k: 'dos palabras' }));
        expect(entradas[0].sentenceSegments[0].wordCountOriginal).toBe(2);
    });

    it('reconstruye el JSON con las traducciones', () => {
        const entradas = parseJsonProject(JSON_EJEMPLO);
        entradas.find((e) => e.msgctxt === 'greeting').sentenceSegments[0].translation = 'Hola';
        const salida = JSON.parse(reconstructJson(entradas));
        expect(salida.greeting).toBe('Hola');
        expect(salida.farewell).toBe('');
    });

    it('falla de forma clara si el JSON está mal formado', () => {
        expect(() => parseJsonProject('{esto no es json}')).toThrow();
    });
});

describe('compilación a MO', () => {
    const PO = `msgid ""
msgstr "Content-Type: text/plain\\n"

msgid "Hello"
msgstr "Hola"

msgid "Bye"
msgstr "Adiós"
`;

    it('extrae los mensajes del PO', () => {
        const mensajes = parsePoForMo(PO);
        expect(mensajes.length).toBe(3); // cabecera + 2 cadenas
        const hola = mensajes.find((m) => m.msgid === 'Hello');
        // msgstr es una lista porque el formato MO admite formas de plural
        expect(hola.msgstr).toEqual(['Hola']);
    });

    it('conserva la cabecera del PO como primer mensaje', () => {
        const mensajes = parsePoForMo(PO);
        expect(mensajes[0].msgid).toBe('');
        expect(mensajes[0].msgstr[0]).toContain('Content-Type');
    });

    it('genera un archivo binario con el número mágico de gettext', () => {
        const mo = compileMo(parsePoForMo(PO));
        expect(mo).toBeInstanceOf(ArrayBuffer);
        expect(mo.byteLength).toBeGreaterThan(28);

        // Todo archivo MO válido empieza por 0x950412de (little endian).
        const vista = new DataView(mo);
        expect(vista.getUint32(0, true)).toBe(0x950412de);
    });

    it('declara en la cabecera tantas cadenas como mensajes hay', () => {
        const mensajes = parsePoForMo(PO);
        const vista = new DataView(compileMo(mensajes));
        expect(vista.getUint32(8, true)).toBe(mensajes.length);
    });

    it('coloca las tablas de posiciones donde dice la cabecera', () => {
        const mensajes = parsePoForMo(PO);
        const mo = compileMo(mensajes);
        const vista = new DataView(mo);
        const offsetOriginales = vista.getUint32(12, true);
        const offsetTraducciones = vista.getUint32(16, true);
        expect(offsetOriginales).toBe(28);
        expect(offsetTraducciones).toBe(28 + mensajes.length * 8);
        expect(mo.byteLength).toBeGreaterThan(offsetTraducciones + mensajes.length * 8);
    });
});

describe('exportación de glosario (TBX)', () => {
    beforeEach(() => {
        state.glossarySourceLanguage = 'en';
        state.glossaryTargetLanguage = 'es';
        state.glossary = [
            { srcLang: 'en', srcTerm: 'string', tgtLang: 'es', tgtTerm: 'cadena' },
            { srcLang: 'en', srcTerm: 'file', tgtLang: 'es', tgtTerm: 'archivo' },
        ];
    });

    it('genera XML bien formado con todos los términos', () => {
        const tbx = generateTBX();
        expect(tbx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(tbx).toContain('<term>string</term>');
        expect(tbx).toContain('<term>cadena</term>');
        expect(tbx).toContain('<term>archivo</term>');
        expect(tbx.match(/<termEntry>/g).length).toBe(2);
    });

    it('declara el idioma de origen del glosario', () => {
        expect(generateTBX()).toContain('xml:lang="en"');
    });

    it('genera un archivo válido aunque el glosario esté vacío', () => {
        state.glossary = [];
        const tbx = generateTBX();
        expect(tbx).toContain('</martif>');
        expect(tbx).not.toContain('<termEntry>');
    });

    // PENDIENTE (ver informe del refactor): dos fallos heredados que PandaTerm ya
    // corrigió en su v1.2.0 y que aquí siguen presentes. No se tocan en este
    // refactor porque cambiar el formato de salida es una decisión de producto.
    it.todo('escapa &, < y > en los términos para no romper el XML');
    it.todo('usa langSet en minúscula, como exige el estándar TBX');
});

describe('exportación de memoria de traducción (TMX)', () => {
    beforeEach(() => {
        state.tmSourceLanguage = 'en';
        state.tmTargetLanguage = 'es';
        state.translationMemory = [
            { srcLang: 'en', srcText: 'Hello', tgtLang: 'es', tgtText: 'Hola' },
        ];
    });

    it('genera XML bien formado con las unidades de traducción', () => {
        const tmx = generateTMX();
        expect(tmx).toContain('<tmx version="1.4">');
        expect(tmx).toContain('<seg>Hello</seg>');
        expect(tmx).toContain('<seg>Hola</seg>');
        expect(tmx).toContain('</tmx>');
    });

    it('declara los idiomas de origen y destino', () => {
        const tmx = generateTMX();
        expect(tmx).toContain('srclang="en"');
        expect(tmx).toContain('targetlang="es"');
    });

    it('devuelve null si la memoria está vacía', () => {
        state.translationMemory = [];
        expect(generateTMX()).toBeNull();
    });

    it.todo('escapa &, < y > en los segmentos para no romper el XML');
});
