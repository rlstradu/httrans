/**
 * El traductor que traen algunos navegadores por dentro.
 *
 * Chrome y Edge incluyen desde hace un tiempo un traductor propio: un modelo
 * que se descarga una vez y luego funciona en el ordenador, sin conexión, sin
 * clave y sin coste. Para pretraducir un archivo entero es, con diferencia, lo
 * más rápido que hay, y además el texto del cliente no sale del ordenador.
 *
 * Lo que NO es: una IA con criterio. No respeta el glosario porque se lo pidas,
 * no entiende que "Save" ahí es un botón y no ajusta el tono. Es traducción
 * automática para un primer pase que luego se pospone, y así se le presenta a
 * quien lo usa. Para lo otro está el modelo de lenguaje.
 *
 * Disponible en Chrome y Edge de escritorio. En Safari y Firefox no existe, y
 * en ese caso Poanda ofrece solo el otro motor en lugar de fallar.
 */

/**
 * Dice si este navegador trae traductor.
 *
 * @returns {boolean}
 */
export function hayTraductorEnElNavegador() {
    return typeof globalThis.Translator !== 'undefined';
}

/**
 * Prepara el traductor para un par de idiomas.
 *
 * La primera vez puede tener que descargar el modelo del par, que son unos
 * megas; por eso se avisa del progreso en lugar de dejar la pantalla parada.
 *
 * @param {Object} datos
 * @param {string} datos.origen Código de idioma ('en').
 * @param {string} datos.destino Código de idioma ('es').
 * @param {(porcentaje: number) => void} [datos.alDescargar]
 * @returns {Promise<{traducir: (texto: string) => Promise<string>}>}
 */
export async function prepararTraductorDelNavegador({ origen, destino, alDescargar }) {
    if (!hayTraductorEnElNavegador()) {
        throw new Error('Este navegador no trae traductor propio. Prueba con Chrome o Edge.');
    }

    const par = { sourceLanguage: idiomaCorto(origen), targetLanguage: idiomaCorto(destino) };

    const disponible = await globalThis.Translator.availability(par);
    if (disponible === 'unavailable') {
        throw new Error(
            `El traductor del navegador no admite el par ${par.sourceLanguage} → ${par.targetLanguage}.`,
        );
    }

    const traductor = await globalThis.Translator.create({
        ...par,
        monitor(monitorizador) {
            monitorizador.addEventListener('downloadprogress', (evento) => {
                alDescargar?.(Math.round((evento.loaded || 0) * 100));
            });
        },
    });

    return {
        traducir: (texto) => traductor.translate(texto),
    };
}

/**
 * Se queda con la parte del idioma que entiende el traductor.
 *
 * Los archivos de traducción escriben el idioma de muchas maneras ('es_ES',
 * 'es-419', 'pt_BR'); el traductor del navegador quiere el código corto.
 *
 * @param {string} codigo
 * @returns {string}
 */
export function idiomaCorto(codigo) {
    return String(codigo || '')
        .trim()
        .replace('_', '-')
        .split('-')[0]
        .toLowerCase();
}
