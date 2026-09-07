/**
 * La lista de idiomas y lo que se puede deducir de un archivo.
 *
 * Lo que se comprueba aquí no es que la lista tenga tal o cual idioma, sino las
 * dos reglas de las que depende que el par del proyecto sea fiable: que una
 * etiqueta escrita de cualquiera de las maneras que traen los archivos acabe
 * siendo el mismo código, y que lo que se deduce del archivo se deduzca de lo
 * que el archivo dice, no de lo que suele pasar.
 */
import { describe, expect, it } from 'vitest';
import {
    CODIGOS_DE_IDIOMA,
    listaDeIdiomas,
    nombreDeIdioma,
    normalizarIdioma,
} from '../src/js/core/idiomas.js';
import {
    adivinarIdiomas,
    esIdiomaConocido,
    idiomaDelNombre,
    idiomasDeclarados,
} from '../src/js/core/idiomas-declarados.js';

describe('la lista de idiomas', () => {
    it('trae muchos más que la lista corta de antes', () => {
        // La de antes tenía 47 y se quedaba sin la mitad de Asia y de África.
        expect(CODIGOS_DE_IDIOMA.length).toBeGreaterThan(180);
    });

    it('no repite ningún código', () => {
        expect(new Set(CODIGOS_DE_IDIOMA).size).toBe(CODIGOS_DE_IDIOMA.length);
    });

    it('trae las variantes que se encargan por separado', () => {
        for (const codigo of ['es-ES', 'es-MX', 'pt-BR', 'pt-PT', 'en-US', 'en-GB', 'fr-CA']) {
            expect(CODIGOS_DE_IDIOMA).toContain(codigo);
        }
    });

    it('enseña el nombre en el idioma de la interfaz, con el código al lado', () => {
        const enEspanol = listaDeIdiomas('es').find((i) => i.codigo === 'de');
        const enIngles = listaDeIdiomas('en').find((i) => i.codigo === 'de');

        expect(enEspanol.etiqueta).toBe('Alemán (de)');
        expect(enIngles.etiqueta).toBe('German (de)');
    });

    it('ordena por nombre y no por código', () => {
        const nombres = listaDeIdiomas('es').map((i) => i.nombre);
        const ordenados = [...nombres].sort(new Intl.Collator('es').compare);
        expect(nombres).toEqual(ordenados);
    });

    it('con un código que no conoce, devuelve el código en vez de un hueco', () => {
        expect(nombreDeIdioma('qqq-XX')).toBe('qqq-XX');
        expect(nombreDeIdioma('')).toBe('');
    });
});

describe('normalizar una etiqueta de idioma', () => {
    it('acepta las tres formas de escribir lo mismo', () => {
        expect(normalizarIdioma('es_ES')).toBe('es-ES');
        expect(normalizarIdioma('PT-br')).toBe('pt-BR');
        expect(normalizarIdioma('  en-us  ')).toBe('en-US');
    });

    it('quita la codificación y la variante que pega gettext detrás', () => {
        expect(normalizarIdioma('en_US.UTF-8')).toBe('en-US');
        expect(normalizarIdioma('ca_ES@valencia')).toBe('ca-ES');
    });

    it('deja el alfabeto en capicúa y la región en mayúscula', () => {
        expect(normalizarIdioma('zh-hans')).toBe('zh-Hans');
        expect(normalizarIdioma('sr-latn-rs')).toBe('sr-Latn-RS');
        expect(normalizarIdioma('es-419')).toBe('es-419');
    });

    it('descarta lo que no tiene forma de etiqueta', () => {
        expect(normalizarIdioma('español')).toBe('');
        expect(normalizarIdioma('')).toBe('');
        expect(normalizarIdioma('12')).toBe('');
    });
});

describe('los idiomas que declara el archivo', () => {
    it('lee la cabecera Language de un .po', () => {
        const po = 'msgid ""\nmsgstr ""\n"Language: pt_BR\\n"\n"Content-Type: text/plain\\n"\n';
        expect(idiomasDeclarados('po', po)).toEqual({ origen: '', destino: 'pt-BR' });
    });

    it('no le inventa un idioma de origen a un .po que no lo declara', () => {
        // Suponerle inglés sería meterle un dato falso al proyecto: un .po de un
        // programa español traducido al catalán existe.
        const po = 'msgid ""\nmsgstr ""\n"Language: ca\\n"\n';
        expect(idiomasDeclarados('po', po).origen).toBe('');
    });

    it('lee los dos idiomas de un XLIFF 1.2', () => {
        const xliff =
            '<?xml version="1.0"?><xliff version="1.2"><file source-language="en-US" target-language="es-ES" datatype="plaintext">';
        expect(idiomasDeclarados('xliff', xliff)).toEqual({
            origen: 'en-US',
            destino: 'es-ES',
        });
    });

    it('lee los dos idiomas de un XLIFF 2.0, que los llama de otra forma', () => {
        const xliff = '<?xml version="1.0"?><xliff version="2.0" srcLang="de" trgLang="fr">';
        expect(idiomasDeclarados('xliff', xliff)).toEqual({ origen: 'de', destino: 'fr' });
    });

    it('los sabores comerciales de XLIFF se leen igual', () => {
        const sdl = '<xliff version="1.2"><file source-language="en" target-language="ja">';
        expect(idiomasDeclarados('sdlxliff', sdl).destino).toBe('ja');
        expect(idiomasDeclarados('mqxliff', sdl).destino).toBe('ja');
    });

    it('lee los de un archivo de Qt', () => {
        const ts = '<?xml version="1.0"?><TS version="2.1" sourcelanguage="en" language="es_ES">';
        expect(idiomasDeclarados('qtts', ts)).toEqual({ origen: 'en', destino: 'es-ES' });
    });

    it('lee el @@locale de un .arb', () => {
        const arb = '{\n  "@@locale": "pt_BR",\n  "hola": "Olá"\n}';
        expect(idiomasDeclarados('arb', arb).destino).toBe('pt-BR');
    });

    it('un formato que no declara nada devuelve dos huecos, sin protestar', () => {
        expect(idiomasDeclarados('docx', 'lo que sea')).toEqual({ origen: '', destino: '' });
        expect(idiomasDeclarados('json', '{"a":1}')).toEqual({ origen: '', destino: '' });
    });
});

describe('el idioma que va en el nombre del archivo', () => {
    it('reconoce las formas de siempre', () => {
        expect(idiomaDelNombre('Strings.es-ES.resx')).toBe('es-ES');
        expect(idiomaDelNombre('mensajes_fr.properties')).toBe('fr');
        expect(idiomaDelNombre('app_pt_BR.arb')).toBe('pt-BR');
        expect(idiomaDelNombre('es.json')).toBe('es');
    });

    it('no confunde un trozo cualquiera con un idioma', () => {
        // "app", "min" y "new" tienen forma de código y no lo son.
        expect(idiomaDelNombre('app.json')).toBe('');
        expect(idiomaDelNombre('bundle.min.js')).toBe('');
        expect(idiomaDelNombre('informe-anual.docx')).toBe('');
    });

    it('esIdiomaConocido separa las etiquetas de verdad de las que lo parecen', () => {
        expect(esIdiomaConocido('es')).toBe(true);
        expect(esIdiomaConocido('pt-BR')).toBe(true);
        expect(esIdiomaConocido('zzz')).toBe(false);
    });
});

describe('lo mejor que se puede saber antes de preguntar', () => {
    it('lo que dice el archivo manda sobre lo que dice el nombre', () => {
        const po = 'msgid ""\nmsgstr ""\n"Language: fr\\n"\n';
        expect(adivinarIdiomas({ formato: 'po', nombre: 'mensajes_de.po', contenido: po })).toEqual({
            origen: '',
            destino: 'fr',
        });
    });

    it('si el archivo no dice nada, se mira el nombre', () => {
        expect(
            adivinarIdiomas({ formato: 'json', nombre: 'traducciones.pt-BR.json', contenido: '{}' }),
        ).toEqual({ origen: '', destino: 'pt-BR' });
    });

    it('si no hay nada de donde tirar, no se inventa nada', () => {
        expect(
            adivinarIdiomas({ formato: 'docx', nombre: 'contrato.docx', contenido: '' }),
        ).toEqual({ origen: '', destino: '' });
    });
});
