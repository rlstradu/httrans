/**
 * TBX: escribir y leer glosarios.
 *
 * Lo que se comprueba aquí es sobre todo que **un glosario hecho en PandaTerm
 * se abre entero en Poanda y al revés**. Las dos herramientas son del mismo
 * proyecto y la gente mueve glosarios de una a otra; si el archivo pierde por
 * el camino la definición o las notas, el trabajo de documentar un término se
 * queda en la herramienta donde se hizo.
 */
import { describe, it, expect } from 'vitest';
import {
    enderezarGlosario,
    generarTBX,
    leerTBX,
    normalizarTermino,
    tieneFicha,
} from '../src/js/core/tbx.js';

const TERMINO = {
    srcLang: 'en',
    srcTerm: 'file',
    srcPartOfSpeech: 'noun',
    tgtLang: 'es',
    tgtTerm: 'archivo',
    definition: 'A named collection of data stored on a disk.',
    notes: 'No traducir como "fichero" en este cliente.',
};

/** Un TBX tal y como lo escribe PandaTerm hoy. */
const TBX_DE_PANDATERM = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE martif SYSTEM "TBXcoreStructV02.dtd">
<martif type="TBX" xml:lang="en">
  <martifHeader>
    <fileDesc>
      <sourceDesc>
        <p>Glossary exported from PandaTerm on 2026-09-08T00:00:00.000Z</p>
      </sourceDesc>
    </fileDesc>
  </martifHeader>
  <text>
    <body>
      <termEntry id="c1">
        <langSet xml:lang="en">
          <tig>
            <term>file</term>
            <termNote type="partOfSpeech">noun</termNote>
          </tig>
        </langSet>
        <langSet xml:lang="es">
          <tig>
            <term>archivo</term>
            <termNote type="comment">No traducir como "fichero" en este cliente.</termNote>
            <descrip type="definition">A named collection of data stored on a disk.</descrip>
          </tig>
        </langSet>
      </termEntry>
    </body>
  </text>
</martif>`;

describe('normalizarTermino', () => {
    it('rellena los campos que faltan, sin inventarse nada', () => {
        const t = normalizarTermino({ srcTerm: 'file', tgtTerm: 'archivo' });
        expect(t).toEqual({
            srcLang: '',
            srcTerm: 'file',
            srcPartOfSpeech: '',
            tgtLang: '',
            tgtTerm: 'archivo',
            tgtPartOfSpeech: '',
            definition: '',
            notes: '',
        });
    });

    it('quita los espacios de los extremos', () => {
        expect(normalizarTermino({ srcTerm: '  file  ' }).srcTerm).toBe('file');
    });

    it('tieneFicha distingue un término documentado de uno a secas', () => {
        expect(tieneFicha({ srcTerm: 'file', tgtTerm: 'archivo' })).toBe(false);
        expect(tieneFicha({ srcTerm: 'file', tgtTerm: 'archivo', notes: 'ojo' })).toBe(true);
        expect(tieneFicha({ srcTerm: 'file', srcPartOfSpeech: 'noun' })).toBe(true);
    });
});

describe('generarTBX', () => {
    it('escribe langSet en minúscula, como el estándar', () => {
        // Poanda escribía <LangSet>, y como en XML las mayúsculas cuentan, el
        // archivo entraba VACÍO en PandaTerm y en las demás herramientas, sin
        // dar ningún error: el peor fallo posible, porque parece que funciona.
        const xml = generarTBX([TERMINO], { origen: 'en', destino: 'es' });
        expect(xml).toContain('<langSet xml:lang="en">');
        expect(xml).not.toContain('<LangSet');
    });

    it('lleva la cabecera que pide el formato', () => {
        const xml = generarTBX([TERMINO], { origen: 'en', destino: 'es' });
        expect(xml).toContain('<!DOCTYPE martif SYSTEM "TBXcoreStructV02.dtd">');
        expect(xml).toContain('<martifHeader>');
        expect(xml).toContain('<sourceDesc>');
    });

    it('escapa lo que rompería el archivo', () => {
        const xml = generarTBX(
            [{ srcTerm: 'AT&T', tgtTerm: '<b>negrita</b>', notes: 'comillas "así"' }],
            { origen: 'en', destino: 'es' },
        );
        expect(xml).toContain('AT&amp;T');
        expect(xml).toContain('&lt;b&gt;negrita&lt;/b&gt;');
        // Y lo escrito se puede volver a leer, que es la prueba de verdad.
        const { terminos } = leerTBX(xml);
        expect(terminos[0].srcTerm).toBe('AT&T');
        expect(terminos[0].tgtTerm).toBe('<b>negrita</b>');
        expect(terminos[0].notes).toBe('comillas "así"');
    });

    it('pone los termNote antes que los descrip', () => {
        // Lo exige la DTD del formato: <tig> es (term, termNote*, auxInfo).
        // Trados rechaza entradas que no respeten ese orden.
        const xml = generarTBX([TERMINO], { origen: 'en', destino: 'es' });
        expect(xml.indexOf('termNote type="comment"')).toBeLessThan(
            xml.indexOf('descrip type="definition"'),
        );
    });

    it('no escribe los campos vacíos', () => {
        const xml = generarTBX([{ srcTerm: 'file', tgtTerm: 'archivo' }], {
            origen: 'en',
            destino: 'es',
        });
        expect(xml).not.toContain('descrip');
        expect(xml).not.toContain('termNote');
    });

    it('usa el par del proyecto cuando el término no trae idiomas', () => {
        const xml = generarTBX([{ srcTerm: 'file', tgtTerm: 'archivo' }], {
            origen: 'en',
            destino: 'es',
        });
        expect(xml).toContain('<langSet xml:lang="en">');
        expect(xml).toContain('<langSet xml:lang="es">');
    });

    it('con el glosario vacío devuelve un archivo válido, no un destrozo', () => {
        const xml = generarTBX([], { origen: 'en', destino: 'es' });
        expect(xml).toContain('<body>');
        expect(leerTBX(xml).terminos).toEqual([]);
    });
});

describe('leerTBX', () => {
    it('abre entero un glosario de PandaTerm', () => {
        const { terminos, dialecto } = leerTBX(TBX_DE_PANDATERM);
        expect(dialecto).toBe('martif');
        expect(terminos).toHaveLength(1);
        expect(terminos[0]).toEqual({
            srcLang: 'en',
            srcTerm: 'file',
            srcPartOfSpeech: 'noun',
            tgtLang: 'es',
            tgtTerm: 'archivo',
            tgtPartOfSpeech: '',
            definition: 'A named collection of data stored on a disk.',
            notes: 'No traducir como "fichero" en este cliente.',
        });
    });

    it('acepta el LangSet con mayúscula de los archivos viejos', () => {
        const viejo = TBX_DE_PANDATERM.replace(/langSet/g, 'LangSet');
        const { terminos } = leerTBX(viejo);
        expect(terminos).toHaveLength(1);
        expect(terminos[0].srcTerm).toBe('file');
    });

    it('entiende también el dialecto nuevo del formato', () => {
        const nuevo = `<?xml version="1.0"?>
<tbx>
  <text><body>
    <conceptEntry id="c1">
      <descrip type="definition">Una definición del concepto.</descrip>
      <langSec xml:lang="en"><termSec><term>file</term></termSec></langSec>
      <langSec xml:lang="es"><termSec><term>archivo</term></termSec></langSec>
    </conceptEntry>
  </body></text>
</tbx>`;
        const { terminos, dialecto } = leerTBX(nuevo);
        expect(dialecto).toBe('tbx');
        expect(terminos[0].srcTerm).toBe('file');
        expect(terminos[0].tgtTerm).toBe('archivo');
        expect(terminos[0].definition).toBe('Una definición del concepto.');
    });

    it('un archivo que no es TBX no da términos ni revienta', () => {
        expect(leerTBX('<tmx><body><tu/></body></tmx>')).toEqual({
            terminos: [],
            dialecto: null,
        });
        expect(leerTBX('esto no es ni XML')).toEqual({ terminos: [], dialecto: null });
        expect(leerTBX('')).toEqual({ terminos: [], dialecto: null });
        expect(leerTBX(null)).toEqual({ terminos: [], dialecto: null });
    });

    it('se salta las entradas con un solo idioma', () => {
        const cojo = `<martif type="TBX" xml:lang="en"><text><body>
      <termEntry><langSet xml:lang="en"><tig><term>file</term></tig></langSet></termEntry>
    </body></text></martif>`;
        expect(leerTBX(cojo).terminos).toEqual([]);
    });
});

describe('ida y vuelta', () => {
    it('lo que se escribe se vuelve a leer igual, campo por campo', () => {
        const glosario = [
            TERMINO,
            { srcTerm: 'string', tgtTerm: 'cadena', srcPartOfSpeech: 'noun' },
            { srcTerm: 'save', tgtTerm: 'guardar', notes: 'verbo, no sustantivo' },
        ];
        const xml = generarTBX(glosario, { origen: 'en', destino: 'es' });
        const { terminos } = leerTBX(xml);

        expect(terminos).toHaveLength(3);
        terminos.forEach((leido, i) => {
            const escrito = normalizarTermino({
                ...glosario[i],
                srcLang: glosario[i].srcLang || 'en',
                tgtLang: glosario[i].tgtLang || 'es',
            });
            expect(leido).toEqual(escrito);
        });
    });

    it('un salto de línea dentro de una nota sobrevive al viaje', () => {
        const xml = generarTBX([{ srcTerm: 'a', tgtTerm: 'b', definition: 'uno\ndos' }], {
            origen: 'en',
            destino: 'es',
        });
        expect(leerTBX(xml).terminos[0].definition).toBe('uno\ndos');
    });
});

describe('enderezarGlosario', () => {
    it('da la vuelta a las entradas que vienen al revés', () => {
        const mezclado = [
            { srcLang: 'en', srcTerm: 'file', tgtLang: 'es', tgtTerm: 'archivo' },
            { srcLang: 'en', srcTerm: 'save', tgtLang: 'es', tgtTerm: 'guardar' },
            // Esta viene del revés: sin enderezarla, "cadena" se buscaría en el
            // texto original inglés y no se resaltaría nunca.
            { srcLang: 'es', srcTerm: 'cadena', tgtLang: 'en', tgtTerm: 'string' },
        ];
        const derecho = enderezarGlosario(mezclado);
        expect(derecho.map((t) => t.srcTerm)).toEqual(['file', 'save', 'string']);
        expect(derecho.every((t) => t.srcLang === 'en')).toBe(true);
    });

    it('la ficha viaja con el término al darle la vuelta', () => {
        const [t] = enderezarGlosario([
            { srcLang: 'en', srcTerm: 'file', tgtLang: 'es', tgtTerm: 'archivo' },
            { srcLang: 'en', srcTerm: 'save', tgtLang: 'es', tgtTerm: 'guardar' },
            {
                srcLang: 'es',
                srcTerm: 'cadena',
                srcPartOfSpeech: 'noun',
                tgtLang: 'en',
                tgtTerm: 'string',
                tgtPartOfSpeech: 'verb',
                definition: 'Una secuencia de caracteres.',
            },
        ]).slice(2);
        expect(t.srcTerm).toBe('string');
        expect(t.srcPartOfSpeech).toBe('verb');
        expect(t.tgtPartOfSpeech).toBe('noun');
        expect(t.definition).toBe('Una secuencia de caracteres.');
    });

    it('con un solo idioma no toca nada', () => {
        const uno = [{ srcLang: 'en', srcTerm: 'file', tgtLang: 'en', tgtTerm: 'archivo' }];
        expect(enderezarGlosario(uno)[0].srcTerm).toBe('file');
    });
});
