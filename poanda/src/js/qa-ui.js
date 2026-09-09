/**
 * El panel de control de calidad.
 *
 * Es un panel y no una ventana, y eso es la decisión de fondo: el repaso de
 * antes de entregar no se hace leyendo una lista de una vez, se hace con la
 * lista al lado mientras se corrigen los segmentos y se ve cómo van
 * desapareciendo los avisos. Una ventana obliga a cerrarla para tocar el
 * archivo, y al volver a abrirla ya no se sabe por dónde ibas.
 *
 * De ahí salen las otras tres decisiones, que son las que hacen que esto se use
 * en lugar de mirarse una vez:
 *
 * - **Se revisa cuando se pide,** no al abrir el panel. Revisar un archivo
 *   grande cuesta, y hacerlo solo se justifica cuando alguien lo pide.
 * - **El aviso también sale junto al segmento,** en un triángulo en su columna
 *   de estado. La lista dice cuántos hay; el triángulo dice cuál es este.
 * - **Se puede dejar en pantalla solo lo que tiene avisos.** Eso convierte la
 *   lista en una tanda de trabajo: filtras, corriges de arriba abajo, vuelves a
 *   revisar y se queda vacía.
 *
 * Lo que se comprueba está en core/qa.js, sin pantalla. Lo que salió de la
 * última revisión, en qa-estado.js, que es de donde beben también el triángulo
 * y el filtro.
 */
import { COMPROBACIONES, revisarArchivo } from './core/qa.js';
import { compararEtiquetas, perfilDeFormato } from './core/etiquetas.js';
import { escaparHtml } from './core/xml.js';
import { terminosEnElTexto } from './core/glosario-coincidencias.js';
import {
    avisosDeLaRevision,
    comprobacionesActivas,
    cuantasEncendidas,
    filtrarPorAvisos,
    guardarComprobaciones,
    guardarRevision,
    olvidarRevision,
    seHaRevisado,
    segmentoDeLaRevision,
    soloSegmentosConAvisos,
} from './qa-estado.js';
import { navigateToTranslation, pintarAvisosDeCalidad, filterPOEntries } from './editor.js';
import { state } from './state.js';
import { updateUtilityButtonStates } from './stats.js';
import { translations } from './translations.js';

const t = (clave) => translations[state.currentLanguage]?.[clave] || '';
const $ = (id) => document.getElementById(id);

let comprobacionesDesplegadas = true;
let temporizadorDeRepaso = null;

/**
 * Los segmentos del archivo en la forma que espera el motor de calidad.
 *
 * El identificador lleva dentro dónde está cada uno, que es lo que permite ir
 * al segmento desde la lista y poner el triángulo en su sitio.
 */
export function segmentosParaRevisar(entradas = []) {
    const segmentos = [];
    entradas.forEach((entrada, entryIndex) => {
        if (entrada.isHeader || !entrada.sentenceSegments) return;
        entrada.sentenceSegments.forEach((segmento, segmentIndex) => {
            segmentos.push({
                id: `${entryIndex}-${segmentIndex}`,
                entryIndex,
                segmentIndex,
                original: segmento.original || '',
                traduccion: segmento.translation || '',
            });
        });
    });
    return segmentos;
}

/** Pasa la revisión al archivo abierto y guarda el resultado. */
export function revisar() {
    const segmentos = segmentosParaRevisar(state.poEntries);
    const perfil = perfilDeFormato(state.currentFileType || 'po');

    const { avisos } = revisarArchivo(segmentos, {
        cuales: comprobacionesActivas(),
        glosario: state.glossary || [],
        compararEtiquetas: (original, traduccion) =>
            compararEtiquetas(original, traduccion, perfil),
        terminosEnElTexto,
    });

    guardarRevision(avisos, segmentos);
    return avisos;
}

/** Cuántos avisos hay de cada comprobación, contando solo las encendidas. */
function contarPorComprobacion(avisos, cuales) {
    const cuenta = {};
    for (const comprobacion of COMPROBACIONES) cuenta[comprobacion] = 0;
    for (const aviso of avisos) {
        if (cuales[aviso.comprobacion] !== false) cuenta[aviso.comprobacion]++;
    }
    return cuenta;
}

/** Un renglón de la lista: a qué segmento lleva y qué se ve de él. */
function filaDeAviso(aviso, segmento) {
    const fila = document.createElement('button');
    fila.type = 'button';
    fila.className = 'qa-aviso';

    const recortar = (texto, largo = 70) =>
        texto.length > largo ? `${texto.slice(0, largo)}…` : texto;

    fila.innerHTML = `
        <span class="qa-aviso-numero">${segmento.entryIndex}</span>
        <span class="qa-aviso-texto">
            <span class="qa-aviso-origen">${escaparHtml(recortar(segmento.original))}</span>
            ${aviso.dato ? `<span class="qa-aviso-dato">${escaparHtml(recortar(aviso.dato, 90))}</span>` : ''}
        </span>`;

    fila.addEventListener('click', () => {
        navigateToTranslation(segmento.entryIndex, segmento.segmentIndex);
    });

    return fila;
}

/** Las casillas de encender y apagar comprobaciones. */
function pintarInterruptores() {
    const contenedor = $('qaInterruptores');
    if (!contenedor) return;

    const cuales = comprobacionesActivas();
    contenedor.innerHTML = '';

    for (const comprobacion of COMPROBACIONES) {
        const etiqueta = document.createElement('label');
        etiqueta.className = 'qa-interruptor';
        etiqueta.dataset.comprobacion = comprobacion;
        etiqueta.title = t(`qa_${comprobacion}_ayuda`);
        etiqueta.innerHTML = `
            <input type="checkbox" ${cuales[comprobacion] ? 'checked' : ''}>
            <span>${escaparHtml(t(`qa_${comprobacion}`))}</span>`;

        etiqueta.querySelector('input').addEventListener('change', (evento) => {
            guardarComprobaciones({
                ...comprobacionesActivas(),
                [comprobacion]: evento.target.checked,
            });
            // No se vuelve a revisar: los avisos ya están, solo cambia cuáles se
            // enseñan. Apagar una comprobación en un archivo grande no puede
            // costar una revisión entera.
            pintarResultado();
        });

        contenedor.appendChild(etiqueta);
    }

    const titulo = $('qaComprobacionesTitulo');
    if (titulo) {
        titulo.textContent = (t('qa_comprobaciones') || '')
            .replace('{encendidas}', String(cuantasEncendidas()))
            .replace('{total}', String(COMPROBACIONES.length));
    }
}

/** Lleva la lista hasta un grupo y lo señala un momento. */
function irAlGrupo(comprobacion) {
    const grupo = document.querySelector(`#qaLista [data-comprobacion="${comprobacion}"]`);
    if (!grupo) return;
    grupo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    grupo.classList.add('qa-grupo-destello');
    setTimeout(() => grupo.classList.remove('qa-grupo-destello'), 1400);
}

function pintarResultado() {
    const lista = $('qaLista');
    const resumen = $('qaResumen');
    if (!lista || !resumen) return;

    pintarInterruptores();

    const soloConAvisos = $('qaSoloConAvisos');

    // Antes de la primera revisión no se puede decir nada. Enseñar un cero
    // sería mentir: "sin avisos" y "sin revisar" no son lo mismo.
    if (!seHaRevisado()) {
        resumen.className = 'qa-resumen qa-resumen-espera';
        resumen.innerHTML = `
            <img class="qa-panda" src="/images/panda-glasses.png" alt="" aria-hidden="true">
            <span>${escaparHtml(t('qa_espera'))}</span>`;
        lista.innerHTML = '';
        soloConAvisos?.classList.add('hidden');
        pintarAvisosDeCalidad();
        return;
    }

    const cuales = comprobacionesActivas();
    const visibles = avisosDeLaRevision().filter((a) => cuales[a.comprobacion] !== false);
    const cuenta = contarPorComprobacion(avisosDeLaRevision(), cuales);

    lista.innerHTML = '';
    soloConAvisos?.classList.toggle('hidden', visibles.length === 0);

    if (visibles.length === 0) {
        resumen.className = 'qa-resumen qa-resumen-limpio';
        resumen.textContent = t('qa_sin_avisos');
        pintarAvisosDeCalidad();
        return;
    }

    // Las pastillas del resumen: cuántos hay de cada cosa, y pulsando una se va
    // a su grupo. En un archivo con ochenta avisos, bajar buscando el que
    // interesa es lo que hace que no se mire.
    resumen.className = 'qa-resumen';
    const pastillas = COMPROBACIONES.filter((c) => cuenta[c] > 0)
        .map(
            (c) =>
                `<button type="button" class="qa-pastilla" data-comprobacion="${c}">${escaparHtml(t(`qa_${c}`))}: ${cuenta[c]}</button>`,
        )
        .join('');
    resumen.innerHTML = `
        <p class="qa-resumen-total">${escaparHtml((t('qa_resumen') || '').replace('{avisos}', String(visibles.length)))}</p>
        <div class="qa-pastillas">${pastillas}</div>`;

    for (const comprobacion of COMPROBACIONES) {
        const suyos = visibles.filter((a) => a.comprobacion === comprobacion);
        if (suyos.length === 0) continue;

        const grupo = document.createElement('section');
        grupo.className = 'qa-grupo';
        grupo.dataset.comprobacion = comprobacion;
        grupo.innerHTML = `
            <h4 class="qa-grupo-titulo">
                ${escaparHtml(t(`qa_${comprobacion}`))}
                <span class="qa-grupo-cuantos">${suyos.length}</span>
            </h4>
            <p class="qa-grupo-explicacion">${escaparHtml(t(`qa_${comprobacion}_ayuda`))}</p>`;

        for (const aviso of suyos) {
            const segmento = segmentoDeLaRevision(aviso.id);
            if (segmento) grupo.appendChild(filaDeAviso(aviso, segmento));
        }
        lista.appendChild(grupo);
    }

    pintarAvisosDeCalidad();
}

/** Revisa y repinta. */
function revisarYPintar() {
    revisar();
    // A la primera se pliegan las comprobaciones: se miran una vez para
    // ajustarlas y a partir de ahí lo que interesa es la lista.
    if (comprobacionesDesplegadas) plegarComprobaciones(false);
    pintarResultado();
    if (soloSegmentosConAvisos()) filterPOEntries();
}

/**
 * Vuelve a revisar poco después de escribir, si el panel está abierto.
 *
 * Es lo que hace que los avisos desaparezcan según se corrigen, en lugar de
 * quedarse ahí hasta que uno se acuerda de pulsar el botón.
 */
export function repasarSiEstaAbierto() {
    if (!estaAbierto() || !seHaRevisado()) return;
    clearTimeout(temporizadorDeRepaso);
    temporizadorDeRepaso = setTimeout(() => {
        revisar();
        pintarResultado();
        if (soloSegmentosConAvisos()) filterPOEntries();
    }, 700);
}

function plegarComprobaciones(desplegadas) {
    comprobacionesDesplegadas = desplegadas;
    $('qaInterruptores')?.classList.toggle('hidden', !desplegadas);
    $('qaComprobacionesToggle')?.setAttribute('aria-expanded', desplegadas ? 'true' : 'false');
    $('qaComprobacionesToggle')?.classList.toggle('qa-plegar-abierto', desplegadas);
}

export function estaAbierto() {
    return Boolean($('qaPanel')?.classList.contains('show-sidebar'));
}

export function abrirControlDeCalidad() {
    const panel = $('qaPanel');
    if (!panel) return;
    panel.classList.add('show-sidebar');
    pintarResultado();
    updateUtilityButtonStates();
}

/** El botón de la barra: si está abierto lo cierra, y si no lo abre. */
export function alternarControlDeCalidad() {
    if (estaAbierto()) cerrarControlDeCalidad();
    else abrirControlDeCalidad();
}

export function cerrarControlDeCalidad() {
    $('qaPanel')?.classList.remove('show-sidebar');
    updateUtilityButtonStates();
    // El filtro se va con el panel: quedarse con medio archivo escondido y sin
    // el panel que lo explica es la mejor manera de creer que faltan segmentos.
    const filtro = $('qaSoloConAvisosCheck');
    if (filtro?.checked) {
        filtro.checked = false;
        filtrarPorAvisos(false);
        filterPOEntries();
    }
}

/**
 * Vuelve a pintar el panel. Lo llama el cambio de idioma.
 *
 * Todo lo de dentro se escribe desde aquí —los nombres de las comprobaciones,
 * sus explicaciones, el resumen y los tooltips de los triángulos—, así que el
 * recorrido de data-i18n no lo toca y se quedaría en el idioma anterior.
 */
export function repintarControlDeCalidad() {
    pintarResultado();
}

/** Olvida la revisión. Se llama al abrir otro archivo. */
export function olvidarControlDeCalidad() {
    olvidarRevision();
    const filtro = $('qaSoloConAvisosCheck');
    if (filtro) filtro.checked = false;
    if (estaAbierto()) pintarResultado();
}

/** Engancha la entrada del menú y los controles del panel. */
export function initQa() {
    $('qaBtn')?.addEventListener('click', alternarControlDeCalidad);
    $('qaCloseBtn')?.addEventListener('click', cerrarControlDeCalidad);
    $('qaRevisarBtn')?.addEventListener('click', revisarYPintar);
    $('qaComprobacionesToggle')?.addEventListener('click', () =>
        plegarComprobaciones(!comprobacionesDesplegadas),
    );
    $('qaSoloConAvisosCheck')?.addEventListener('change', (evento) => {
        filtrarPorAvisos(evento.target.checked);
        filterPOEntries();
    });

    $('qaResumen')?.addEventListener('click', (evento) => {
        const pastilla = evento.target.closest?.('.qa-pastilla');
        if (pastilla) irAlGrupo(pastilla.dataset.comprobacion);
    });

    plegarComprobaciones(true);
    pintarResultado();
}
