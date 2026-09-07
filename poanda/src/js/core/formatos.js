/**
 * Los formatos de archivo que entiende Poanda, en una sola tabla.
 *
 * Antes esto vivía repartido: una lista de extensiones admitidas por un lado,
 * un `if/else` para abrir por otro y otro `if/else` para guardar. Añadir un
 * formato obligaba a acordarse de los tres sitios, y olvidarse de uno daba un
 * archivo que se abría pero no se podía guardar.
 *
 * Ahora un formato es una entrada de esta tabla y nada más. Lo que necesita:
 *
 * - `id`: cómo se llama por dentro. Es lo que se guarda en el proyecto.
 * - `extensiones`: por cuáles se le reconoce.
 * - `etiqueta`: cómo aparece en la lista de proyectos recientes.
 * - `familia`: en qué grupo se enseña en el recuadro donde se sueltan los
 *   archivos ('documentos', 'bilingues', 'aplicaciones', 'maquetacion'). Una
 *   lista de veintitantas extensiones seguidas no se lee; agrupada, sí.
 * - `oculto`: si se abre pero no se anuncia en ese recuadro.
 * - `mime`: con qué tipo se descarga.
 * - `leer(texto)`: convierte el archivo en entradas del editor.
 * - `escribir(entradas, original)`: vuelve a montar el archivo.
 *
 * SOBRE `original`
 *
 * Casi todos los lectores reconstruyen el archivo sobre el que se abrió en
 * lugar de escribirlo de nuevo: se recorre lo que vino y solo se sustituye lo
 * traducido. Así los comentarios, el orden, la sangría y todo lo que el
 * programa no sabía interpretar vuelven intactos. Es la diferencia entre
 * "guardar" y "rehacer el archivo con lo que he entendido de él", y es lo que
 * evita que se pierda en silencio lo que no se supo leer.
 *
 * LOS TRES FORMATOS ANTIGUOS
 *
 * PO, JSON y HTML llegaron antes que esta tabla y tienen su propio camino en
 * files.js, porque hacen más cosas al abrirse (el JSON detecta idiomas, el HTML
 * guarda el documento entero). Están aquí igualmente, marcados con
 * `caminoPropio`, para que la tabla siga siendo la lista completa de lo que
 * Poanda abre. Cuando se pasen al camino general, se les quita la marca.
 */
import { parseArbContent, reconstructArb } from './arb.js';
import { parseCsvContent, reconstructCsv } from './csv.js';
import { parseDitaContent, reconstructDita } from './dita.js';
import { parseEpubContent, reconstructEpub } from './epub.js';
import { parseIdmlContent, reconstructIdml } from './idml.js';
import { parseLocversiaContent, reconstructLocversia } from './locversia.js';
import { parseMqxlzContent, reconstructMqxlz } from './mqxlz.js';
import { parseOdfContent, reconstructOdf } from './odf.js';
import {
    parseDocxContent,
    parsePptxContent,
    parseXlsxContent,
    reconstructDocx,
    reconstructPptx,
    reconstructXlsx,
} from './ooxml.js';
import { parseMdContent, reconstructMd } from './md.js';
import { compileMo, parsePoForMo } from './mo.js';
import { moComoPo } from './mo-lectura.js';
import { parsePoContent, reconstructPo } from './po.js';
import { parseXliffContent, reconstructXliff } from './xliff.js';
import { parsePropertiesContent, reconstructProperties } from './properties.js';
import { parseQtTsContent, reconstructQtTs } from './qtts.js';
import { parseResxContent, reconstructResx } from './resx.js';
import { parseTxtContent, reconstructTxt } from './txt.js';
import { parseWxlContent, reconstructWxl } from './wxl.js';

/** @type {Array<Object>} */
const FORMATOS = [
    {
        id: 'po',
        familia: 'bilingues',
        extensiones: ['.po'],
        etiqueta: 'PO',
        mime: 'text/x-gettext-translation;charset=utf-8',
        caminoPropio: true,
    },
    {
        id: 'json',
        familia: 'aplicaciones',
        extensiones: ['.json'],
        etiqueta: 'JSON',
        mime: 'application/json;charset=utf-8',
        caminoPropio: true,
    },
    {
        id: 'html',
        familia: 'documentos',
        extensiones: ['.html', '.htm'],
        etiqueta: 'HTML',
        mime: 'text/html;charset=utf-8',
        caminoPropio: true,
    },
    {
        id: 'txt',
        familia: 'documentos',
        extensiones: ['.txt'],
        etiqueta: 'TXT',
        mime: 'text/plain;charset=utf-8',
        leer: parseTxtContent,
        escribir: reconstructTxt,
    },
    {
        id: 'properties',
        familia: 'aplicaciones',
        extensiones: ['.properties'],
        etiqueta: 'PROPERTIES',
        mime: 'text/plain;charset=utf-8',
        leer: parsePropertiesContent,
        escribir: reconstructProperties,
    },
    {
        id: 'csv',
        familia: 'documentos',
        extensiones: ['.csv'],
        etiqueta: 'CSV',
        mime: 'text/csv;charset=utf-8',
        leer: parseCsvContent,
        escribir: reconstructCsv,
    },
    {
        id: 'md',
        familia: 'documentos',
        extensiones: ['.md', '.markdown'],
        etiqueta: 'MARKDOWN',
        mime: 'text/markdown;charset=utf-8',
        leer: parseMdContent,
        escribir: reconstructMd,
    },
    {
        id: 'resx',
        familia: 'aplicaciones',
        extensiones: ['.resx'],
        etiqueta: 'RESX',
        mime: 'application/xml;charset=utf-8',
        leer: parseResxContent,
        escribir: reconstructResx,
    },
    {
        id: 'arb',
        familia: 'aplicaciones',
        extensiones: ['.arb'],
        etiqueta: 'ARB',
        mime: 'application/json;charset=utf-8',
        leer: parseArbContent,
        escribir: reconstructArb,
    },
    {
        id: 'qtts',
        familia: 'aplicaciones',
        extensiones: ['.ts'],
        etiqueta: 'QT',
        mime: 'application/xml;charset=utf-8',
        leer: parseQtTsContent,
        escribir: reconstructQtTs,
    },
    {
        id: 'wxl',
        familia: 'aplicaciones',
        extensiones: ['.wxl'],
        etiqueta: 'WXL',
        mime: 'application/xml;charset=utf-8',
        leer: parseWxlContent,
        escribir: reconstructWxl,
    },
    // La familia XLIFF comparte lector y escritor: los cuatro son XLIFF por
    // dentro y lo que cambia es la información propia de cada herramienta, que
    // no se toca. Van por separado en la tabla para que cada extensión aparezca
    // en el diálogo de abrir y en la lista de proyectos con su nombre.
    {
        id: 'xliff',
        familia: 'bilingues',
        extensiones: ['.xliff', '.xlf'],
        etiqueta: 'XLIFF',
        mime: 'application/xliff+xml;charset=utf-8',
        leer: parseXliffContent,
        escribir: reconstructXliff,
    },
    {
        id: 'sdlxliff',
        familia: 'bilingues',
        extensiones: ['.sdlxliff'],
        etiqueta: 'TRADOS',
        mime: 'application/xliff+xml;charset=utf-8',
        leer: parseXliffContent,
        escribir: reconstructXliff,
    },
    {
        id: 'mxliff',
        familia: 'bilingues',
        extensiones: ['.mxliff'],
        etiqueta: 'PHRASE',
        mime: 'application/xliff+xml;charset=utf-8',
        leer: parseXliffContent,
        escribir: reconstructXliff,
    },
    {
        id: 'mqxliff',
        familia: 'bilingues',
        extensiones: ['.mqxliff'],
        etiqueta: 'MEMOQ',
        mime: 'application/xliff+xml;charset=utf-8',
        leer: parseXliffContent,
        escribir: reconstructXliff,
    },
    {
        id: 'dita',
        familia: 'aplicaciones',
        extensiones: ['.dita', '.ditamap'],
        etiqueta: 'DITA',
        mime: 'application/xml;charset=utf-8',
        leer: parseDitaContent,
        escribir: reconstructDita,
    },
    {
        id: 'mo',
        familia: 'bilingues',
        extensiones: ['.mo'],
        etiqueta: 'MO',
        mime: 'application/octet-stream',
        // No es texto: es el catálogo compilado, y se lee y se escribe en
        // binario. Tampoco se reconstruye sobre el original, porque un .mo es un
        // archivo generado y no lleva nada escrito a mano que conservar.
        binario: true,
        leer: (datos) => parsePoContent(moComoPo(datos)),
        escribir: (entradas) => compileMo(parsePoForMo(reconstructPo(entradas))),
    },
    // Los que por dentro son un zip con archivos XML. Todos son binarios: hay
    // que descomprimirlos para leerlos y volver a comprimirlos para guardarlos.
    {
        id: 'docx',
        familia: 'documentos',
        extensiones: ['.docx'],
        etiqueta: 'WORD',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        binario: true,
        leer: parseDocxContent,
        escribir: reconstructDocx,
    },
    {
        id: 'xlsx',
        familia: 'documentos',
        extensiones: ['.xlsx'],
        etiqueta: 'EXCEL',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        binario: true,
        leer: parseXlsxContent,
        escribir: reconstructXlsx,
    },
    {
        id: 'pptx',
        familia: 'documentos',
        extensiones: ['.pptx'],
        etiqueta: 'POWERPOINT',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        binario: true,
        leer: parsePptxContent,
        escribir: reconstructPptx,
    },
    {
        id: 'odt',
        familia: 'documentos',
        extensiones: ['.odt'],
        etiqueta: 'ODT',
        mime: 'application/vnd.oasis.opendocument.text',
        binario: true,
        leer: parseOdfContent,
        escribir: reconstructOdf,
    },
    {
        id: 'ods',
        familia: 'documentos',
        extensiones: ['.ods'],
        etiqueta: 'ODS',
        mime: 'application/vnd.oasis.opendocument.spreadsheet',
        binario: true,
        leer: parseOdfContent,
        escribir: reconstructOdf,
    },
    {
        id: 'odp',
        familia: 'documentos',
        extensiones: ['.odp'],
        etiqueta: 'ODP',
        mime: 'application/vnd.oasis.opendocument.presentation',
        binario: true,
        leer: parseOdfContent,
        escribir: reconstructOdf,
    },
    {
        id: 'epub',
        familia: 'documentos',
        extensiones: ['.epub'],
        etiqueta: 'EPUB',
        mime: 'application/epub+zip',
        binario: true,
        leer: parseEpubContent,
        escribir: reconstructEpub,
    },
    {
        id: 'idml',
        familia: 'maquetacion',
        extensiones: ['.idml'],
        etiqueta: 'INDESIGN',
        mime: 'application/vnd.adobe.indesign-idml-package',
        binario: true,
        leer: parseIdmlContent,
        escribir: reconstructIdml,
    },
    {
        id: 'locversia',
        familia: 'bilingues',
        // Se abre igual que los demás, pero no se anuncia en el recuadro: un
        // proyecto de Locversia no es un archivo que a nadie le manden a
        // traducir, y en una lista que ya es larga solo ocupa sitio.
        oculto: true,
        extensiones: ['.locversia'],
        etiqueta: 'LOCVERSIA',
        mime: 'application/zip',
        binario: true,
        leer: parseLocversiaContent,
        escribir: reconstructLocversia,
    },
    {
        id: 'mqxlz',
        familia: 'bilingues',
        extensiones: ['.mqxlz'],
        etiqueta: 'MEMOQ',
        mime: 'application/zip',
        binario: true,
        leer: parseMqxlzContent,
        escribir: reconstructMqxlz,
    },
];

/** El orden en que se enseñan las familias: de lo más común a lo más especial. */
const ORDEN_DE_FAMILIAS = ['documentos', 'bilingues', 'aplicaciones', 'maquetacion'];

/**
 * Los formatos agrupados por familia, para el recuadro donde se sueltan.
 *
 * De .html y .htm, o de .md y .markdown, se enseña solo la primera: son el
 * mismo formato y poner las dos ocupa sitio sin decir nada nuevo.
 *
 * @returns {Array<{familia: string, formatos: Array<{id: string, extension: string}>}>}
 */
export function formatosPorFamilia() {
    return ORDEN_DE_FAMILIAS.map((familia) => ({
        familia,
        formatos: FORMATOS.filter((f) => f.familia === familia && !f.oculto).map((f) => ({
            id: f.id,
            extension: f.extensiones[0],
        })),
    })).filter((grupo) => grupo.formatos.length > 0);
}

/** Todas las extensiones que Poanda sabe abrir, para avisos y para el filtro. */
export const EXTENSIONES_ADMITIDAS = FORMATOS.flatMap((f) => f.extensiones);

/**
 * Busca el formato al que corresponde una extensión.
 *
 * @param {string} extension Con el punto y en minúsculas ('.po').
 * @returns {Object|null}
 */
export function formatoPorExtension(extension) {
    return FORMATOS.find((f) => f.extensiones.includes(extension)) || null;
}

/**
 * Busca un formato por su identificador interno.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function formatoPorId(id) {
    return FORMATOS.find((f) => f.id === id) || null;
}

export { FORMATOS };
