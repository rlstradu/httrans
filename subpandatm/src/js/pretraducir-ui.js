/**
 * Pretraducir el archivo entero: la parte que se ve.
 *
 * Un apartado del propio panel del PandaBot, no un cuadro aparte: se llega a él
 * desde la pregunta de bienvenida, y lo que se decide aquí es una sola cosa
 * —empezar o no—, que no da para una ventana encima de todo.
 *
 * Traduce el modelo de IA configurado, con el glosario, la memoria, las
 * instrucciones del encargo y —si está marcado— lo que cabe en cada subtítulo.
 * Se quitó la opción de usar el traductor del navegador: hacía un primer pase
 * sin glosario, sin instrucciones y sin mirar los límites, y en subtitulado eso
 * es empezar la casa por el tejado.
 *
 * Lo que traduce la IA se marca como **borrador**: queda sin validar y se puede
 * deshacer entero. Una pretraducción sin revisar no es una traducción, y un
 * archivo donde no se distingue lo repasado de lo automático es un archivo en
 * el que no se puede confiar.
 */
import { showMessage } from './dialogs.js';
import { renderTranslations } from './editor-puente.js';
import { state } from './state.js';
import { translations } from './translations.js';
import {
    hayServicioConectado,
    leerConfiguracion,
    seRespetanLosLimites,
} from './core/ia/ajustes.js';
import { proveedorPorId } from './core/ia/proveedores.js';
import { pretraducir } from './core/ia/pretraducir.js';
import { loQueCabe, traducirLote, POR_LOTE, A_LA_VEZ } from './core/ia/traducir.js';
import { mensajeDeError } from './ia-textos.js';

const t = (clave) => translations[state.currentLanguage][clave] || '';
const $ = (id) => document.getElementById(id);

/** Para poder parar a media faena. */
let control = null;

/** Los límites de calidad del proyecto, que los pone app.js. */
let limitesDelProyecto = { cpsLimit: 17, charsPerLineLimit: 42 };

/** @param {{cpsLimit: number, charsPerLineLimit: number}} limites */
export function ponerLimitesDePretraducir(limites) {
    if (limites) limitesDelProyecto = limites;
}

/**
 * Los subtítulos que hay que traducir: los que están vacíos.
 *
 * No se tocan los que ya tienen traducción, ni siquiera para "mejorarlos": lo
 * que ya está hecho lo ha hecho alguien, y pisarlo con una máquina sin avisar
 * sería el peor regalo posible.
 *
 * @returns {Array<{clave: string, original: string, entryIndex: number, durationMs: number}>}
 */
function subtitulosPendientes() {
    const pendientes = [];

    state.srtEntries.forEach((entrada, entryIndex) => {
        if (String(entrada.translation || '').trim()) return;
        if (!String(entrada.original || '').trim()) return;
        pendientes.push({
            clave: String(entryIndex),
            original: entrada.original,
            entryIndex,
            durationMs: entrada.durationMs,
        });
    });

    return pendientes;
}

/**
 * El motor con contexto: el modelo de IA configurado.
 *
 * @param {{origen: string, destino: string}} idiomas
 * @param {Map<string, {durationMs: number}>} porClave
 * @returns {Object}
 */
function motorDeIA(idiomas, porClave) {
    const proveedor = proveedorPorId(leerConfiguracion().proveedor);
    const config = leerConfiguracion({
        modelo: proveedor?.modeloPorDefecto,
        baseUrl: proveedor?.urlPorDefecto,
    });

    const contexto = {
        instrucciones: config.instrucciones,
        // El glosario entero, que en un encargo normal son unas decenas de
        // términos: aquí no hay un subtítulo concreto al que ajustarlo.
        glosario: (state.glossary || [])
            .slice(0, 60)
            .map((g) => ({ termino: g.srcTerm, traduccion: g.tgtTerm })),
    };

    const conLimites = seRespetanLosLimites();

    return {
        porLote: POR_LOTE,
        // El motor recibe los originales, pero los límites dependen de la
        // duración de cada subtítulo, que va en otro sitio: se buscan por el
        // texto, que es lo único que llega hasta aquí. Dos subtítulos con el
        // mismo texto y distinta duración se llevan el límite del primero, y es
        // aceptable: la alternativa es cambiar la forma del motor para un caso
        // que casi nunca pasa.
        traducirLote: (originales) =>
            traducirLote(
                {
                    originales,
                    config,
                    idiomaOrigen: idiomas.origen,
                    idiomaDestino: idiomas.destino,
                    contexto,
                    limites: conLimites
                        ? originales.map((texto) =>
                              loQueCabe(duracionDe(texto, porClave), limitesDelProyecto),
                          )
                        : undefined,
                },
                { senal: control?.signal },
            ),
    };
}

/**
 * Cuánto dura el subtítulo cuyo original es este texto.
 *
 * @param {string} original
 * @param {Map<string, {original: string, durationMs: number}>} porClave
 * @returns {number}
 */
function duracionDe(original, porClave) {
    for (const dato of porClave.values()) {
        if (dato.original === original) return dato.durationMs;
    }
    return 0;
}

/**
 * Abre el apartado de pretraducir.
 *
 * Se comprueba antes que haya algo que traducir y un servicio conectado:
 * enseñar un botón de empezar que va a fallar es peor que decir ahora mismo
 * qué falta.
 */
export function abrirPretraducir() {
    const apartado = $('pretraducirSeccion');
    if (!apartado) return;

    if (subtitulosPendientes().length === 0) {
        showMessage(t('ai_pretraducir_sin_pendientes'));
        return;
    }

    if (!hayServicioConectado({ proveedorPorId })) {
        showMessage(t('ai_pretraducir_sin_motor'));
        $('aiConfigModal')?.classList.remove('hidden');
        return;
    }

    $('pretraducirAvance').classList.add('hidden');
    $('pretraducirEmpezarBtn').disabled = false;
    apartado.classList.remove('hidden');
    apartado.scrollIntoView({ block: 'nearest' });
}

/** Cierra el cuadro y para lo que hubiera en marcha. */
function cerrarPretraducir() {
    control?.abort();
    control = null;
    $('pretraducirSeccion')?.classList.add('hidden');
}

/** Pone en marcha la pretraducción. */
async function empezar() {
    // Se comprueba otra vez aquí, y no solo al abrir: es la puerta por la que se
    // gasta dinero de la clave de alguien, y una puerta así no se guarda solo
    // con lo que se ve.
    if (!hayServicioConectado({ proveedorPorId })) {
        $('pretraducirEstado').textContent = `❌ ${t('ai_pretraducir_sin_motor')}`;
        $('pretraducirAvance').classList.remove('hidden');
        return;
    }

    const idiomas = { origen: state.sourceLang || 'en', destino: state.targetLang || 'es' };

    $('pretraducirAvance').classList.remove('hidden');
    $('pretraducirEmpezarBtn').disabled = true;
    $('pretraducirEstado').textContent = '…';

    control = new AbortController();

    const pendientes = subtitulosPendientes();
    const porClave = new Map(pendientes.map((s) => [s.clave, s]));

    let motor;
    try {
        motor = motorDeIA(idiomas, porClave);
    } catch (error) {
        $('pretraducirEstado').textContent = `❌ ${mensajeDeError(error)}`;
        $('pretraducirEmpezarBtn').disabled = false;
        return;
    }

    const resultado = await pretraducir({
        segmentos: pendientes,
        motor,
        memoria: (state.translationMemory || []).map((m) => ({
            original: m.srcText,
            traduccion: m.tgtText,
        })),
        aLaVez: A_LA_VEZ,
        senal: control.signal,
        alAvanzar: ({ hechos, total }) => {
            $('pretraducirBarra').style.width = `${total ? (hechos / total) * 100 : 0}%`;
            $('pretraducirEstado').textContent = t('ai_pretraducir_avance')
                .replace('{hechos}', hechos)
                .replace('{total}', total);
        },
    });

    volcarEnElEditor(resultado.traducciones, porClave);

    const mensaje = resultado.cancelado
        ? t('ai_pretraducir_cancelado')
        : t('ai_pretraducir_terminado')
              .replace('{hechos}', resultado.traducciones.size)
              .replace('{fallos}', resultado.fallos.length);

    cerrarPretraducir();
    showMessage(mensaje);
}

/**
 * Mete las traducciones en el editor, marcadas como borrador.
 *
 * @param {Map<string, {traduccion: string, origen: string}>} traducciones
 * @param {Map<string, Object>} porClave
 */
function volcarEnElEditor(traducciones, porClave) {
    let puestas = 0;

    for (const [clave, resultado] of traducciones) {
        const donde = porClave.get(clave);
        if (!donde) continue;

        const entrada = state.srtEntries[donde.entryIndex];
        if (!entrada) continue;

        // Si alguien ha escrito ahí mientras la IA trabajaba, manda la persona.
        if (String(entrada.translation || '').trim()) continue;

        // El salto de línea del subtítulo se guarda como <br>, que es como lo
        // escribe el editor: si se dejara el \n en crudo, la vista previa y la
        // exportación lo verían de dos maneras distintas.
        entrada.translation = String(resultado.traduccion || '')
            .trim()
            .replace(/\n/g, '<br>');
        // La marca de borrador es lo que permite distinguir después lo repasado
        // de lo automático, y deshacerlo de una vez.
        entrada.borradorIA = resultado.origen;
        puestas += 1;
    }

    if (puestas > 0) renderTranslations();
}

/** Quita todo lo que puso la IA y que nadie ha tocado desde entonces. */
export function deshacerPretraduccion() {
    let quitadas = 0;

    for (const entrada of state.srtEntries) {
        if (!entrada.borradorIA) continue;
        entrada.translation = '';
        delete entrada.borradorIA;
        quitadas += 1;
    }

    if (quitadas > 0) renderTranslations();
    return quitadas;
}

/** Engancha el apartado. */
export function initPretraducir() {
    // Se abre desde la bienvenida del PandaBot, que vive en ia.js. Se pide por
    // un evento en lugar de importarlo allí porque ia.js ya se importa aquí: se
    // importarían el uno al otro.
    document.addEventListener('subpanda:abrir-pretraducir', abrirPretraducir);
    $('pretraducirEmpezarBtn')?.addEventListener('click', empezar);
    $('pretraducirCerrarBtn')?.addEventListener('click', cerrarPretraducir);
}
