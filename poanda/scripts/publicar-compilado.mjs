// Coloca el resultado de la compilación en la carpeta que publica httrans.org.
//
// Vite compila a poanda/.build/ (carpeta temporal). Este script borra el
// resultado de la compilación anterior que hubiera en poanda/ y mueve el nuevo
// en su lugar. Se hace así, y no compilando directamente sobre poanda/, porque
// poanda/ contiene también el código fuente (src/), los tests y el CHANGELOG:
// dejar que la herramienta de compilación mande sobre esa carpeta sería jugar
// con fuego.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporal = path.join(carpeta, '.build');

if (!fs.existsSync(temporal)) {
    console.error('No hay nada compilado en .build/. ¿Ha fallado "vite build"?');
    process.exit(1);
}

// Fuera el resultado anterior.
for (const nombre of ['index.html', 'assets']) {
    const ruta = path.join(carpeta, nombre);
    if (fs.existsSync(ruta)) fs.rmSync(ruta, { recursive: true, force: true });
}

// Dentro el nuevo.
for (const nombre of fs.readdirSync(temporal)) {
    fs.renameSync(path.join(temporal, nombre), path.join(carpeta, nombre));
}
fs.rmSync(temporal, { recursive: true, force: true });

console.log('Compilado publicado en poanda/: index.html + assets/');
console.log('Recuerda: se sube a GitHub el resultado, no solo el código de src/.');
