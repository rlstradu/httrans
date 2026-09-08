/**
 * Pretraducir el archivo entero: la parte que se ve.
 *
 * Dos motores a elegir, y la diferencia entre ellos es lo que hay que decidir
 * aquí, así que se explica en el propio cuadro en lugar de en la ayuda:
 *
 * - **Rápido**: el traductor que trae el navegador. Local, gratis, sin clave y
 *   sin esperas. No sigue el glosario ni las instrucciones.
 * - **Con contexto**: el modelo de IA configurado, con el glosario, la memoria
 *   y las instrucciones del proyecto. Más lento, y cuesta dinero si el servicio
 *   es de pago.
 *
 * Lo que traduce la IA se marca como **borrador**: queda sin validar, con una
 * marca en la fila, y se puede deshacer entero. Una pretraducción sin revisar
 * no es una traducción, y un archivo donde no se distingue lo repasado de lo
 * automático es un archivo en el que no se puede confiar.
 */
import { showMessage } from './dialogs.js';
import { renderTranslations } from './editor.js';
import { state } from './state.js';
import { translations } from './translations.js';
import { updateStatsDisplay } from './stats.js';
import {
    guardarMotorDePretraducir,
    hayServicioConectado,
    leerConfiguracion,
    leerMotorDePretraducir,
} from './core/ia/ajustes.js';
import { proveedorPorId } from './core/ia/proveedores.js';
import { pretraducir } from './core/ia/pretraducir.js';
import { traducirLote, POR_LOTE, A_LA_VEZ } from './core/ia/traducir.js';
import { hayTraductorEnElNavegador, prepararTraductorDelNavegador } from './core/ia/navegador.js';

const t = (clave) => translations[state.currentLanguage][clave] || '';
const $ = (id) => document.getElementById(id);

/** Para poder parar a media faena. */
let control = null;

/**
 * Recoge lo que haya escrito en pantalla y todavía no se haya guardado.
 *
 * El editor tarda unas décimas en llevar lo tecleado a los datos, para no hacer
 * cuentas con cada letra. Antes de una operación que va a repintar la lista
 * entera hay que cerrar ese hueco: si no, lo último que alguien haya escrito se
 * pierde al repintar, y encima parece cosa de la IA.
 */
function recogerLoEscritoEnPantalla() {
    document.querySelectorAll('textarea.msgstr-textarea').forEach((campo) => {
        const trozo =
            state.poEntries[Number(campo.dataset.entryIndex)]?.sentenceSegments?.[
                Number(campo.dataset.segmentIndex)
            ];
        if (!trozo || campo.value === trozo.translation) return;

        trozo.translation = campo.value;
        trozo.isTranslated = campo.value.trim() !== '';
    });
}

/**
 * Los segmentos que hay que traducir: los vacíos y sin validar.
 *
 * No se tocan los que ya tienen traducción, ni siquiera para "mejorarlos": lo
 * que ya está hecho lo ha hecho alguien, y pisarlo con una máquina sin avisar
 * sería el peor regalo posible.
 *
 * @returns {Array<{clave: string, original: string, entryIndex: number, segmentIndex: number}>}
 */
function segmentosPendientes() {
    const pendientes = [];

    state.poEntries.forEach((entrada, entryIndex) => {
        if (entrada.isHeader) return;
        (entrada.sentenceSegments || []).forEach((trozo, segmentIndex) => {
            if (String(trozo.translation || '').trim()) return;
            if (!String(trozo.original || '').trim()) return;
            pendientes.push({
                clave: `${entryIndex}:${segmentIndex}`,
                original: trozo.original,
                entryIndex,
                segmentIndex,
            });
        });
    });

    return pendientes;
}

/**
 * El motor rápido: el traductor del navegador, envuelto para que se le pueda
 * pedir un lote como al otro.
 *
 * Traduce de una en una porque así funciona la API del navegador, pero como
 * cada una tarda milisegundos, no hace falta más.
 *
 * @param {{origen: string, destino: string}} idiomas
 * @returns {Promise<Object>}
 */
async function motorDelNavegador(idiomas) {
    const traductor = await prepararTraductorDelNavegador({
        origen: idiomas.origen,
        destino: idiomas.destino,
        alDescargar: (porcentaje) => {
            $('pretraducirEstado').textContent = `⬇️ ${porcentaje}%`;
        },
    });

    return {
        porLote: 20,
        async traducirLote(originales) {
            const traducciones = [];
            for (const original of originales) {
                const traduccion = await traductor.traducir(original);
                traducciones.push({
                    traduccion,
                    // El traductor del navegador no toca las etiquetas porque
                    // no las entiende: las copia con el resto del texto.
                    vale: Boolean(String(traduccion || '').trim()),
                    motivo: '',
                });
            }
            return traducciones;
        },
    };
}

/**
 * El motor con contexto: el modelo de IA configurado.
 *
 * @param {{origen: string, destino: string}} idiomas
 * @returns {Object}
 */
function motorDeIA(idiomas) {
    const proveedor = proveedorPorId(leerConfiguracion().proveedor);
    const config = leerConfiguracion({
        modelo: proveedor?.modeloPorDefecto,
        baseUrl: proveedor?.urlPorDefecto,
    });

    const contexto = {
        instrucciones: config.instrucciones,
        // El glosario entero, que en un proyecto normal son unas decenas de
        // términos: aquí no hay un segmento concreto al que ajustarlo.
        glosario: (state.glossary || [])
            .slice(0, 60)
            .map((g) => ({ termino: g.srcTerm, traduccion: g.tgtTerm })),
    };

    return {
        porLote: POR_LOTE,
        traducirLote: (originales) =>
            traducirLote(
                {
                    originales,
                    config,
                    formato: state.currentFileType,
                    idiomaOrigen: idiomas.origen,
                    idiomaDestino: idiomas.destino,
                    contexto,
                },
                { senal: control?.signal },
            ),
    };
}

/**
 * Abre el cuadro de pretraducir.
 */
/**
 * Enciende o apaga un motor en el cuadro.
 *
 * Apagado no quiere decir escondido: sigue a la vista, en gris, con el motivo
 * escrito debajo. Un motor que desaparece no explica nada; uno apagado con su
 * porqué dice qué hay que hacer para tenerlo.
 *
 * @param {HTMLElement} modal
 * @param {string} valor 'rapido' o 'contexto'
 * @param {boolean} disponible
 * @param {string} [motivo] Qué falta, si falta algo.
 */
function ofrecerMotor(modal, valor, disponible, motivo = '') {
    const radio = modal.querySelector(`input[value="${valor}"]`);
    if (!radio) return;

    const caja = radio.closest('.ia-motor');
    radio.disabled = !disponible;
    caja.classList.toggle('ia-motor-apagado', !disponible);

    let aviso = caja.querySelector('.ia-motor-falta');
    if (!disponible && motivo) {
        if (!aviso) {
            aviso = document.createElement('span');
            aviso.className = 'ia-motor-falta';
            caja.appendChild(aviso);
        }
        aviso.textContent = motivo;
    } else if (aviso) {
        aviso.remove();
    }
}

export function abrirPretraducir() {
    const modal = $('pretraducirModal');
    if (!modal) return;

    recogerLoEscritoEnPantalla();

    if (segmentosPendientes().length === 0) {
        showMessage(t('ai_pretraducir_sin_pendientes'));
        return;
    }

    // Cada motor se ofrece solo si de verdad se puede usar. El rápido necesita
    // que el navegador traiga traductor; el de contexto, un servicio de IA
    // conectado —elegido, con su clave y su modelo—. Ofrecer uno que no está
    // listo es prometer algo que va a fallar a mitad del archivo.
    const conNavegador = hayTraductorEnElNavegador();
    const conIA = hayServicioConectado({ proveedorPorId });

    ofrecerMotor(modal, 'rapido', conNavegador, t('ai_motor_rapido_falta'));
    ofrecerMotor(modal, 'contexto', conIA, t('ai_motor_contexto_falta'));

    // Sin ninguno de los dos no hay cuadro que enseñar: se dice qué falta y se
    // abre donde se arregla, que es el panel de ajustes del asistente.
    if (!conNavegador && !conIA) {
        showMessage(t('ai_pretraducir_sin_motor'));
        $('aiSidebar')?.classList.add('show-sidebar');
        $('aiConfigPanel')?.classList.remove('hidden');
        return;
    }

    // Se recupera el motor de la última vez, siempre que siga estando
    // disponible; si no, el que quede.
    const guardado = leerMotorDePretraducir();
    const elegido =
        (guardado === 'contexto' && conIA) || (guardado === 'rapido' && conNavegador)
            ? guardado
            : conIA
              ? 'contexto'
              : 'rapido';
    modal.querySelector(`input[value="${elegido}"]`).checked = true;

    $('pretraducirAvance').classList.add('hidden');
    $('pretraducirEmpezarBtn').disabled = false;
    modal.classList.remove('hidden');
}

/** Cierra el cuadro y para lo que hubiera en marcha. */
function cerrarPretraducir() {
    control?.abort();
    control = null;
    $('pretraducirModal')?.classList.add('hidden');
}

/**
 * Pone en marcha la pretraducción con el motor elegido.
 */
async function empezar() {
    recogerLoEscritoEnPantalla();

    const elegido =
        document.querySelector('input[name="motorIA"]:checked')?.value || 'rapido';

    // El cuadro ya no deja elegir un motor que no está listo, pero esto se
    // comprueba igual aquí: es la puerta por la que se gasta dinero de la clave
    // de alguien, y una puerta así no se guarda solo con lo que se ve.
    if (elegido === 'contexto' && !hayServicioConectado({ proveedorPorId })) {
        $('pretraducirEstado').textContent = `❌ ${t('ai_motor_contexto_falta')}`;
        $('pretraducirAvance').classList.remove('hidden');
        return;
    }

    guardarMotorDePretraducir(elegido);

    const idiomas = {
        origen: state.sourceLang || 'en',
        destino: state.targetLang || 'es',
    };

    $('pretraducirAvance').classList.remove('hidden');
    $('pretraducirEmpezarBtn').disabled = true;
    $('pretraducirEstado').textContent = '…';

    control = new AbortController();

    let motor;
    try {
        motor = elegido === 'rapido' ? await motorDelNavegador(idiomas) : motorDeIA(idiomas);
    } catch (error) {
        $('pretraducirEstado').textContent = `❌ ${error.message}`;
        $('pretraducirEmpezarBtn').disabled = false;
        return;
    }

    const pendientes = segmentosPendientes();
    const porClave = new Map(pendientes.map((s) => [s.clave, s]));

    const resultado = await pretraducir({
        segmentos: pendientes,
        motor,
        memoria: (state.translationMemory || []).map((m) => ({
            original: m.srcText,
            traduccion: m.tgtText,
        })),
        aLaVez: elegido === 'rapido' ? 1 : A_LA_VEZ,
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

        const trozo = state.poEntries[donde.entryIndex]?.sentenceSegments?.[donde.segmentIndex];
        if (!trozo) continue;

        // Si alguien ha escrito ahí mientras la IA trabajaba, manda la persona.
        // Se mira también el cuadro de la pantalla y no solo lo guardado: lo
        // que se acaba de teclear tarda unas décimas en llegar a los datos, y
        // en ese hueco cabe perfectamente pisar lo que alguien está escribiendo.
        const enPantalla = document.getElementById(
            `msgstr-${donde.entryIndex}-${donde.segmentIndex}`,
        );
        if (String(trozo.translation || '').trim() || String(enPantalla?.value || '').trim()) {
            continue;
        }

        trozo.translation = resultado.traduccion;
        trozo.isTranslated = Boolean(resultado.traduccion.trim());
        // La marca de borrador es lo que permite distinguir después lo repasado
        // de lo automático, y deshacerlo de una vez.
        trozo.borradorIA = resultado.origen;
        puestas += 1;
    }

    if (puestas > 0) {
        renderTranslations(state.poEntries);
        updateStatsDisplay();
    }
}

/**
 * Quita todo lo que puso la IA y que nadie ha tocado desde entonces.
 */
export function deshacerPretraduccion() {
    let quitadas = 0;

    state.poEntries.forEach((entrada) => {
        (entrada.sentenceSegments || []).forEach((trozo) => {
            if (!trozo.borradorIA) return;
            trozo.translation = '';
            trozo.isTranslated = false;
            delete trozo.borradorIA;
            quitadas += 1;
        });
    });

    if (quitadas > 0) {
        renderTranslations(state.poEntries);
        updateStatsDisplay();
    }

    return quitadas;
}

/**
 * Engancha el cuadro.
 */
export function initPretraducir() {
    $('pretraducirBtn')?.addEventListener('click', abrirPretraducir);
    $('pretraducirEmpezarBtn')?.addEventListener('click', empezar);
    $('pretraducirCancelarBtn')?.addEventListener('click', cerrarPretraducir);
}
