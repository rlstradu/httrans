import { describe, it, expect } from 'vitest';
import {
    parsePoContent,
    reconstructPo,
    escapePoString,
    unescapePoString,
} from '../js/core/po.js';

const PO_EJEMPLO = `msgid ""
msgstr ""
"Project-Id-Version: ejemplo 1.0\\n"
"Language: es\\n"

#: index.php:12
msgid "Hello, world"
msgstr "Hola, mundo"

#: index.php:20
msgctxt "menu"
msgid "Open"
msgstr "Abrir"

#: index.php:30
msgid "Save changes"
msgstr ""
`;

describe('escapado de cadenas PO', () => {
    it('envuelve el texto entre comillas', () => {
        expect(escapePoString('hola')).toBe('"hola"');
    });

    it('escapa comillas, barras, saltos y tabuladores', () => {
        expect(escapePoString('dice "hola"')).toBe('"dice \\"hola\\""');
        expect(escapePoString('a\nb')).toBe('"a\\nb"');
        expect(escapePoString('a\tb')).toBe('"a\\tb"');
        expect(escapePoString('C:\\ruta')).toBe('"C:\\\\ruta"');
    });

    it('unescapePoString deshace lo que hace escapePoString', () => {
        for (const texto of ['hola', 'dice "hola"', 'a\nb', 'a\tb', 'C:\\ruta', 'ñ á ü €']) {
            expect(unescapePoString(escapePoString(texto))).toBe(texto);
        }
    });

    it('convierte las etiquetas <br> en saltos de línea', () => {
        expect(unescapePoString('"linea uno<br>linea dos"')).toBe('linea uno\nlinea dos');
    });

    it('acepta una cadena sin comillas alrededor', () => {
        expect(unescapePoString('hola')).toBe('hola');
    });
});

describe('parsePoContent', () => {
    const entradas = parsePoContent(PO_EJEMPLO);

    it('lee original y traducción de cada segmento', () => {
        const hola = entradas.find((e) => e.msgid === 'Hello, world');
        expect(hola).toBeDefined();
        expect(hola.msgstr).toBe('Hola, mundo');

        const guardar = entradas.find((e) => e.msgid === 'Save changes');
        expect(guardar.msgstr).toBe('');
    });

    it('lee el contexto (msgctxt)', () => {
        const abrir = entradas.find((e) => e.msgid === 'Open');
        expect(abrir.msgctxt).toBe('menu');
        expect(abrir.msgstr).toBe('Abrir');
    });

    it('marca la cabecera del archivo como tal', () => {
        expect(entradas[0].isHeader).toBe(true);
        expect(entradas[0].msgid).toBe('');
    });

    it('cuenta las palabras de cada segmento', () => {
        const hola = entradas.find((e) => e.msgid === 'Hello, world');
        expect(hola.sentenceSegments[0].wordCountOriginal).toBe(2);
    });

    it('devuelve una lista vacía con contenido vacío', () => {
        expect(parsePoContent('')).toEqual([]);
    });

    it('lee un archivo sin comentarios ni cabecera', () => {
        const simple = parsePoContent('msgid "Cat"\nmsgstr "Gato"\n');
        expect(simple.length).toBe(1);
        expect(simple[0].msgid).toBe('Cat');
        expect(simple[0].msgstr).toBe('Gato');
    });

    // Pendiente: los plurales (msgid_plural / msgstr[0] / msgstr[1]) no se leen
    // ni se conservan al guardar. Es un fallo aparte, anterior a este cambio.
    it.todo('conserva las formas de plural (msgid_plural y msgstr[n])');
});

// Regresiones del lector de PO. Los fallos venían de la v1.0.5 publicada y se
// corrigieron juntos en la v1.1.0 porque todos nacen del mismo sitio: el
// tratamiento de los comentarios dentro del bucle de lectura.
describe('regresiones del lector de PO', () => {
    const CON_COMENTARIO_INICIAL = `# Copyright (C) 2025 Ejemplo
# This file is distributed under the same license.
msgid ""
msgstr ""
"Project-Id-Version: mi-plugin 2.1\\n"
"Language: es_ES\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#: includes/admin.php:42
msgid "Settings"
msgstr "Ajustes"

#, fuzzy
#: includes/admin.php:88
msgid "Save changes"
msgstr ""
`;

    it('conserva la cabecera del archivo', () => {
        const cabecera = parsePoContent(CON_COMENTARIO_INICIAL)[0];
        expect(cabecera.isHeader).toBe(true);
        expect(cabecera.msgstr).toContain('Project-Id-Version: mi-plugin 2.1');
        expect(cabecera.msgstr).toContain('Language: es_ES');
        expect(cabecera.msgstr).toContain('Plural-Forms:');
    });

    it('no duplica la cabecera cuando el archivo empieza por comentarios', () => {
        const entradas = parsePoContent(CON_COMENTARIO_INICIAL);
        expect(entradas.filter((e) => e.isHeader).length).toBe(1);
        expect(entradas.length).toBe(3); // cabecera + 2 segmentos
    });

    it('asigna cada comentario a su propio segmento', () => {
        const entradas = parsePoContent(CON_COMENTARIO_INICIAL);
        const ajustes = entradas.find((e) => e.msgid === 'Settings');
        const guardar = entradas.find((e) => e.msgid === 'Save changes');

        expect(ajustes.comments).toContain('#: includes/admin.php:42');
        expect(ajustes.comments).not.toContain('#, fuzzy');
        expect(guardar.comments).toContain('#: includes/admin.php:88');
    });

    it('deja los comentarios de cabecera en la cabecera', () => {
        const cabecera = parsePoContent(CON_COMENTARIO_INICIAL)[0];
        expect(cabecera.comments.join(' ')).toContain('Copyright (C) 2025');
        expect(cabecera.comments.join(' ')).not.toContain('admin.php');
    });

    it('marca como fuzzy el segmento correcto', () => {
        const entradas = parsePoContent(CON_COMENTARIO_INICIAL);
        expect(entradas.find((e) => e.msgid === 'Save changes').fuzzy).toBe(true);
        expect(entradas.find((e) => e.msgid === 'Settings').fuzzy).toBeFalsy();
    });

    it('el archivo sobrevive entero a una ida y vuelta', () => {
        const salida = reconstructPo(parsePoContent(CON_COMENTARIO_INICIAL));

        // la cabecera sigue ahí, una sola vez
        expect(salida).toContain('Project-Id-Version: mi-plugin 2.1');
        expect(salida.match(/msgid ""/g).length).toBe(1);

        // cada comentario con su cadena
        const bloques = salida.split('\n\n');
        const bloqueAjustes = bloques.find((b) => b.includes('"Settings"'));
        const bloqueGuardar = bloques.find((b) => b.includes('"Save changes"'));
        expect(bloqueAjustes).toContain('#: includes/admin.php:42');
        expect(bloqueGuardar).toContain('#: includes/admin.php:88');
        expect(bloqueGuardar).toContain('#, fuzzy');
        expect(bloqueAjustes).not.toContain('#, fuzzy');
    });

    it('lee cadenas repartidas en varias líneas', () => {
        const entradas = parsePoContent(
            'msgid ""\n"parte uno "\n"parte dos"\nmsgstr ""\n"trozo uno "\n"trozo dos"\n'
        );
        const entrada = entradas[entradas.length - 1];
        expect(entrada.msgid).toBe('parte uno parte dos');
        expect(entrada.msgstr).toBe('trozo uno trozo dos');
    });

    it('no se inventa segmentos con un archivo que solo tiene comentarios', () => {
        expect(parsePoContent('# solo un comentario\n')).toEqual([]);
    });

    it('un archivo sin tocar sale exactamente igual que entró', () => {
        // La prueba más exigente: leer y volver a escribir sin editar nada no
        // debe cambiar ni un carácter.
        expect(reconstructPo(parsePoContent(CON_COMENTARIO_INICIAL))).toBe(CON_COMENTARIO_INICIAL);
    });

    it('reparte en varias líneas los textos con saltos, como gettext', () => {
        const salida = reconstructPo([
            {
                comments: [],
                msgid: '',
                msgstr: 'Project-Id-Version: x\nLanguage: es\n',
                isHeader: true,
                sentenceSegments: [{ original: '', translation: '' }],
            },
        ]);
        const lineas = salida.split('\n');
        expect(lineas[1]).toBe('msgstr ""');
        expect(lineas[2]).toBe('"Project-Id-Version: x\\n"');
        expect(lineas[3]).toBe('"Language: es\\n"');
    });
});

describe('reconstructPo', () => {
    it('escribe cada segmento con su original y su traducción', () => {
        const salida = reconstructPo(parsePoContent(PO_EJEMPLO));
        expect(salida).toContain('msgid "Hello, world"');
        expect(salida).toContain('msgstr "Hola, mundo"');
        expect(salida).toContain('msgctxt "menu"');
    });

    it('los textos sobreviven a la ida y vuelta', () => {
        const original = parsePoContent(PO_EJEMPLO);
        const releido = parsePoContent(reconstructPo(original));

        const textos = (lista) =>
            lista.filter((e) => e.msgid !== '').map((e) => `${e.msgid}=>${e.msgstr}`);
        expect(textos(releido)).toEqual(textos(original));
    });

    it('respeta el espaciado exacto del texto traducido', () => {
        // Regresión de v1.0.5: la segmentación por frases metía espacios de más
        // en el archivo final. El texto debe salir exactamente como se escribió.
        const entradas = [
            {
                comments: [],
                msgid: 'One. Two. Three.',
                msgstr: 'Uno. Dos. Tres.',
                sentenceSegments: [
                    { original: 'One. ', translation: 'Uno. ' },
                    { original: 'Two. ', translation: 'Dos. ' },
                    { original: 'Three.', translation: 'Tres.' },
                ],
            },
        ];
        expect(reconstructPo(entradas)).toContain('msgstr "Uno. Dos. Tres."');
    });

    it('escapa las comillas de la traducción', () => {
        const entradas = [
            {
                comments: [],
                msgid: 'Say "hi"',
                msgstr: 'Di "hola"',
                sentenceSegments: [{ original: 'Say "hi"', translation: 'Di "hola"' }],
            },
        ];
        expect(reconstructPo(entradas)).toContain('msgstr "Di \\"hola\\""');
    });

    it('quita la marca fuzzy cuando el segmento ya tiene traducción', () => {
        const entradas = [
            {
                comments: ['#, fuzzy', '#: index.php:30'],
                fuzzy: true,
                msgid: 'Save changes',
                msgstr: 'Guardar cambios',
                sentenceSegments: [{ original: 'Save changes', translation: 'Guardar cambios' }],
            },
        ];
        const salida = reconstructPo(entradas);
        expect(salida).not.toContain('#, fuzzy');
        expect(salida).toContain('#: index.php:30');
    });

    it('mantiene la marca fuzzy si el segmento sigue sin traducir', () => {
        const entradas = [
            {
                comments: ['#, fuzzy'],
                fuzzy: true,
                msgid: 'Save changes',
                msgstr: '',
                sentenceSegments: [{ original: 'Save changes', translation: '' }],
            },
        ];
        expect(reconstructPo(entradas)).toContain('#, fuzzy');
    });

    it('devuelve cadena vacía sin segmentos', () => {
        expect(reconstructPo([])).toBe('');
    });
});
