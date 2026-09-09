/**
 * Modal de changelog de Poanda.
 *
 * El botón de versión de la cabecera abre una ventana con el historial de
 * cambios, que se descarga en vivo del CHANGELOG.md de esta misma carpeta.
 * Así el historial vive junto al código de la herramienta, igual que en
 * PandaTerm y Pandoria.
 *
 * El archivo es texto plano pensado para leerse en un editor, y puesto tal cual
 * en una ventana pequeña es un muro de texto: cada línea se parte dos veces y no
 * se distingue el título de una versión del cuerpo, ni una novedad de la
 * siguiente. Antes de enseñarlo se le da forma (ver core/changelog-formato.js):
 * títulos de versión, secciones y una lista de puntos.
 */
import { formatearChangelog } from './core/changelog-formato.js';
import { state } from './state.js';
import { translations } from './translations.js';

/** El texto que toque en el idioma que esté puesto. */
const t = (clave) => translations[state.currentLanguage]?.[clave] || translations.en[clave] || '';

/** Engancha el botón de versión y el cierre del modal. */
export function initChangelog() {
    // --- LÓGICA CHANGELOG ---
    const versionToggle = document.getElementById('versionToggle');
    const changelogModal = document.getElementById('changelogModal');
    const changelogCloseBtn = document.getElementById('changelogCloseBtn');
    const changelogContent = document.getElementById('changelogContent');

    if (versionToggle && changelogModal) {
        versionToggle.addEventListener('click', async () => {
            changelogContent.textContent = t('changelog_cargando');
            changelogModal.classList.remove('hidden');
            try {
                // Se añade el timestamp a la URL para evitar que el navegador guarde el txt en caché
                const response = await fetch(`CHANGELOG.md?t=${new Date().getTime()}`);
                if (response.ok) {
                    const text = await response.text();
                    // formatearChangelog escapa lo que venga del archivo, así
                    // que es seguro meterlo como HTML.
                    changelogContent.innerHTML = formatearChangelog(text);
                } else {
                    changelogContent.textContent = t('changelog_error_http').replace(
                        '{codigo}',
                        response.status,
                    );
                }
            } catch (error) {
                changelogContent.textContent = t('changelog_error_red');
                console.error('Error al obtener el changelog:', error);
            }
        });

        changelogCloseBtn.addEventListener('click', () => {
            changelogModal.classList.add('hidden');
        });
    }
}
