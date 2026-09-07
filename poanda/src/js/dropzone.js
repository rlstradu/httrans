/**
 * Recuadro donde se sueltan los archivos a traducir.
 *
 * Ocupa el sitio del editor mientras no hay nada abierto, y hace tres cosas:
 * decir qué formatos entiende Poanda, aceptar un archivo soltado encima, y
 * abrir el diálogo del sistema si se pulsa.
 *
 * El marcado se genera aquí y no en el HTML porque el editor lo borra y lo
 * vuelve a poner cada vez que se vacía el proyecto. Tenerlo en un solo sitio
 * evita que existan dos versiones del recuadro que se vayan separando.
 */
import { formatosPorFamilia } from './core/formatos.js';
import { state } from './state.js';
import { translations } from './translations.js';

const t = (clave) => translations[state.currentLanguage][clave] || '';

/**
 * Los formatos que se aceptan, agrupados por familias y sacados de la tabla de
 * core/formatos.js: añadir un formato allí lo hace aparecer aquí solo.
 *
 * Se agrupan porque veintitantas extensiones seguidas no se leen: quien busca
 * si puede abrir un .sdlxliff no quiere repasar una lista, quiere mirar donde
 * pone "traducción" y verlo. Y cada una dice qué es al pasar el ratón, porque
 * ".arb" o ".wxl" no le dicen nada a quien no trabaje con eso, y esos son la
 * mitad de la lista.
 *
 * @returns {string}
 */
function listaDeFormatos() {
    const grupos = formatosPorFamilia().map(
        (grupo) => `
                <div class="formatos-familia">
                    <span class="formatos-familia-nombre">${t(`familia_${grupo.familia}`)}</span>
                    <span class="formatos-familia-lista">${grupo.formatos
                        .map(
                            (formato) =>
                                `<span class="formato" title="${t(`formato_${formato.id}`)}">${formato.extension}</span>`,
                        )
                        .join('')}</span>
                </div>`,
    );

    // El proyecto propio de Poanda va al final y aparte: no es un archivo que
    // te manden a traducir, es tu trabajo a medias.
    grupos.push(`
                <div class="formatos-familia">
                    <span class="formatos-familia-nombre">${t('familia_proyectos')}</span>
                    <span class="formatos-familia-lista"><span class="formato formato-proyecto" title="${t('formato_poanda')}">.poanda</span></span>
                </div>`);

    return grupos.join('');
}

/**
 * Devuelve el marcado del recuadro, ya traducido al idioma activo.
 * @returns {string}
 */
export function marcadoZonaSoltar() {
    return `
        <div id="initialMessage" class="zona-soltar">
            <div class="zona-soltar-icono">📄</div>
            <p class="zona-soltar-titulo" data-i18n="drop_zone_title">${t('drop_zone_title')}</p>
            <p class="zona-soltar-texto" data-i18n="drop_zone_subtitle">${t('drop_zone_subtitle')}</p>
            <div class="zona-soltar-formatos">${listaDeFormatos()}
            </div>
            <p class="zona-soltar-privacidad" data-i18n="drop_zone_privacy">${t('drop_zone_privacy')}</p>
        </div>
    `;
}

/**
 * Engancha el recuadro: pulsar abre el selector de archivos, y arrastrar encima
 * lo resalta.
 *
 * Se usa delegación en el contenedor, y no un listener en el recuadro, porque
 * el recuadro se destruye y se vuelve a crear cada vez que se vacía el editor:
 * un listener puesto sobre él se perdería en cuanto eso ocurriera.
 *
 * @param {() => void} alPulsar Qué hacer cuando se pulsa el recuadro.
 */
export function initZonaSoltar(alPulsar) {
    const contenedor = document.getElementById('translationsContainer');
    if (!contenedor) return;

    contenedor.addEventListener('click', (evento) => {
        if (evento.target.closest('#initialMessage')) alPulsar();
    });

    // El resaltado al arrastrar se controla desde aquí; quien reciba el archivo
    // es el panel entero (ver main.js), para poder soltarlo en cualquier sitio.
    const zona = () => document.getElementById('initialMessage');
    document.addEventListener('dragover', (evento) => {
        if (evento.target.closest('#initialMessage')) zona()?.classList.add('arrastrando');
    });
    document.addEventListener('dragleave', (evento) => {
        if (evento.target.closest('#initialMessage')) zona()?.classList.remove('arrastrando');
    });
    document.addEventListener('drop', () => zona()?.classList.remove('arrastrando'));
}
