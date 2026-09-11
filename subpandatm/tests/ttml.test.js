/**
 * TTML (y sus primos DFXP e IMSC): leerlo y devolverlo entero.
 *
 * Es el formato de las plataformas grandes y de la televisión, y el más rico de
 * los que abre subpandaTM. Un archivo trae, además de los subtítulos, el trabajo
 * de quien lo maquetó: estilos, regiones de pantalla, base de tiempos,
 * fotogramas por segundo, comentarios y a veces metadatos del encargo. Nada de
 * eso se traduce y todo eso tiene que volver.
 *
 * De ahí la regla con la que está escrito el lector, la misma de Poanda: **se
 * reconstruye sobre el archivo que se abrió, no se escribe uno nuevo**. Estos
 * tests existen para que esa frase sea comprobable y no una intención.
 */
import { describe, expect, it } from 'vitest';
import {
    esTtml,
    msATiempoTtml,
    paraVerElTtml,
    parseTtmlContent,
    reconstructTtml,
    tiempoTtmlAMs,
} from '../src/js/core/ttml.js';

/** Un TTML de los que manda una plataforma: con cabeza, estilos y regiones. */
const COMPLETO = `<?xml version="1.0" encoding="utf-8"?>
<!-- Este comentario lo puso quien maquetó el archivo y tiene que seguir aquí. -->
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:ttp="http://www.w3.org/ns/ttml#parameter"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    ttp:frameRate="25" xml:lang="en">
  <head>
    <metadata>
      <ttm:title>Episodio 1</ttm:title>
    </metadata>
    <styling>
      <style xml:id="normal" tts:fontFamily="Arial" tts:fontSize="80%" tts:color="white"/>
    </styling>
    <layout>
      <region xml:id="abajo" tts:origin="10% 80%" tts:extent="80% 20%"/>
    </layout>
  </head>
  <body>
    <div region="abajo" style="normal">
      <p begin="00:00:01.000" end="00:00:03.000">Hello <span tts:fontStyle="italic">world</span></p>
      <p begin="00:00:04.000" end="00:00:06.500">Two lines<br/>of text</p>
      <p begin="00:00:08.000" end="00:00:10.000">Tom &amp; Jerry</p>
    </div>
  </body>
</tt>
`;

/** El mismo formato, pero contando en fotogramas, que es lo que hace la tele. */
const CON_FOTOGRAMAS = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:frameRate="25">
  <body>
    <div>
      <p begin="00:00:01:12" end="00:00:03:00">Frames</p>
      <p begin="4.5s" dur="2s">Con unidad</p>
    </div>
  </body>
</tt>
`;

const idaYVuelta = (texto) => {
    const { entradas, documento } = parseTtmlContent(texto);
    return reconstructTtml(entradas, documento);
};

describe('reconocer el formato', () => {
    it('lo reconoce por su elemento raíz, no por la extensión', () => {
        expect(esTtml(COMPLETO)).toBe(true);
        expect(esTtml('<tt><body/></tt>')).toBe(true);
        expect(esTtml('<tt:tt xmlns:tt="..."><body/></tt:tt>')).toBe(true);
        expect(esTtml('1\n00:00:01,000 --> 00:00:02,000\nHola')).toBe(false);
        expect(esTtml('<xliff version="2.0"/>')).toBe(false);
    });
});

describe('los tiempos, en las cuatro notaciones que admite el formato', () => {
    it('de reloj', () => {
        expect(tiempoTtmlAMs('00:00:01.500')).toBe(1500);
        expect(tiempoTtmlAMs('01:02:03.250')).toBe(3723250);
    });

    it('de reloj con fotogramas', () => {
        expect(tiempoTtmlAMs('00:00:01:12', { fps: 25 })).toBe(1480);
        expect(tiempoTtmlAMs('00:00:01:12', { fps: 24 })).toBe(1500);
    });

    it('con unidad', () => {
        expect(tiempoTtmlAMs('1.5s')).toBe(1500);
        expect(tiempoTtmlAMs('100ms')).toBe(100);
        expect(tiempoTtmlAMs('2m')).toBe(120000);
        expect(tiempoTtmlAMs('1h')).toBe(3600000);
        expect(tiempoTtmlAMs('36f', { fps: 24 })).toBe(1500);
        expect(tiempoTtmlAMs('500t', { tics: 1000 })).toBe(500);
    });

    it('sin nada, que son segundos', () => {
        expect(tiempoTtmlAMs('3')).toBe(3000);
    });

    it('y NaN cuando ahí no hay un tiempo', () => {
        expect(Number.isNaN(tiempoTtmlAMs(''))).toBe(true);
        expect(Number.isNaN(tiempoTtmlAMs(null))).toBe(true);
        expect(Number.isNaN(tiempoTtmlAMs('mañana'))).toBe(true);
    });

    it('los devuelve escritos como los escribía el archivo', () => {
        // Cambiarle la notación a un archivo porque se ha tocado un tiempo es
        // devolverlo distinto de como vino.
        expect(msATiempoTtml(1500, '00:00:00.000')).toBe('00:00:01.500');
        expect(msATiempoTtml(1480, '00:00:00:00', { fps: 25 })).toBe('00:00:01:12');
        expect(msATiempoTtml(1500, '0s')).toBe('1.500s');
        expect(msATiempoTtml(1500, '0ms')).toBe('1500ms');
    });
});

describe('leer un TTML', () => {
    it('lee los subtítulos del cuerpo y solo los del cuerpo', () => {
        const { entradas } = parseTtmlContent(COMPLETO);

        // "Episodio 1" está en la cabecera: es el título del encargo, no un
        // subtítulo, y traducirlo sería meterlo en el vídeo.
        expect(entradas).toHaveLength(3);
        expect(entradas.some((e) => e.original.includes('Episodio'))).toBe(false);
    });

    it('lee los tiempos', () => {
        const { entradas } = parseTtmlContent(COMPLETO);
        expect(entradas[0].startTimeMs).toBe(1000);
        expect(entradas[0].endTimeMs).toBe(3000);
        expect(entradas[1].durationMs).toBe(2500);
    });

    it('cuenta con los fotogramas del archivo y con dur', () => {
        const { entradas } = parseTtmlContent(CON_FOTOGRAMAS);
        expect(entradas[0].startTimeMs).toBe(1480);
        expect(entradas[0].endTimeMs).toBe(3000);
        expect(entradas[1].startTimeMs).toBe(4500);
        expect(entradas[1].endTimeMs).toBe(6500);
    });

    it('se trae el marcado de dentro, que es parte del segmento', () => {
        const { entradas } = parseTtmlContent(COMPLETO);
        expect(entradas[0].original).toBe('Hello <span tts:fontStyle="italic">world</span>');
    });

    it('convierte el <br/> en un salto de línea, para poder contarlas', () => {
        const { entradas } = parseTtmlContent(COMPLETO);
        expect(entradas[1].original).toBe('Two lines\nof text');
    });

    it('deshace las entidades para que se lea lo que se ve en pantalla', () => {
        const { entradas } = parseTtmlContent(COMPLETO);
        // Lo que se manda a la memoria de traducción y a la IA es esta cadena:
        // si va con "&amp;" dentro, la traducción vuelve con "&amp;" dentro.
        expect(entradas[2].original).toBe('Tom & Jerry');
    });

    it('numera los subtítulos y apunta de qué párrafo salió cada uno', () => {
        const { entradas } = parseTtmlContent(COMPLETO);
        expect(entradas.map((e) => e.index)).toEqual([1, 2, 3]);
        expect(entradas.map((e) => e.parrafo)).toEqual([0, 1, 2]);
    });
});

describe('abrir y guardar sin traducir devuelve el mismo archivo', () => {
    it('con cabecera, estilos, regiones y comentarios', () => {
        expect(idaYVuelta(COMPLETO)).toBe(COMPLETO);
    });

    it('contando en fotogramas y con dur', () => {
        expect(idaYVuelta(CON_FOTOGRAMAS)).toBe(CON_FOTOGRAMAS);
    });

    it('con saltos de Windows', () => {
        const conCrlf = COMPLETO.replace(/\n/g, '\r\n');
        expect(idaYVuelta(conCrlf)).toBe(conCrlf);
    });

    it('con la sangría y las comillas raras que traiga', () => {
        const raro = `<tt xmlns="http://www.w3.org/ns/ttml">
\t<body><div>
\t\t\t<p   begin='00:00:01.000'   end='00:00:02.000'   >Hola</p>
\t</div></body>
</tt>`;
        expect(idaYVuelta(raro)).toBe(raro);
    });
});

/**
 * Un TTML escrito con sangría, que es como se escriben de verdad: el `<p>` en
 * una línea, el texto en otra y el cierre en una tercera.
 */
const CON_SANGRIA = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body region="subtitleArea">
    <div>
      <p xml:id="subtitle1" begin="0.76s" end="3.45s">
        It seems a paradox, does it not,
      </p>
      <p xml:id="subtitle2" begin="5.0s" end="10.0s">
        that the image formed on<br/>
        the Retina should be inverted?
      </p>
    </div>
  </body>
</tt>
`;

describe('la sangría del archivo no es parte del subtítulo', () => {
    it('no cuenta el salto de línea del archivo como una línea del subtítulo', () => {
        const { entradas } = parseTtmlContent(CON_SANGRIA);

        // Lo que parte una línea de otra es el <br/>, y solo el <br/>. El salto
        // que viene detrás es del archivo, para poder leerlo.
        expect(entradas[1].original).toBe('that the image formed on\nthe Retina should be inverted?');
        expect(entradas[1].original.split('\n')).toHaveLength(2);
    });

    it('ni la sangría como caracteres del subtítulo', () => {
        const { entradas } = parseTtmlContent(CON_SANGRIA);

        // Con los espacios dentro, la segunda línea contaba 38 caracteres en
        // lugar de 30 y se encendía en rojo un subtítulo que estaba bien.
        expect(entradas[1].original.split('\n')[1]).toBe('the Retina should be inverted?');
        expect(entradas[0].original).toBe('It seems a paradox, does it not,');
    });

    it('y aun así el archivo vuelve exactamente como vino', () => {
        expect(idaYVuelta(CON_SANGRIA)).toBe(CON_SANGRIA);
    });

    it('salvo que el archivo pida que se respeten los espacios', () => {
        // xml:space="preserve" es la manera que tiene el formato de decir
        // "esto está escrito así a propósito".
        const conEspacios = CON_SANGRIA.replace('<p xml:id="subtitle1"', '<p xml:space="preserve" xml:id="subtitle1"');
        const { entradas } = parseTtmlContent(conEspacios);

        expect(entradas[0].original).toBe('It seems a paradox, does it not,');
        expect(idaYVuelta(conEspacios)).toBe(conEspacios);
    });

    it('al traducir, la línea del archivo se escribe entera y limpia', () => {
        const { entradas, documento } = parseTtmlContent(CON_SANGRIA);
        entradas[1].translation = 'que la imagen que se forma\nen la retina esté invertida?';

        const salida = reconstructTtml(entradas, documento);

        expect(salida).toContain(
            '<p xml:id="subtitle2" begin="5.0s" end="10.0s">que la imagen que se forma<br/>en la retina esté invertida?</p>',
        );
        // Y el de al lado, que nadie tocó, con su sangría intacta.
        expect(salida).toContain('        It seems a paradox, does it not,\n');
    });
});

describe('la codificación que declara el archivo', () => {
    it('la pone al día, porque se guarda siempre en UTF-8', () => {
        const antiguo = `<?xml version="1.0" encoding="windows-1252"?>
<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0s" end="1s">Añá</p></div></body></tt>`;

        // Devolver esa línea tal cual sería entregar un archivo que miente
        // sobre sí mismo: el primer acento lo abriría roto.
        expect(idaYVuelta(antiguo)).toContain('encoding="utf-8"');
        expect(idaYVuelta(antiguo)).toContain('<p begin="0s" end="1s">Añá</p>');
    });

    it('y no la toca cuando ya estaba bien', () => {
        expect(idaYVuelta(COMPLETO)).toBe(COMPLETO);
        expect(idaYVuelta('<?xml version="1.0" encoding="UTF-8"?>\n<tt><body/></tt>')).toContain(
            'encoding="UTF-8"',
        );
    });
});

describe('lo que sale traducido', () => {
    it('escribe la traducción y deja el resto del archivo en su sitio', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[0].translation = 'Hola <span tts:fontStyle="italic">mundo</span>';

        const salida = reconstructTtml(entradas, documento);

        expect(salida).toContain('Hola <span tts:fontStyle="italic">mundo</span>');
        expect(salida).toContain('<region xml:id="abajo"');
        expect(salida).toContain('<ttm:title>Episodio 1</ttm:title>');
        expect(salida).toContain('<!-- Este comentario');
        expect(salida).toContain('ttp:frameRate="25"');
        // Los subtítulos que nadie tocó salen exactamente como entraron.
        expect(salida).toContain('<p begin="00:00:04.000" end="00:00:06.500">Two lines<br/>of text</p>');
    });

    it('devuelve los saltos de línea como <br/>, que es como se escriben aquí', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[1].translation = 'Dos líneas\nde texto';

        expect(reconstructTtml(entradas, documento)).toContain('Dos líneas<br/>de texto');
    });

    it('escapa lo que hay que escapar y deja en pie las etiquetas del formato', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[2].translation = 'Tom & Jerry <span tts:fontStyle="italic">y su 5 < 6</span>';

        const salida = reconstructTtml(entradas, documento);

        // Un "&" o un "<" sueltos sin escapar dejan el archivo sin abrir.
        expect(salida).toContain('Tom &amp; Jerry <span tts:fontStyle="italic">y su 5 &lt; 6</span>');
    });

    it('quita las etiquetas que pone el navegador y no son del formato', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        // Esto es lo que deja un campo contenteditable cuando se trabaja en él.
        entradas[0].translation = '<div>Hola <b>mundo</b></div>';

        const salida = reconstructTtml(entradas, documento);

        expect(salida).not.toContain('<div>');
        // Y la negrita, escrita como la escribe TTML.
        expect(salida).toContain('Hola <span tts:fontWeight="bold">mundo</span>');
    });

    it('sigue siendo un XML que se puede volver a abrir', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[0].translation = 'Hola & adiós';

        const otraVez = parseTtmlContent(reconstructTtml(entradas, documento));
        expect(otraVez.entradas[0].original).toBe('Hola & adiós');
    });
});

describe('la cursiva, que en TTML no es una etiqueta sino un atributo', () => {
    it('lo que escribe el editor se guarda como lo escribe el formato', async () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[0].translation = 'Hola <i>mundo</i>';

        const salida = reconstructTtml(entradas, documento);

        // En TTML no hay <i>. Un archivo con <i> dentro es un archivo que el
        // control de calidad de una plataforma devuelve.
        expect(salida).toContain('Hola <span tts:fontStyle="italic">mundo</span>');
        expect(salida).not.toContain('<i>');
    });

    it('y lo mismo con la negrita, el subrayado y el color', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[0].translation =
            '<b>uno</b> <u>dos</u> <font color="#ffff00">tres</font>';

        const salida = reconstructTtml(entradas, documento);

        expect(salida).toContain('<span tts:fontWeight="bold">uno</span>');
        expect(salida).toContain('<span tts:textDecoration="underline">dos</span>');
        expect(salida).toContain('<span tts:color="#ffff00">tres</span>');
        expect(salida).not.toContain('<font');
    });

    it('el <span> que ya venía en el archivo se respeta tal cual', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[0].translation = 'Hola <span tts:fontStyle="italic">mundo</span>';

        expect(reconstructTtml(entradas, documento)).toContain(
            'Hola <span tts:fontStyle="italic">mundo</span>',
        );
    });

    it('en el editor se ve en cursiva lo que va a salir en cursiva', () => {
        // El navegador no sabe que tts:fontStyle significa nada: pintado tal
        // cual, quien traduce ve texto normal y no se entera de que esa palabra
        // va en cursiva.
        const visto = paraVerElTtml('Hello <span tts:fontStyle="italic">world</span>');

        expect(visto).toContain('style="font-style:italic"');
        // Y el atributo del archivo sigue ahí: esto es solo para verlo.
        expect(visto).toContain('tts:fontStyle="italic"');
    });

    it('y en su color, cuando el archivo lo dice', () => {
        expect(paraVerElTtml('<span tts:color="yellow">¡Eh!</span>')).toContain('style="color:yellow"');
    });

    it('un <span> que solo agrupa no se toca', () => {
        expect(paraVerElTtml('<span style="s2">Hola</span>')).toBe('<span style="s2">Hola</span>');
    });
});

describe('cuando se tocan los tiempos', () => {
    it('los reescribe en la notación del archivo y no en otra', () => {
        const { entradas, documento } = parseTtmlContent(CON_FOTOGRAMAS);
        entradas[0].startTimeMs = 2000;
        entradas[0].endTimeMs = 4000;

        const salida = reconstructTtml(entradas, documento);
        expect(salida).toContain('begin="00:00:02:00"');
        expect(salida).toContain('end="00:00:04:00"');
    });

    it('y no toca la etiqueta del que no se ha movido', () => {
        const { entradas, documento } = parseTtmlContent(CON_FOTOGRAMAS);
        entradas[0].translation = 'Fotogramas';

        const salida = reconstructTtml(entradas, documento);
        // El segundo párrafo escribe sus tiempos con unidad y con dur: si se
        // reescribiera, saldría con otra notación de la que traía.
        expect(salida).toContain('<p begin="4.5s" dur="2s">Con unidad</p>');
    });

    it('mantiene dur cuando el párrafo contaba con dur', () => {
        const { entradas, documento } = parseTtmlContent(CON_FOTOGRAMAS);
        entradas[1].endTimeMs = 7500;

        const salida = reconstructTtml(entradas, documento);
        // Un párrafo puede decir cuándo acaba o cuánto dura: se le contesta en
        // lo que preguntó, sin cambiarle el dur por un end.
        expect(salida).toContain('<p begin="4.5s" dur="3.000s">Con unidad</p>');
    });
});

describe('partir, fusionar y borrar subtítulos', () => {
    it('al partir uno salen dos párrafos con los atributos del original', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        const primero = entradas[0];

        // Es lo que hace el editor al partir: el nuevo hereda el párrafo.
        const segundo = { ...primero, index: 2, parrafo: primero.parrafo };
        primero.original = 'Hello';
        primero.endTimeMs = 2000;
        segundo.original = 'world';
        segundo.startTimeMs = 2040;
        entradas.splice(1, 0, segundo);

        const salida = reconstructTtml(entradas, documento);

        expect(salida).toContain('<p begin="00:00:01.000" end="00:00:02.000">Hello</p>');
        expect(salida).toContain('<p begin="00:00:02.040" end="00:00:03.000">world</p>');
    });

    it('al fusionar dos, el párrafo que sobra desaparece del archivo', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas[0].original = 'Hello world\nTwo lines of text';
        entradas[0].endTimeMs = 6500;
        entradas.splice(1, 1);

        const salida = reconstructTtml(entradas, documento);

        expect(salida).toContain('Hello world<br/>Two lines of text');
        expect(salida).not.toContain('Two lines<br/>of text');
        // Y lo demás sigue donde estaba.
        expect(salida).toContain('Tom &amp; Jerry');
    });

    it('al borrar uno, se va su párrafo y no el de al lado', () => {
        const { entradas, documento } = parseTtmlContent(COMPLETO);
        entradas.splice(1, 1);

        const salida = reconstructTtml(entradas, documento);

        expect(salida).not.toContain('Two lines');
        expect(salida).toContain('Hello <span tts:fontStyle="italic">world</span>');
        expect(salida).toContain('Tom &amp; Jerry');
    });
});

describe('la tabla de formatos', () => {
    it('reconoce el TTML por lo que dice el archivo', async () => {
        const { formatoDe } = await import('../src/js/core/formatos.js');

        expect(formatoDe('capitulo.ttml', COMPLETO).id).toBe('ttml');
        expect(formatoDe('capitulo.dfxp', COMPLETO).id).toBe('ttml');
        // Un .xml puede ser cualquier cosa; manda el contenido.
        expect(formatoDe('capitulo.xml', COMPLETO).id).toBe('ttml');
        expect(formatoDe('capitulo.srt', COMPLETO).id).toBe('ttml');
    });

    it('se abre y se guarda por la tabla, como los demás', async () => {
        const { formatoPorId } = await import('../src/js/core/formatos.js');
        const ttml = formatoPorId('ttml');

        const { entradas, documento } = ttml.leer(COMPLETO);
        expect(entradas).toHaveLength(3);
        expect(ttml.escribir(entradas, documento, {})).toBe(COMPLETO);
    });

    it('el archivo que se descarga lleva la extensión del formato', async () => {
        const { conLaExtensionDe, formatoPorId } = await import('../src/js/core/formatos.js');

        expect(conLaExtensionDe('capitulo.dfxp', formatoPorId('ttml'))).toBe('capitulo.ttml');
        expect(conLaExtensionDe('capitulo.ttml', formatoPorId('srt'))).toBe('capitulo.srt');
        expect(conLaExtensionDe('capitulo.xml', formatoPorId('vtt'))).toBe('capitulo.vtt');
    });
});
