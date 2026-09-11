const arrowDownIcon = `<svg class="shortcut-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 011.414-1.414L10 9.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z" clip-rule="evenodd"></path></svg>`;

const arrowUpIcon = `<svg class="shortcut-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 8a1 1 0 01.707.293l4 4a1 1 0 01-1.414 1.414L10 10.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4A1 1 0 0110 8z" clip-rule="evenodd"></path></svg>`;

const copyIconSVG = `<svg class="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path></svg>`;

/**
 * Bocadillo de comentario, junto a copiar el original.
 *
 * Apagado cuando el segmento no trae notas y encendido cuando sí, para que se
 * vea de un vistazo en qué filas hay algo que leer antes de traducir.
 */
const commentIconSVG = `<svg class="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.84 8.84 0 01-2.083-.24l-3.1 1.55A.5.5 0 014.1 17.8l.55-2.2C3.02 14.35 2 12.29 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clip-rule="evenodd"></path></svg>`;

/**
 * Importar y exportar, en los paneles de memoria y glosario.
 *
 * Una flecha que entra en una bandeja y otra que sale de ella. Se distinguen por
 * la dirección de la flecha, no por el color ni por el texto, que es lo que hace
 * falta en un icono de veintiséis píxeles con el nombre solo en el tooltip.
 */
const importIconSVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>`;

const exportIconSVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 14V4m0 0L8.5 7.5M12 4l3.5 3.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>`;

/** La equis que pliega un panel de la columna de consulta. */
const plegarIconSVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;

/** La lupa del buscador de la columna de consulta. */
const lupaIconSVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/></svg>`;

/**
 * El par de idiomas del proyecto, dentro de los paneles.
 *
 * Un globo terráqueo: dice "idiomas" sin gastar los veinticuatro caracteres de
 * "Languages of this project:", que en una columna de trescientos píxeles son
 * media línea para una etiqueta que se lee una vez y ya no hace falta.
 */
const idiomaIconSVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>`;

/** Añadir un término al glosario. */
const anadirIconSVG = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>`;

export {
    anadirIconSVG,
    copyIconSVG,
    commentIconSVG,
    exportIconSVG,
    idiomaIconSVG,
    importIconSVG,
    lupaIconSVG,
    plegarIconSVG,
};
