/**
 * Los elementos de la página que usan los módulos de la columna de consulta.
 *
 * Se buscan una sola vez, al cargar, y se comparten: así los módulos no repiten
 * getElementById por todas partes y, sobre todo, si alguno cambia de nombre en
 * el HTML se arregla aquí y no en diez sitios.
 *
 * Solo están los que hacen falta fuera de app.js. El resto de la herramienta
 * sigue buscándolos por su cuenta mientras no se termine de trocear.
 */
const $ = (id) => document.getElementById(id);

// El buscador único de los dos paneles.
export const buscarPaneles = $('buscarPaneles');

// Glosario
export const glosarioLista = $('glosarioLista');
export const tbxFileInput = $('tbxFileInput');

// Memoria de traducción
export const tmInternalMessage = $('tmInternalMessage');
export const tmNoMatchFoundMessage = $('tmNoMatchFoundMessage');
export const tmResultadosLista = $('tmResultadosLista');

// Avisos y esperas
export const messageBox = $('messageBox');
export const messageText = $('messageText');
export const loadingOverlay = $('loadingOverlay');
export const loadingMessage = $('loadingMessage');
