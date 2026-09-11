/**
 * Pretraducir un archivo entero sin que se haga de noche.
 *
 * El error que hace que esto tarde horas es tratarlo como mil traducciones
 * sueltas, una detrás de otra. Aquí se hacen tres cosas para evitarlo:
 *
 * 1. **Antes de gastar una sola llamada, se resuelve lo que se puede solo.**
 *    Los segmentos repetidos se traducen una vez y se copian; los que ya están
 *    en la memoria de traducción al 100% se cogen de ahí; los que no son texto
 *    (una URL, un correo, un número) se copian tal cual. En un archivo de
 *    software esto suele ser un tercio del trabajo, gratis y al instante.
 * 2. **Se mandan varios segmentos en cada petición.** Lo caro no es el texto:
 *    es el ir y venir y las instrucciones, que se repiten igual con uno que con
 *    diez.
 * 3. **Se mandan varias peticiones a la vez.** Mientras una espera respuesta,
 *    las otras van.
 *
 * Todo lo de aquí es lógica sin pantalla: se avisa del avance por una función
 * que se pasa al llamar, y se puede cancelar. Así se puede probar entero.
 */
import { esperar } from './http.js';

/** Lo que se copia sin traducir: no es lenguaje. */
const NO_ES_TEXTO =
    /^(\s*|[\d\s.,:;%+\-*/()[\]{}]*|https?:\/\/\S+|[^\s@]+@[^\s@]+\.[^\s@]+|\{[^{}]*\}|%\w*)$/;

/**
 * Decide qué hacer con cada segmento antes de llamar a nadie.
 *
 * @param {Array<{clave: string, original: string, traduccion: string}>} segmentos
 * @param {Array<{original: string, traduccion: string}>} [memoria]
 * @returns {{resueltos: Map<string, {traduccion: string, origen: string}>, pendientes: Array<Object>}}
 */
export function repartirTrabajo(segmentos, memoria = []) {
    const resueltos = new Map();
    const pendientes = [];
    // Para no traducir dos veces la misma frase: la primera vez se manda, y las
    // siguientes copian el resultado.
    const yaVistos = new Map();

    const deLaMemoria = new Map(
        memoria
            .filter((m) => m.original && m.traduccion)
            .map((m) => [m.original.trim(), m.traduccion]),
    );

    for (const segmento of segmentos) {
        const original = String(segmento.original || '');

        if (!original.trim()) continue;

        if (NO_ES_TEXTO.test(original)) {
            resueltos.set(segmento.clave, { traduccion: original, origen: 'copia' });
            continue;
        }

        const enMemoria = deLaMemoria.get(original.trim());
        if (enMemoria) {
            resueltos.set(segmento.clave, { traduccion: enMemoria, origen: 'memoria' });
            continue;
        }

        if (yaVistos.has(original)) {
            // Se apunta para copiarlo cuando el primero esté traducido.
            yaVistos.get(original).push(segmento.clave);
            continue;
        }

        yaVistos.set(original, []);
        pendientes.push({ ...segmento, repetidos: yaVistos.get(original) });
    }

    return { resueltos, pendientes };
}

/**
 * Parte una lista en grupos de un tamaño dado.
 *
 * @param {Array} lista
 * @param {number} tamano
 * @returns {Array<Array>}
 */
export function enGrupos(lista, tamano) {
    const grupos = [];
    for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
    return grupos;
}

/**
 * Pretraduce una lista de segmentos.
 *
 * @param {Object} datos
 * @param {Array<{clave: string, original: string}>} datos.segmentos
 * @param {{porLote: number, traducirLote: Function}} datos.motor Quien traduce
 *   de verdad: la IA o el traductor del navegador.
 * @param {Array} [datos.memoria]
 * @param {number} [datos.aLaVez]
 * @param {number} [datos.reintentos]
 * @param {(avance: Object) => void} [datos.alAvanzar]
 * @param {AbortSignal} [datos.senal]
 * @returns {Promise<{traducciones: Map<string, Object>, fallos: Array<Object>, cancelado: boolean}>}
 */
export async function pretraducir({
    segmentos,
    motor,
    memoria = [],
    aLaVez = 4,
    reintentos = 2,
    alAvanzar,
    senal,
}) {
    const { resueltos, pendientes } = repartirTrabajo(segmentos, memoria);
    const traducciones = new Map(resueltos);
    const fallos = [];

    const total = segmentos.filter((s) => String(s.original || '').trim()).length;
    let hechos = resueltos.size;

    const avisar = (estado = 'trabajando') =>
        alAvanzar?.({ hechos, total, fallos: fallos.length, estado });

    avisar('preparando');

    const grupos = enGrupos(pendientes, motor.porLote || 10);
    let siguiente = 0;
    let cancelado = false;

    /** Cada trabajador va cogiendo el siguiente grupo que quede libre. */
    const trabajador = async () => {
        while (siguiente < grupos.length) {
            if (senal?.aborted) {
                cancelado = true;
                return;
            }

            const grupo = grupos[siguiente++];
            const resultados = await conReintentos(
                () => motor.traducirLote(grupo.map((s) => s.original)),
                { reintentos, senal },
            );

            grupo.forEach((segmento, i) => {
                const resultado = resultados?.[i];

                if (resultado?.vale) {
                    const traducido = { traduccion: resultado.traduccion, origen: 'ia' };
                    traducciones.set(segmento.clave, traducido);
                    // Los segmentos idénticos se llevan la misma traducción sin
                    // volver a preguntar.
                    for (const clave of segmento.repetidos || []) {
                        traducciones.set(clave, { ...traducido, origen: 'repetido' });
                    }
                } else {
                    fallos.push({
                        clave: segmento.clave,
                        original: segmento.original,
                        motivo: resultado?.motivo || 'no se ha podido traducir',
                    });
                }

                hechos += 1 + (segmento.repetidos || []).length;
            });

            avisar();
        }
    };

    await Promise.all(Array.from({ length: Math.max(1, aLaVez) }, trabajador));

    avisar(cancelado ? 'cancelado' : 'terminado');

    return { traducciones, fallos, cancelado };
}

/**
 * Reintenta lo que falle, esperando entre intentos.
 *
 * Un fallo de red o un "vas muy deprisa" son pasajeros y se reintentan; una
 * clave mal escrita o quedarse sin saldo no, porque reintentar con eso es
 * hacer esperar a quien mira la barra de progreso para nada.
 *
 * @param {Function} intentar
 * @param {{reintentos: number, senal?: AbortSignal}} opciones
 * @returns {Promise<any>}
 */
async function conReintentos(intentar, { reintentos, senal }) {
    for (let intento = 0; intento <= reintentos; intento++) {
        try {
            return await intentar();
        } catch (error) {
            if (error?.name === 'AbortError') throw error;
            if (error?.reintentable === false || intento === reintentos) {
                return null;
            }
            // Lo que pida el servicio, o una espera que crece con cada intento.
            await esperar(error?.esperarMs || 1000 * (intento + 1), senal);
        }
    }
    return null;
}
