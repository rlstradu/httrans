import { describe, it, expect } from 'vitest';
import {
    parsePoContent,
    reconstructPo,
    escapePoString,
    unescapePoString,
} from '../src/js/core/po.js';

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

});

/**
 * Formas de plural.
 *
 * Casi cualquier archivo real las lleva: "1 archivo" / "%d archivos". En gettext
 * se escriben con msgid_plural y una traducción por forma (msgstr[0],
 * msgstr[1]...), y cuántas formas hay lo dice la cabecera del archivo, porque
 * depende del idioma: dos en español, tres en polaco, una en japonés, seis en
 * árabe.
 *
 * Hasta ahora Poanda no las entendía, y eso no significaba dejarlas quietas:
 * significaba borrarlas. Al abrir y guardar, el msgid_plural y las traducciones
 * ya hechas desaparecían y quedaba un msgstr vacío. Se perdía trabajo sin que
 * nadie se enterase, que es la peor forma de perderlo.
 */
describe('formas de plural', () => {
    const CON_PLURALES = `msgid ""
msgstr ""
"Language: es\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#: app.py:10
msgid "One file"
msgid_plural "%d files"
msgstr[0] "Un archivo"
msgstr[1] "%d archivos"
`;

    it('lee el original singular y el plural', () => {
        const entradas = parsePoContent(CON_PLURALES);
        expect(entradas[1].msgid).toBe('One file');
        expect(entradas[1].msgidPlural).toBe('%d files');
    });

    it('lee una traducción por cada forma', () => {
        const [, entrada] = parsePoContent(CON_PLURALES);
        expect(entrada.sentenceSegments).toHaveLength(2);
        expect(entrada.sentenceSegments[0].translation).toBe('Un archivo');
        expect(entrada.sentenceSegments[1].translation).toBe('%d archivos');
    });

    it('cada forma enseña el original que le corresponde', () => {
        // La primera se traduce mirando el singular y el resto mirando el
        // plural: es lo que hace falta tener delante para traducir cada una.
        const [, entrada] = parsePoContent(CON_PLURALES);
        expect(entrada.sentenceSegments[0].original).toBe('One file');
        expect(entrada.sentenceSegments[1].original).toBe('%d files');
    });

    it('marca qué forma de plural es cada segmento', () => {
        const [, entrada] = parsePoContent(CON_PLURALES);
        expect(entrada.sentenceSegments.map((s) => s.formaPlural)).toEqual([0, 1]);
    });

    it('devuelve el archivo igual que estaba', () => {
        // La prueba de fuego: abrir y guardar sin tocar nada no puede cambiar
        // ni un byte.
        expect(reconstructPo(parsePoContent(CON_PLURALES))).toBe(CON_PLURALES);
    });

    it('guarda lo que se traduce en cada forma', () => {
        const entradas = parsePoContent(CON_PLURALES);
        entradas[1].sentenceSegments[0].translation = 'Un fichero';
        entradas[1].sentenceSegments[1].translation = '%d ficheros';

        const salida = reconstructPo(entradas);
        expect(salida).toContain('msgstr[0] "Un fichero"');
        expect(salida).toContain('msgstr[1] "%d ficheros"');
    });

    it('respeta el orden de los campos que exige el formato', () => {
        const salida = reconstructPo(parsePoContent(CON_PLURALES));
        const orden = ['msgid "One file"', 'msgid_plural', 'msgstr[0]', 'msgstr[1]'];
        const posiciones = orden.map((campo) => salida.indexOf(campo));
        expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
        expect(Math.min(...posiciones)).toBeGreaterThan(-1);
    });

    it('no escribe un msgstr suelto en las entradas con plural', () => {
        // Un msgstr normal junto a los msgstr[n] deja el archivo inválido. Se
        // mira solo de la entrada con plural en adelante: la cabecera del
        // archivo sí lleva su msgstr, y ese tiene que seguir ahí.
        const salida = reconstructPo(parsePoContent(CON_PLURALES));
        const entradaConPlural = salida.slice(salida.indexOf('msgid "One file"'));
        expect(entradaConPlural).not.toMatch(/^msgstr "/m);
    });

    it('abre tantas formas como diga la cabecera, aunque el archivo traiga menos', () => {
        // Un archivo al que le falta una forma está incompleto para gettext.
        // Se abre con las tres para poder rellenarla en lugar de heredar el hueco.
        const tresFormas = `msgid ""
msgstr ""
"Plural-Forms: nplurals=3; plural=(n==1) ? 0 : ((n%10>=2 && n%10<=4) ? 1 : 2);\\n"

msgid "One file"
msgid_plural "%d files"
msgstr[0] "Plik"
msgstr[1] "Pliki"
`;
        const [, entrada] = parsePoContent(tresFormas);
        expect(entrada.sentenceSegments).toHaveLength(3);
        expect(entrada.sentenceSegments[2].translation).toBe('');
    });

    it('sin cabecera que lo diga, respeta las formas que traiga el archivo', () => {
        // Aquí no se inventa nada: añadir una forma de más a un idioma que solo
        // tiene una (japonés, chino) rompería el archivo.
        const unaForma = `msgid "One file"
msgid_plural "%d files"
msgstr[0] "ファイル"
`;
        const [entrada] = parsePoContent(unaForma);
        expect(entrada.sentenceSegments).toHaveLength(1);
        expect(reconstructPo([entrada])).toBe(unaForma);
    });

    it('lee las formas repartidas en varias líneas', () => {
        const partido = `msgid "One"
msgid_plural ""
"%d files, all of them"
msgstr[0] "Uno"
msgstr[1] ""
"%d archivos, todos"
`;
        const [entrada] = parsePoContent(partido);
        expect(entrada.msgidPlural).toBe('%d files, all of them');
        expect(entrada.sentenceSegments[1].translation).toBe('%d archivos, todos');
    });

    it('quita la marca de provisional cuando ya hay alguna forma traducida', () => {
        const provisional = `#, fuzzy
msgid "One file"
msgid_plural "%d files"
msgstr[0] "Un archivo"
msgstr[1] "%d archivos"
`;
        expect(reconstructPo(parsePoContent(provisional))).not.toContain('#, fuzzy');
    });

    it('las entradas sin plural siguen funcionando igual', () => {
        const normal = 'msgid "Cat"\nmsgstr "Gato"\n';
        const [entrada] = parsePoContent(normal);
        expect(entrada.msgidPlural).toBeUndefined();
        expect(entrada.sentenceSegments).toHaveLength(1);
        expect(reconstructPo([entrada])).toBe(normal);
    });
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
