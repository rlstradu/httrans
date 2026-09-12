/**
 * La ventana del changelog.
 *
 * El botón de versión de la cabecera abre el historial de cambios, que se lee
 * en vivo de changelog/subpandatm.md, en la raíz del sitio. Es el mismo archivo
 * que lee la portada: no hay una segunda copia que se pueda quedar atrasada
 * (AGENTS.md §8.1).
 *
 * El archivo está en Markdown, pensado para leerse también al abrirlo en
 * GitHub. Puesto tal cual en una ventana pequeña serían las almohadillas y los
 * guiones a la vista, así que antes de enseñarlo se interpreta (ver
 * changelog-formato.js): títulos de versión, apartados y lista de puntos.
 */
import { formatearChangelog } from '@core/changelog-formato.js';
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
                // Se añade el timestamp a la URL para evitar que el navegador
                // guarde el archivo en caché
                const response = await fetch(`../changelog/subpandatm.md?t=${Date.now()}`);
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
