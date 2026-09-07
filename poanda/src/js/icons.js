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

export { copyIconSVG, commentIconSVG };
