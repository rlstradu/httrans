/**
 * ASS y SSA: los subtítulos con estilo, y los del fansub.
 *
 * Es el formato de Aegisub y el que se usa cuando el subtítulo hace algo más que
 * estar abajo en blanco: carteles, letreros, karaoke, un personaje que habla en
 * amarillo desde una esquina. Todo eso vive en la cabecera —los estilos, la
 * resolución del vídeo— y en unas marcas dentro del propio texto, `{\\i1}`,
 * `{\\an8}`, `{\\pos(...)}`, que dicen cómo y dónde sale cada cosa.
 *
 * Nada de eso se traduce y todo eso tiene que volver, así que la regla es la de
 * siempre: **se reconstruye sobre el archivo que se abrió, no se escribe uno
 * nuevo**.
 */
import { describe, expect, it } from 'vitest';
import {
    colorAssACss,
    cssAColorAss,
    esAss,
    msATiempoAss,
    paraElVideoElAss,
    paraVerElAss,
    parseAssContent,
    reconstructAss,
    tiempoAssAMs,
} from '../src/js/core/ass.js';

/** Un .ass de los que salen de Aegisub, con lo que suelen traer. */
const COMPLETO = `[Script Info]
; Este archivo lo maquetó otra persona y este comentario tiene que seguir aquí.
Title: Episodio 1
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1
Style: Cartel,Arial,36,&H0000FFFF,&H000000FF,&H00000000,&H00000000,0,1,0,0,100,100,0,0,1,2,0,8,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello {\\i1}world{\\i0}
Dialogue: 0,0:00:04.00,0:00:06.50,Default,,0,0,0,,Two lines\\NOf text
Comment: 0,0:00:07.00,0:00:09.00,Default,,0,0,0,,Esto lo descartó el maquetador
Dialogue: 0,0:00:10.00,0:00:12.00,Cartel,Ana,0,0,0,,{\\an8}A sign, up here
`;

/** Un SSA de los antiguos: otra sección de estilos y otro orden de campos. */
const ANTIGUO = `[Script Info]
ScriptType: v4.00

[V4 Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding
Style: Default,Arial,20,16777215,255,0,0,0,0,1,2,0,2,10,10,10,0,1

[Events]
Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: Marked=0,0:00:01.00,0:00:03.00,Default,,0000,0000,0000,,Hola mundo
`;

const idaYVuelta = (texto) => {
    const { entradas, documento } = parseAssContent(texto);
    return reconstructAss(entradas, documento);
};

describe('reconocer el formato', () => {
    it('lo reconoce por sus secciones', () => {
        expect(esAss(COMPLETO)).toBe(true);
        expect(esAss(ANTIGUO)).toBe(true);
        expect(esAss('1\n00:00:01,000 --> 00:00:02,000\nHola')).toBe(false);
        expect(esAss('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola')).toBe(false);
    });
});

describe('los tiempos', () => {
    it('se leen en centésimas, que es como los escribe el formato', () => {
        expect(tiempoAssAMs('0:00:01.00')).toBe(1000);
        expect(tiempoAssAMs('0:00:06.50')).toBe(6500);
        expect(tiempoAssAMs('1:02:03.45')).toBe(3723450);
    });

    it('y se escriben igual', () => {
        expect(msATiempoAss(1000)).toBe('0:00:01.00');
        expect(msATiempoAss(6500)).toBe('0:00:06.50');
        expect(msATiempoAss(3723450)).toBe('1:02:03.45');
    });

    it('sin milésimas, porque el formato no las tiene', () => {
        // Redondear al escribir y no truncar: 1,999 s son dos segundos, no uno
        // con noventa, y un fotograma de diferencia se ve.
        expect(msATiempoAss(1999)).toBe('0:00:02.00');
    });
});

describe('leer un ASS', () => {
    it('lee los diálogos y sus tiempos', () => {
        const { entradas } = parseAssContent(COMPLETO);

        expect(entradas).toHaveLength(3);
        expect(entradas[0].startTimeMs).toBe(1000);
        expect(entradas[1].endTimeMs).toBe(6500);
    });

    it('no se trae los que el maquetador descartó', () => {
        const { entradas } = parseAssContent(COMPLETO);

        // Un "Comment:" es un diálogo apagado: no sale en el vídeo, así que no
        // es un subtítulo que traducir. Pero tiene que volver al archivo.
        expect(entradas.some((e) => e.original.includes('descartó'))).toBe(false);
    });

    it('se trae las marcas de estilo, que son del maquetador', () => {
        const { entradas } = parseAssContent(COMPLETO);

        expect(entradas[0].original).toBe('Hello {\\i1}world{\\i0}');
        // El {\\an8} dice que ese cartel va arriba. Perderlo lo manda abajo,
        // encima del diálogo.
        expect(entradas[2].original).toBe('{\\an8}A sign, up here');
    });

    it('convierte el \\N en un salto de línea, para poder contar las líneas', () => {
        const { entradas } = parseAssContent(COMPLETO);
        expect(entradas[1].original).toBe('Two lines\nOf text');
    });

    it('se queda con el estilo y con quién habla', () => {
        const { entradas } = parseAssContent(COMPLETO);

        expect(entradas[2].estilo).toBe('Cartel');
        expect(entradas[2].nombre).toBe('Ana');
    });

    it('y lee un SSA antiguo, con su otro orden de campos', () => {
        const { entradas } = parseAssContent(ANTIGUO);

        // El orden de los campos lo dice la línea "Format:", no el manual: hay
        // archivos que lo cambian, y darlo por sabido es leer el estilo donde
        // está el tiempo.
        expect(entradas).toHaveLength(1);
        expect(entradas[0].original).toBe('Hola mundo');
        expect(entradas[0].startTimeMs).toBe(1000);
    });
});

describe('abrir y guardar sin traducir devuelve el mismo archivo', () => {
    it('con su cabecera, sus estilos y sus comentarios', () => {
        expect(idaYVuelta(COMPLETO)).toBe(COMPLETO);
    });

    it('con un SSA antiguo', () => {
        expect(idaYVuelta(ANTIGUO)).toBe(ANTIGUO);
    });

    it('con saltos de Windows', () => {
        const conCrlf = COMPLETO.replace(/\n/g, '\r\n');
        expect(idaYVuelta(conCrlf)).toBe(conCrlf);
    });
});

describe('lo que sale traducido', () => {
    it('escribe la traducción y deja el resto de la línea en su sitio', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[2].translation = '{\\an8}Un cartel, aquí arriba';

        const salida = reconstructAss(entradas, documento);

        expect(salida).toContain(
            'Dialogue: 0,0:00:10.00,0:00:12.00,Cartel,Ana,0,0,0,,{\\an8}Un cartel, aquí arriba',
        );
        // Y lo demás donde estaba.
        expect(salida).toContain('PlayResX: 1920');
        expect(salida).toContain('Style: Cartel,Arial,36');
        expect(salida).toContain('Comment: 0,0:00:07.00');
    });

    it('la coma de la traducción no parte la línea en dos', () => {
        // El texto es el último campo justamente porque puede llevar comas. Un
        // lector que parta por todas las comas se come media traducción.
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].translation = 'Hola, mundo, qué tal';

        const { entradas: otraVez } = parseAssContent(reconstructAss(entradas, documento));
        expect(otraVez[0].original).toBe('Hola, mundo, qué tal');
    });

    it('los saltos de línea vuelven a ser \\N', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[1].translation = 'Dos líneas\nde texto';

        expect(reconstructAss(entradas, documento)).toContain('Dos líneas\\Nde texto');
    });

    it('la cursiva del editor se escribe como la escribe el formato', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].translation = 'Hola <i>mundo</i>';

        const salida = reconstructAss(entradas, documento);

        // En ASS no hay <i>: la cursiva es una marca dentro del texto.
        expect(salida).toContain('Hola {\\i1}mundo{\\i0}');
        expect(salida).not.toContain('<i>');
    });

    it('y las etiquetas que pone el navegador se quedan fuera', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].translation = '<div>Hola <b>mundo</b></div>';

        const salida = reconstructAss(entradas, documento);

        expect(salida).not.toContain('<div>');
        expect(salida).toContain('Hola {\\b1}mundo{\\b0}');
    });

    it('un salto de línea de verdad dentro del texto no rompe el archivo', () => {
        // Una línea de diálogo es una línea del archivo: un salto suelto ahí
        // dentro parte el archivo en dos y lo deja sin abrir.
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].translation = 'Hola\nmundo';

        const salida = reconstructAss(entradas, documento);
        expect(salida.split('\n').filter((l) => l.startsWith('Dialogue:'))).toHaveLength(3);
    });
});

describe('cuando se tocan los tiempos', () => {
    it('se reescriben en su sitio y con el formato del archivo', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].startTimeMs = 2000;
        entradas[0].endTimeMs = 4250;

        const salida = reconstructAss(entradas, documento);
        expect(salida).toContain('Dialogue: 0,0:00:02.00,0:00:04.25,Default,,0,0,0,,Hello');
    });
});

describe('partir, fusionar y borrar', () => {
    it('al partir uno salen dos líneas con el mismo estilo', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        const primero = entradas[0];
        const segundo = { ...primero, index: 2, linea: primero.linea };
        primero.original = 'Hello';
        primero.endTimeMs = 2000;
        segundo.original = 'world';
        segundo.startTimeMs = 2040;
        entradas.splice(1, 0, segundo);

        const salida = reconstructAss(entradas, documento);

        expect(salida).toContain('Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello');
        expect(salida).toContain('Dialogue: 0,0:00:02.04,0:00:03.00,Default,,0,0,0,,world');
    });

    it('al borrar uno, su línea se va y las demás no', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas.splice(1, 1);

        const salida = reconstructAss(entradas, documento);

        expect(salida).not.toContain('Two lines');
        expect(salida).toContain('Hello {\\i1}world{\\i0}');
        expect(salida).toContain('A sign, up here');
        // Y no deja una línea en blanco donde estaba.
        expect(salida).not.toContain('\n\nComment:');
    });
});

describe('cómo se ve en el editor', () => {
    it('la cursiva se ve en cursiva', () => {
        expect(paraVerElAss('Hello {\\i1}world{\\i0}')).toBe('Hello <i>world</i>');
    });

    it('y las marcas que no son de estilo se ven, como en Aegisub', () => {
        // {\\an8} dice dónde va el subtítulo. Esconderlo sería esconder trabajo
        // de alguien; quien traduce tiene que verlo para no perderlo.
        expect(paraVerElAss('{\\an8}Un cartel')).toContain('{\\an8}');
    });
});

describe('la tabla de formatos', () => {
    it('lo reconoce por lo que dice el archivo', async () => {
        const { formatoDe } = await import('../src/js/core/formatos.js');

        expect(formatoDe('capitulo.ass', COMPLETO).id).toBe('ass');
        expect(formatoDe('capitulo.ssa', ANTIGUO).id).toBe('ass');
        expect(formatoDe('capitulo.srt', COMPLETO).id).toBe('ass');
    });

    it('se abre y se guarda por la tabla, como los demás', async () => {
        const { formatoPorId } = await import('../src/js/core/formatos.js');
        const ass = formatoPorId('ass');

        const { entradas, documento } = ass.leer(COMPLETO);
        expect(entradas).toHaveLength(3);
        expect(ass.escribir(entradas, documento, {})).toBe(COMPLETO);
    });

    it('y el archivo que se descarga lleva su extensión', async () => {
        const { conLaExtensionDe, formatoPorId } = await import('../src/js/core/formatos.js');
        expect(conLaExtensionDe('capitulo.ssa', formatoPorId('ass'))).toBe('capitulo.ass');
    });
});

/**
 * Un archivo donde el estilo NO está en el texto, que es el caso normal.
 *
 * Éste fue el que enseñó el fallo: un ASS de plantilla, con cuatro estilos en la
 * cabecera y ni una sola marca `{\...}` en los diálogos. Todo lo que distingue
 * un cartel de un diálogo —el color, el cuerpo, la esquina— está en el campo
 * Style de cada línea, y la vista previa lo ignoraba entero.
 */
const CON_ESTILOS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,10,10,40,1
Style: Italic,Arial,56,&H00E0E0E0,&H000000FF,&H00000000,&H00000000,0,1,0,0,100,100,0,0,1,2,1,2,10,10,40,1
Style: Top,Arial,50,&H0000FFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,1,8,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Top,,0,0,0,,This text appears at the top.
Dialogue: 0,0:00:04.50,0:00:08.00,Italic,,0,0,0,,Italic style for narrator thoughts.
Dialogue: 0,0:00:08.50,0:00:12.00,Default,,0,0,0,,And this one is the plain dialogue.
`;

describe('los colores del formato', () => {
    it('se leen al revés, que es como los escribe', () => {
        // En ASS van &HAABBGGRR: primero la transparencia y después azul, verde
        // y rojo, justo al revés que en cualquier otro sitio. Leerlos de
        // izquierda a derecha da el color complementario y nadie se explica por
        // qué el amarillo sale azul.
        expect(colorAssACss('&H0000FFFF')).toBe('rgb(255, 255, 0)');
        expect(colorAssACss('&H00FFFFFF')).toBe('rgb(255, 255, 255)');
        expect(colorAssACss('&H00FF0000')).toBe('rgb(0, 0, 255)');
    });

    it('con su transparencia, que también va al revés', () => {
        // 0 es opaco y 255 invisible.
        expect(colorAssACss('&H80FFFFFF')).toContain('rgba(255, 255, 255');
    });

    it('y en decimal, como los escriben los SSA antiguos', () => {
        expect(colorAssACss('16777215')).toBe('rgb(255, 255, 255)');
    });

    it('lo que no se entiende no se inventa', () => {
        expect(colorAssACss('')).toBe('');
        expect(colorAssACss('rojo')).toBe('');
    });
});

describe('los estilos de la cabecera', () => {
    it('se leen todos', () => {
        const { documento } = parseAssContent(CON_ESTILOS);

        expect(Object.keys(documento.estilos).sort()).toEqual(['Default', 'Italic', 'Top']);
        expect(documento.resolucion).toEqual({ x: 1920, y: 1080 });
    });

    it('con su color, su cuerpo y dónde van', () => {
        const { documento } = parseAssContent(CON_ESTILOS);

        expect(documento.estilos.Top.color).toBe('rgb(255, 255, 0)');
        expect(documento.estilos.Top.negrita).toBe(true);
        expect(documento.estilos.Top.vertical).toBe('arriba');
        expect(documento.estilos.Italic.cursiva).toBe(true);
        expect(documento.estilos.Default.vertical).toBe('abajo');
    });

    it('y el archivo sigue volviendo igual', () => {
        expect(idaYVuelta(CON_ESTILOS)).toBe(CON_ESTILOS);
    });
});

describe('cómo se ve encima del vídeo', () => {
    const verElDe = (cual) => {
        const { entradas, documento } = parseAssContent(CON_ESTILOS);
        return paraElVideoElAss(entradas[cual].original, entradas[cual], documento);
    };

    it('cada línea con el color y la esquina de su estilo', () => {
        // Sin esto, un archivo con cuatro estilos se veía cuatro veces igual:
        // blanco y abajo. Eso no es una vista previa, es un cuadro de texto.
        const arriba = verElDe(0);
        expect(arriba.css.color).toBe('rgb(255, 255, 0)');
        expect(arriba.css.fontWeight).toBe('700');
        expect(arriba.vertical).toBe('arriba');

        const abajo = verElDe(2);
        expect(abajo.css.color).toBe('rgb(255, 255, 255)');
        expect(abajo.vertical).toBe('abajo');
    });

    it('y la cursiva del estilo, aunque el texto no lleve ninguna marca', () => {
        expect(verElDe(1).css.fontStyle).toBe('italic');
    });

    it('el cuerpo, en proporción y no en píxeles del archivo', () => {
        // Los cuerpos del archivo son píxeles de un vídeo de 1920×1080 y la
        // vista previa mide lo que mida. En proporción, un cartel más pequeño
        // que el diálogo se sigue viendo más pequeño, y el tamaño general lo
        // sigue mandando quien traduce con su selector.
        expect(verElDe(0).css.fontSize).toBe('83%');
        expect(verElDe(2).css.fontSize).toBeUndefined();
    });

    it('las marcas de dentro mandan sobre el estilo de la línea', () => {
        const { entradas, documento } = parseAssContent(CON_ESTILOS);
        const visto = paraElVideoElAss('{\\an8}{\\c&H0000FF&}Rojo y arriba', entradas[2], documento);

        expect(visto.css.color).toBe('rgb(255, 0, 0)');
        expect(visto.vertical).toBe('arriba');
    });

    it('lo que no se puede pintar se quita, no se escribe', () => {
        const { entradas, documento } = parseAssContent(CON_ESTILOS);
        const visto = paraElVideoElAss(
            '{\\pos(300,400)\\fad(200,200)}Un cartel',
            entradas[2],
            documento,
        );

        // Un {\pos} es movimiento: en una vista previa quieta no se representa.
        // Lo que no vale es dejarlo escrito encima de la cara de alguien.
        expect(visto.html).toBe('Un cartel');
    });

    it('la cursiva escrita en el texto sí se pinta', () => {
        const { entradas, documento } = parseAssContent(CON_ESTILOS);
        const visto = paraElVideoElAss('Hola {\\i1}mundo{\\i0}', entradas[2], documento);

        expect(visto.html).toBe('Hola <i>mundo</i>');
    });
});

describe('el color, en las dos direcciones', () => {
    it('el que escribe el editor se guarda como lo escribe el formato', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].translation = 'Un <font color="#ffff00">aviso</font>';

        const salida = reconstructAss(entradas, documento);

        // En ASS no hay <font>: el color es una marca dentro del texto, y va al
        // revés —azul, verde, rojo—. Antes se perdía sin decir nada: se veía el
        // amarillo en el editor y salía en blanco en el archivo.
        expect(salida).toContain('Un {\\c&H00FFFF&}aviso{\\c}');
        expect(salida).not.toContain('<font');
    });

    it('y el del archivo se ve del color que va a salir', () => {
        expect(paraVerElAss('{\\c&H00FFFF&}Amarillo{\\c}')).toBe(
            '<font color="rgb(255, 255, 0)">Amarillo</font>',
        );
    });

    it('un color que no se entiende no se inventa ni rompe la línea', () => {
        const { entradas, documento } = parseAssContent(COMPLETO);
        entradas[0].translation = '<font color="chartreuse">Hola</font>';

        const salida = reconstructAss(entradas, documento);
        expect(salida).toContain(',Hola{\\c}');
    });

    it('el camino de vuelta convierte los tres formatos que escribe un navegador', () => {
        expect(cssAColorAss('#ffff00')).toBe('&H00FFFF&');
        expect(cssAColorAss('#ff0')).toBe('&H00FFFF&');
        expect(cssAColorAss('rgb(255, 191, 0)')).toBe('&H00BFFF&');
        expect(cssAColorAss('lo que sea')).toBe('');
    });
});
