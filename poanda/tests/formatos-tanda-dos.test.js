/**
 * Segunda tanda de formatos: csv, md, resx, arb, ts de Qt y wxl.
 *
 * La regla de la casa vale para todos: **abrir un archivo y guardarlo sin
 * traducir nada tiene que devolver el mismo archivo, byte a byte**. Es lo que
 * demuestra que no se está tirando en silencio lo que el programa no ha sabido
 * leer. Por eso ninguno de estos lectores reescribe el archivo: todos anotan al
 * leer en qué posición exacta está cada texto y al guardar sustituyen solo eso.
 *
 * Los lectores de Locversia, de donde vienen estos formatos, sí reescriben. Y
 * eso se lleva por delante cosas concretas que aquí se comprueban que siguen en
 * pie: el esquema de un .resx, los <location> de un .ts de Qt, las columnas de
 * más de un .csv y los bloques de arroba de un .arb.
 */
import { describe, it, expect } from 'vitest';
import { parseCsvContent, reconstructCsv } from '../src/js/core/csv.js';
import { parseMdContent, reconstructMd } from '../src/js/core/md.js';
import { parseResxContent, reconstructResx } from '../src/js/core/resx.js';
import { parseArbContent, reconstructArb } from '../src/js/core/arb.js';
import { parseQtTsContent, reconstructQtTs, esTraduccionDeQt } from '../src/js/core/qtts.js';
import { parseWxlContent, reconstructWxl } from '../src/js/core/wxl.js';
import { sustituirTramos } from '../src/js/core/tramos.js';

/** Traduce el segmento indicado, como haría el editor. */
function traducir(entrada, texto) {
    entrada.sentenceSegments[0].translation = texto;
    return entrada;
}

describe('sustituir tramos', () => {
    it('cambia solo lo indicado', () => {
        expect(sustituirTramos('hola mundo', [{ inicio: 5, fin: 10, texto: 'gente' }])).toBe(
            'hola gente'
        );
    });

    it('sin tramos devuelve el original tal cual', () => {
        expect(sustituirTramos('hola mundo', [])).toBe('hola mundo');
    });

    it('los tramos se aplican en orden aunque vengan desordenados', () => {
        const salida = sustituirTramos('uno dos tres', [
            { inicio: 8, fin: 12, texto: 'THREE' },
            { inicio: 0, fin: 3, texto: 'ONE' },
        ]);
        expect(salida).toBe('ONE dos THREE');
    });

    it('un tramo que pisa al anterior se descarta en vez de romper el archivo', () => {
        const salida = sustituirTramos('uno dos', [
            { inicio: 0, fin: 5, texto: 'X' },
            { inicio: 2, fin: 7, texto: 'Y' },
        ]);
        expect(salida).toBe('Xos');
    });
});

describe('archivos .csv', () => {
    const CSV = `key,source,target,max_length
boton.guardar,Save,,20
boton.cancelar,Cancel,,20
mensaje,"Hello, world",,80`;

    it('lee el original y la clave de cada fila', () => {
        const entradas = parseCsvContent(CSV);
        expect(entradas).toHaveLength(3);
        expect(entradas[0].msgctxt).toBe('boton.guardar');
        expect(entradas[0].msgid).toBe('Save');
    });

    it('la celda entrecomillada llega sin comillas y con su coma', () => {
        expect(parseCsvContent(CSV)[2].msgid).toBe('Hello, world');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructCsv(parseCsvContent(CSV), CSV)).toBe(CSV);
    });

    it('la traducción va a su columna y las demás no se tocan', () => {
        const entradas = parseCsvContent(CSV);
        traducir(entradas[0], 'Guardar');

        const salida = reconstructCsv(entradas, CSV);
        expect(salida).toContain('boton.guardar,Save,Guardar,20');
        // La columna de longitud máxima, que Poanda no entiende, sigue ahí.
        expect(salida).toContain(',80');
    });

    it('una traducción con coma sale entrecomillada', () => {
        const entradas = parseCsvContent(CSV);
        traducir(entradas[0], 'Guardar, por favor');
        expect(reconstructCsv(entradas, CSV)).toContain('"Guardar, por favor"');
    });

    it('una traducción con comillas las duplica, como manda el formato', () => {
        const entradas = parseCsvContent(CSV);
        traducir(entradas[0], 'Pulsa "Guardar"');
        expect(reconstructCsv(entradas, CSV)).toContain('"Pulsa ""Guardar"""');
    });

    it('entiende el punto y coma como separador', () => {
        const conPuntoYComa = `source;target
Save;
Cancel;`;
        const entradas = parseCsvContent(conPuntoYComa);
        expect(entradas).toHaveLength(2);

        traducir(entradas[0], 'Guardar');
        expect(reconstructCsv(entradas, conPuntoYComa)).toContain('Save;Guardar');
    });

    it('sin encabezado, la primera fila también se traduce', () => {
        // Tirar la primera fila porque "toca" sería perder una cadena entera.
        const sinEncabezado = `Save,
Cancel,`;
        const entradas = parseCsvContent(sinEncabezado);
        expect(entradas.map((e) => e.msgid)).toEqual(['Save', 'Cancel']);
    });

    it('una celda con salto de línea dentro no parte la fila en dos', () => {
        const conSalto = `source,target
"Primera línea
segunda línea",
Corto,`;
        const entradas = parseCsvContent(conSalto);
        expect(entradas).toHaveLength(2);
        expect(entradas[0].msgid).toBe('Primera línea\nsegunda línea');
        expect(reconstructCsv(entradas, conSalto)).toBe(conSalto);
    });

    it('conserva los saltos de línea de Windows', () => {
        const conCrLf = 'source,target\r\nSave,\r\nCancel,';
        const entradas = parseCsvContent(conCrLf);
        expect(entradas[0].msgid).toBe('Save');
        expect(reconstructCsv(entradas, conCrLf)).toBe(conCrLf);
    });

    it('aguanta el archivo vacío', () => {
        expect(parseCsvContent('')).toEqual([]);
        expect(reconstructCsv([], '')).toBe('');
    });
});

describe('documentos Markdown', () => {
    const MD = `---
title: Ejemplo
---

# Guía rápida

Este es el primer párrafo.
Y esta línea sigue el mismo párrafo.

## Instalación

1. Descarga el archivo.
2. Ábrelo con \`poanda\`.

\`\`\`bash
npm install
\`\`\`

> Una cita corta.

| Columna | Otra |
| --- | --- |
| Uno | Dos |

[1]: https://ejemplo.org`;

    it('el título es un segmento, sin las almohadillas', () => {
        const entradas = parseMdContent(MD);
        expect(entradas[0].msgid).toBe('Guía rápida');
    });

    it('el párrafo de dos líneas es un solo segmento', () => {
        // Traducir línea a línea un párrafo es traducir a ciegas: la frase de
        // arriba y la de abajo son la misma idea.
        const entradas = parseMdContent(MD);
        expect(entradas[1].msgid).toBe(
            'Este es el primer párrafo.\nY esta línea sigue el mismo párrafo.'
        );
    });

    it('el punto de una lista va sin su guion ni su número', () => {
        const textos = parseMdContent(MD).map((e) => e.msgid);
        expect(textos).toContain('Descarga el archivo.');
        expect(textos).toContain('Ábrelo con `poanda`.');
    });

    it('el código entre acentos graves se queda dentro de la frase', () => {
        // Cortar la frase en el código dejaría "Ábrelo con" por un lado y nada
        // por el otro: la frase hay que verla entera para traducirla.
        const textos = parseMdContent(MD).map((e) => e.msgid);
        expect(textos).not.toContain('Ábrelo con');
    });

    it('el bloque de código no se traduce', () => {
        const textos = parseMdContent(MD).map((e) => e.msgid);
        expect(textos).not.toContain('npm install');
    });

    it('el bloque de datos del principio no se traduce', () => {
        const textos = parseMdContent(MD).map((e) => e.msgid);
        expect(textos.some((t) => t.includes('title:'))).toBe(false);
    });

    it('la cita va sin el signo de mayor que', () => {
        expect(parseMdContent(MD).map((e) => e.msgid)).toContain('Una cita corta.');
    });

    it('cada celda de la tabla es su propio segmento', () => {
        const textos = parseMdContent(MD).map((e) => e.msgid);
        expect(textos).toContain('Columna');
        expect(textos).toContain('Uno');
        // Y la fila de guiones, que dice cómo se alinean las columnas, no.
        expect(textos.some((t) => t.includes('---'))).toBe(false);
    });

    it('la definición de enlace del final no se traduce', () => {
        const textos = parseMdContent(MD).map((e) => e.msgid);
        expect(textos.some((t) => t.startsWith('[1]:'))).toBe(false);
    });

    it('abrir y guardar sin traducir devuelve el documento igual', () => {
        expect(reconstructMd(parseMdContent(MD), MD)).toBe(MD);
    });

    it('al traducir se conservan las almohadillas y los guiones', () => {
        const entradas = parseMdContent(MD);
        traducir(entradas[0], 'Quick start');

        const salida = reconstructMd(entradas, MD);
        expect(salida).toContain('# Quick start');
        expect(salida).toContain('1. Descarga el archivo.');
    });

    it('aguanta el documento vacío', () => {
        expect(parseMdContent('')).toEqual([]);
        expect(reconstructMd([], '')).toBe('');
    });
});

describe('archivos .resx', () => {
    const RESX = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <xsd:schema id="root" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <xsd:element name="root" />
  </xsd:schema>
  <resheader name="version">
    <value>2.0</value>
  </resheader>
  <data name="boton.guardar" xml:space="preserve">
    <value>Save</value>
    <comment>Botón de la barra principal</comment>
  </data>
  <data name="icono" type="System.Drawing.Bitmap, System.Drawing">
    <value>logo.png;System.Drawing.Bitmap</value>
  </data>
  <data name="saludo" xml:space="preserve">
    <value>Hello &amp; welcome</value>
  </data>
</root>`;

    it('lee el nombre como contexto y el valor como original', () => {
        const entradas = parseResxContent(RESX);
        expect(entradas).toHaveLength(2);
        expect(entradas[0].msgctxt).toBe('boton.guardar');
        expect(entradas[0].msgid).toBe('Save');
    });

    it('los recursos que no son texto se dejan en paz', () => {
        // Una imagen no se traduce, y enseñarla como segmento solo estorba.
        expect(parseResxContent(RESX).some((e) => e.msgctxt === 'icono')).toBe(false);
    });

    it('el comentario llega como nota del programador', () => {
        expect(parseResxContent(RESX)[0].comments).toEqual([
            '#. Botón de la barra principal',
        ]);
    });

    it('deshace las entidades del original', () => {
        expect(parseResxContent(RESX)[1].msgid).toBe('Hello & welcome');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructResx(parseResxContent(RESX), RESX)).toBe(RESX);
    });

    it('el esquema del archivo sigue ahí después de traducir', () => {
        // Es lo que Visual Studio necesita para abrirlo, y es justo lo que se
        // pierde al reescribir el archivo entero.
        const entradas = parseResxContent(RESX);
        traducir(entradas[0], 'Guardar');

        const salida = reconstructResx(entradas, RESX);
        expect(salida).toContain('<xsd:schema');
        expect(salida).toContain('<resheader name="version">');
        expect(salida).toContain('<value>Guardar</value>');
        expect(salida).toContain('<comment>Botón de la barra principal</comment>');
    });

    it('una traducción con signos raros se escapa', () => {
        const entradas = parseResxContent(RESX);
        traducir(entradas[0], 'Guardar & cerrar <ya>');
        expect(reconstructResx(entradas, RESX)).toContain(
            '<value>Guardar &amp; cerrar &lt;ya&gt;</value>'
        );
    });
});

describe('archivos .arb de Flutter', () => {
    const ARB = `{
  "@@locale": "en",
  "saveButton": "Save",
  "@saveButton": {
    "description": "Botón de la barra principal",
    "placeholders": {}
  },
  "greeting": "Hello, {name}!",
  "count": 3
}`;

    it('lee las cadenas y deja fuera lo que no es texto', () => {
        // Fuera se quedan el número, el bloque de arroba y el código de idioma
        // del archivo: ninguno de los tres es texto que nadie tenga que traducir.
        const entradas = parseArbContent(ARB);
        expect(entradas.map((e) => e.msgctxt)).toEqual(['saveButton', 'greeting']);
    });

    it('la descripción llega como nota del programador', () => {
        const boton = parseArbContent(ARB).find((e) => e.msgctxt === 'saveButton');
        expect(boton.comments).toEqual(['#. Botón de la barra principal']);
    });

    it('las llaves de ICU llegan intactas al segmento', () => {
        const saludo = parseArbContent(ARB).find((e) => e.msgctxt === 'greeting');
        expect(saludo.msgid).toBe('Hello, {name}!');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructArb(parseArbContent(ARB), ARB)).toBe(ARB);
    });

    it('los bloques de arroba siguen enteros después de traducir', () => {
        // Reescribir el archivo con JSON.stringify se lleva por delante los
        // placeholders, y sin ellos la aplicación no compila.
        const entradas = parseArbContent(ARB);
        traducir(
            entradas.find((e) => e.msgctxt === 'saveButton'),
            'Guardar'
        );

        const salida = reconstructArb(entradas, ARB);
        expect(salida).toContain('"saveButton": "Guardar"');
        expect(salida).toContain('"placeholders": {}');
        expect(salida).toContain('"count": 3');
        // Y el orden de las claves no cambia.
        expect(salida.indexOf('"@@locale"')).toBeLessThan(salida.indexOf('"saveButton"'));
    });

    it('una traducción con comillas o saltos de línea no rompe el archivo', () => {
        const entradas = parseArbContent(ARB);
        traducir(
            entradas.find((e) => e.msgctxt === 'saveButton'),
            'Pulsa "Guardar"\ny espera'
        );

        const salida = reconstructArb(entradas, ARB);
        expect(() => JSON.parse(salida)).not.toThrow();
        expect(JSON.parse(salida).saveButton).toBe('Pulsa "Guardar"\ny espera');
    });

    it('aguanta el archivo vacío', () => {
        expect(parseArbContent('')).toEqual([]);
    });
});

describe('archivos .ts de Qt', () => {
    const TS = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE TS>
<TS version="2.1" language="es_ES">
<context>
    <name>MainWindow</name>
    <message>
        <location filename="mainwindow.cpp" line="42"/>
        <source>Save</source>
        <extracomment>Botón de la barra principal</extracomment>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <location filename="mainwindow.cpp" line="58"/>
        <source>Cancel</source>
        <translation type="unfinished"/>
    </message>
    <message>
        <location filename="mainwindow.cpp" line="70"/>
        <source>Delete</source>
        <translation>Eliminar</translation>
    </message>
</context>
</TS>`;

    it('distingue un .ts de Qt de uno de TypeScript', () => {
        expect(esTraduccionDeQt(TS)).toBe(true);
        expect(esTraduccionDeQt('import { algo } from "./otro";')).toBe(false);
    });

    it('lee el original, el contexto y lo ya traducido', () => {
        const entradas = parseQtTsContent(TS);
        expect(entradas).toHaveLength(3);
        expect(entradas[0].msgid).toBe('Save');
        expect(entradas[0].msgctxt).toBe('MainWindow');
        expect(entradas[2].sentenceSegments[0].translation).toBe('Eliminar');
    });

    it('el comentario del programador llega como nota', () => {
        expect(parseQtTsContent(TS)[0].comments).toEqual(['#. Botón de la barra principal']);
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructQtTs(parseQtTsContent(TS), TS)).toBe(TS);
    });

    it('al traducir desaparece la marca de "sin terminar"', () => {
        // Si se queda, la traducción está en el archivo pero Qt no la usa: el
        // programa sigue saliendo en inglés y no hay forma de saber por qué.
        const entradas = parseQtTsContent(TS);
        traducir(entradas[0], 'Guardar');

        const salida = reconstructQtTs(entradas, TS);
        expect(salida).toContain('<translation>Guardar</translation>');
        expect(salida).not.toContain('type="unfinished"></translation>');
    });

    it('la etiqueta vacía se convierte en una con traducción dentro', () => {
        const entradas = parseQtTsContent(TS);
        traducir(entradas[1], 'Cancelar');
        expect(reconstructQtTs(entradas, TS)).toContain('<translation>Cancelar</translation>');
    });

    it('las líneas de código de cada texto siguen ahí', () => {
        // Los <location> los genera Qt y dicen dónde vive cada cadena; perderlos
        // deja el archivo sin la información que usa la siguiente actualización.
        const entradas = parseQtTsContent(TS);
        traducir(entradas[0], 'Guardar');

        const salida = reconstructQtTs(entradas, TS);
        expect(salida).toContain('<location filename="mainwindow.cpp" line="42"/>');
        expect(salida).toContain('language="es_ES"');
    });
});

describe('archivos .wxl de instaladores WiX', () => {
    const WXL = `<?xml version="1.0" encoding="utf-8"?>
<WixLocalization Culture="en-us" xmlns="http://schemas.microsoft.com/wix/2006/localization">
  <String Id="WelcomeTitle" Overridable="yes">Welcome</String>
  <String Id="NextButton">&amp;Next</String>
</WixLocalization>`;

    it('lee el identificador y el texto', () => {
        const entradas = parseWxlContent(WXL);
        expect(entradas).toHaveLength(2);
        expect(entradas[0].msgctxt).toBe('WelcomeTitle');
        expect(entradas[0].msgid).toBe('Welcome');
        expect(entradas[1].msgid).toBe('&Next');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructWxl(parseWxlContent(WXL), WXL)).toBe(WXL);
    });

    it('al traducir se conservan los atributos de la cadena', () => {
        const entradas = parseWxlContent(WXL);
        traducir(entradas[0], 'Bienvenido');

        const salida = reconstructWxl(entradas, WXL);
        expect(salida).toContain('<String Id="WelcomeTitle" Overridable="yes">Bienvenido</String>');
        expect(salida).toContain('Culture="en-us"');
    });

    it('entiende las etiquetas con prefijo de espacio de nombres', () => {
        const conPrefijo = `<loc:WixLocalization>
  <loc:String Id="Titulo">Welcome</loc:String>
</loc:WixLocalization>`;
        const entradas = parseWxlContent(conPrefijo);
        expect(entradas).toHaveLength(1);

        traducir(entradas[0], 'Bienvenido');
        expect(reconstructWxl(entradas, conPrefijo)).toContain(
            '<loc:String Id="Titulo">Bienvenido</loc:String>'
        );
    });
});
