import { describe, it, expect, beforeEach } from 'vitest';
import { parseJsonProject, reconstructJson } from '../src/js/core/json.js';
import { parsePoForMo, compileMo } from '../src/js/core/mo.js';
import { generateTMX } from '../src/js/core/tmx.js';
import { state } from '../src/js/state.js';

describe('archivos JSON', () => {
    const JSON_EJEMPLO = `{
  "greeting": "Hello",
  "farewell": "Goodbye",
  "empty": ""
}`;

    /** Un archivo agrupado por pantallas, que es como vienen casi todos. */
    const JSON_ANIDADO = `{
  "menu": {
    "guardar": "Save",
    "cancelar": "Cancel"
  },
  "errores": {
    "vacio": "This field is required"
  },
  "version": 3,
  "activo": true,
  "dias": ["Monday", "Tuesday"]
}`;

    it('convierte cada clave en contexto y cada valor en texto original', () => {
        const entradas = parseJsonProject(JSON_EJEMPLO);
        expect(entradas.length).toBe(2);
        const saludo = entradas.find((e) => e.msgctxt === 'greeting');
        expect(saludo.msgid).toBe('Hello');
        expect(saludo.msgstr).toBe('');
    });

    it('conserva el orden del archivo', () => {
        // Antes se ordenaban alfabéticamente. Eso rompe la única pista de
        // contexto que tiene quien traduce: las claves seguidas suelen ser la
        // misma pantalla, y en el archivo van en el orden en que se usan.
        expect(parseJsonProject(JSON_EJEMPLO).map((e) => e.msgctxt)).toEqual([
            'greeting',
            'farewell',
        ]);
    });

    it('entra en las claves agrupadas y las nombra por su ruta', () => {
        const entradas = parseJsonProject(JSON_ANIDADO);
        expect(entradas.map((e) => e.msgctxt)).toEqual([
            'menu.guardar',
            'menu.cancelar',
            'errores.vacio',
            'dias.0',
            'dias.1',
        ]);
    });

    it('lo que no es texto se queda fuera', () => {
        // Un número o un verdadero/falso no son cadenas que nadie traduzca.
        const textos = parseJsonProject(JSON_ANIDADO).map((e) => e.msgid);
        expect(textos).not.toContain('3');
        expect(textos).not.toContain('true');
    });

    it('cuenta las palabras del texto original', () => {
        const entradas = parseJsonProject('{"k": "dos palabras"}');
        expect(entradas[0].sentenceSegments[0].wordCountOriginal).toBe(2);
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructJson(parseJsonProject(JSON_ANIDADO), JSON_ANIDADO)).toBe(JSON_ANIDADO);
    });

    it('los grupos siguen ahí después de traducir', () => {
        // Guardar el archivo con las claves sueltas y ordenadas daba un archivo
        // que la aplicación de la que salió ya no sabe leer, y no se nota hasta
        // que alguien lo instala.
        const entradas = parseJsonProject(JSON_ANIDADO);
        entradas.find((e) => e.msgctxt === 'menu.guardar').sentenceSegments[0].translation =
            'Guardar';

        const salida = reconstructJson(entradas, JSON_ANIDADO);
        const objeto = JSON.parse(salida);
        expect(objeto.menu.guardar).toBe('Guardar');
        expect(objeto.menu.cancelar).toBe('Cancel');
        expect(objeto.version).toBe(3);
        expect(objeto.dias).toEqual(['Monday', 'Tuesday']);
        // Y la sangría del archivo se mantiene.
        expect(salida).toContain('  "menu": {');
    });

    it('lo que no se traduce se queda como estaba, no vacío', () => {
        const entradas = parseJsonProject(JSON_EJEMPLO);
        entradas.find((e) => e.msgctxt === 'greeting').sentenceSegments[0].translation = 'Hola';

        const salida = JSON.parse(reconstructJson(entradas, JSON_EJEMPLO));
        expect(salida.greeting).toBe('Hola');
        // Antes salía vacío, que es tirar el original de las cadenas a medio
        // traducir: quien abriera el archivo se encontraba con huecos.
        expect(salida.farewell).toBe('Goodbye');
    });

    it('una traducción con comillas no rompe el archivo', () => {
        const entradas = parseJsonProject(JSON_EJEMPLO);
        entradas[0].sentenceSegments[0].translation = 'Pulsa "Guardar"';
        expect(() => JSON.parse(reconstructJson(entradas, JSON_EJEMPLO))).not.toThrow();
    });

    it('un archivo que no es JSON no da segmentos', () => {
        expect(parseJsonProject('{esto no es json}')).toEqual([]);
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

// El TBX se prueba entero en tests/tbx.test.js, donde ahora vive: escribirlo,
// leerlo, la ida y vuelta con PandaTerm y los dos fallos que quedaban
// pendientes aquí (el escapado y el langSet en minúscula), ya corregidos.

describe('exportación de memoria de traducción (TMX)', () => {
    beforeEach(() => {
        state.sourceLang = 'en';
        state.targetLang = 'es';
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
