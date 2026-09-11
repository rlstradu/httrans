/**
 * El asistente de IA, de punta a punta.
 *
 * No se llama a ningún servicio de verdad: se intercepta la dirección de OpenAI
 * y se contesta lo que hace falta para cada caso. Así se comprueba el camino
 * entero —elegir servicio, conectar, traducir, insertar— sin gastar una sola
 * llamada ni necesitar una clave.
 *
 * Lo que de verdad se vigila aquí es que el subtítulo llegue entero al otro
 * lado: con su cursiva, sin salirse de lo que cabe, y sin que una respuesta
 * rara acabe metida en el archivo.
 */
import { test, expect, cargarSrt } from './apoyo.js';

const SRT = `1
00:00:01,000 --> 00:00:03,000
Save the file to your computer

2
00:00:04,000 --> 00:00:06,500
<i>Come on</i>, he said

3
00:00:07,000 --> 00:00:09,000
Goodbye
`;

/** Guarda lo que se le manda al modelo, para poder mirarlo. */
const encargos = new WeakMap();

/**
 * Pone en pie un servicio de IA de mentira.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string|Function} contesta Lo que devuelve al traducir.
 */
async function servicioDeMentira(page, contesta = '⟦0⟧Vámonos⟦1⟧, dijo') {
    encargos.set(page, []);

    await page.route('https://api.openai.com/**', async (ruta) => {
        if (ruta.request().url().includes('/models')) {
            return ruta.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [
                        { id: 'gpt-4o-mini', created: 2 },
                        { id: 'gpt-4o', created: 1 },
                    ],
                }),
            });
        }

        const cuerpo = JSON.parse(ruta.request().postData() || '{}');
        encargos.get(page).push(cuerpo.messages);

        const texto = typeof contesta === 'function' ? contesta(cuerpo) : contesta;
        return ruta.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ choices: [{ message: { content: texto } }] }),
        });
    });
}

/** Abre el asistente y lo conecta al servicio de mentira. */
async function conectar(page) {
    await page.locator('#aiBtn').click();
    // Los ajustes ya no se abren solos: la bienvenida no es un formulario.
    await page.locator('#aiConfigToggleBtn').click();
    await page.locator('#aiProveedor').selectOption('openai');
    await page.locator('#aiClave').fill('sk-de-mentira');
    await page.locator('#aiConectarBtn').click();
    // Al conectar se cierra el cuadro y lo dice en la conversación.
    await expect(page.locator('#aiConfigModal')).toBeHidden();
    await expect(page.locator('.ai-message-bot').last()).toContainText('gpt-4o-mini');
}

test.describe('el asistente de IA', () => {
    test('los ajustes viven en su propio cuadro', async ({ page }) => {
        // Se desplegaban dentro del panel, encima de la conversación: seis
        // campos en media columna, en el mismo sitio donde se habla con el
        // modelo. La rueda los abre y la equis los cierra.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();

        await expect(page.locator('#aiConfigModal')).toBeHidden();
        await page.locator('#aiConfigToggleBtn').click();
        await expect(page.locator('#aiConfigModal')).toBeVisible();

        // Y lo propio de subtitular va dentro, con lo demás.
        await page.locator('#aiAvanzadoBtn').click();
        await expect(page.locator('#aiConfigModal #aiRespetarLimites')).toBeVisible();
        await expect(page.locator('#aiConfigModal')).toContainText('CPS');

        await page.locator('#aiConfigCerrarBtn').click();
        await expect(page.locator('#aiConfigModal')).toBeHidden();
    });

    test('sin configurar, la bienvenida lleva a los ajustes', async ({ page }) => {
        // Un saludo que invita a escribir en un cuadro que va a contestar con un
        // error no ayuda a nadie. Pero abrir el formulario de ajustes encima de
        // todo antes de saludar tampoco: primero se dice qué falta, con un
        // enlace que lleva justo ahí.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();

        await expect(page.locator('#aiSidebar')).toBeVisible();
        await expect(page.locator('#aiChatContainer')).toContainText('PandaBot');
        await expect(page.locator('#aiConfigModal')).toBeHidden();

        await page.locator('.ai-enlace').click();
        await expect(page.locator('#aiConfigModal')).toBeVisible();
        await expect(page.locator('#aiSinConectar')).toBeVisible();
    });

    test('el saludo lo da el panda, en un bocadillo', async ({ page }) => {
        // Un aviso con cara se lee; una franja de texto gris, no. Es el mismo
        // bocadillo que da la bienvenida en el editor y que pide el vídeo.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();

        const panda = page.locator('#aiChatContainer .panda-aviso-panda');
        await expect(panda).toBeVisible();
        await expect(panda).toHaveAttribute('src', /panda-prof\.png/);
        await expect(page.locator('#aiChatContainer .panda-aviso-bocadillo')).toContainText(
            'PandaBot',
        );
    });

    test('el panda sale en todo lo que dice, no solo en el saludo', async ({ page }) => {
        // Una conversación en la que el primer mensaje tiene cara y los demás
        // son recuadros sueltos parece que la empieza uno y la sigue otro.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        await page.locator('#translation-1').click();
        await page.locator('#aiQuickTranslate').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('Vámonos');

        const bot = page.locator('.ai-message-bot');
        const cuantos = await bot.count();
        expect(cuantos).toBeGreaterThan(1);
        for (let i = 0; i < cuantos; i++) {
            await expect(bot.nth(i).locator('.panda-aviso-panda')).toHaveCount(1);
        }
        // Y lo que escribe uno no lleva panda: es quien habla, no quien contesta.
        await expect(page.locator('.ai-message-user .panda-aviso-panda')).toHaveCount(0);
    });

    test('es una pestaña de la columna, delante del planificador', async ({ page }) => {
        await cargarSrt(page, SRT, 'cursiva.srt');

        const pestanas = page.locator('.panel-pestana');
        await expect(pestanas.nth(1)).toHaveAttribute('data-pestana', 'ia');
        await expect(pestanas.nth(2)).toHaveAttribute('data-pestana', 'qa');
        await expect(pestanas.nth(3)).toHaveAttribute('data-pestana', 'planificador');

        // Y una sola a la vista cada vez.
        await pestanas.nth(1).click();
        await expect(page.locator('#aiSidebar')).toBeVisible();
        await expect(page.locator('#pestanaPaneles')).toBeHidden();
        await expect(page.locator('#qaContainer')).toBeHidden();
        await expect(page.locator('#plannerContainer')).toBeHidden();
    });

    test('se conecta y se queda con el modelo más reciente', async ({ page }) => {
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        // Volviendo a los ajustes se ve a qué se está conectado.
        await page.locator('#aiConfigToggleBtn').click();
        await expect(page.locator('#aiConectado')).toBeVisible();
        await expect(page.locator('#aiModelo')).toHaveValue('gpt-4o-mini');
    });

    test('con una clave rechazada no se guarda nada', async ({ page }) => {
        // Guardar solo cuando el servicio ha contestado es lo que evita el caso
        // peor: una clave mal pegada que no da la cara hasta media pretraducción.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.route('https://api.openai.com/**', (ruta) =>
            ruta.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: { message: 'Incorrect API key' } }),
            }),
        );

        await page.locator('#aiBtn').click();
        await page.locator('#aiConfigToggleBtn').click();
        await page.locator('#aiProveedor').selectOption('openai');
        await page.locator('#aiClave').fill('sk-mal');
        await page.locator('#aiConectarBtn').click();

        await expect(page.locator('#aiEstadoConexion')).toContainText('❌');
        await expect(page.locator('#aiSinConectar')).toBeVisible();
        await expect(page.locator('#aiConectado')).toBeHidden();
    });

    test('los tres servicios de la nube piden clave, y el local no', async ({ page }) => {
        // El "compatible con OpenAI" se quitó: pedía una dirección y un puerto
        // a mano, y los modelos pequeños de detrás no respetaban las etiquetas.
        // Lo que hay ahora en su sitio son dos servicios locales de verdad, sin
        // dirección que escribir.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();
        await page.locator('#aiConfigToggleBtn').click();

        await expect(page.locator('#aiProveedor option')).toHaveCount(4);
        await expect(page.locator('#aiProveedor option[value="compatible"]')).toHaveCount(0);

        for (const id of ['gemini', 'openai', 'anthropic']) {
            await page.locator('#aiProveedor').selectOption(id);
            await expect(page.locator('#aiClaveBloque')).toBeVisible();
        }
        await page.locator('#aiProveedor').selectOption('webllm');
        await expect(page.locator('#aiClaveBloque')).toBeHidden();
    });

    test('lo avanzado va plegado, y el panda explica lo de los límites', async ({ page }) => {
        // Quien solo quiere empezar no tiene por qué decidir nada sobre esto.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();
        await page.locator('#aiConfigToggleBtn').click();

        await expect(page.locator('#aiAvanzado')).toBeHidden();
        await page.locator('#aiAvanzadoBtn').click();
        await expect(page.locator('#aiAvanzado')).toBeVisible();
        await expect(page.locator('#aiRespetarLimites')).toBeVisible();
        await expect(page.locator('#aiAvanzado .ia-dice-panda')).toBeVisible();
        await expect(page.locator('#aiAvanzado .panda-aviso-bocadillo')).toContainText('condense');
    });

    test('sin IA conectada, las tres respuestas avisan antes de nada', async ({ page }) => {
        // El camino corto era elegir una opción, escribir una pregunta y
        // recibir un error del servicio. Se dice antes, y con los ajustes
        // abiertos, que es lo único que hay que hacer.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();

        await page.locator('.ai-opcion').first().click();

        await expect(page.locator('.ai-message-bot').last()).toContainText('AI connected');
        await expect(page.locator('#aiConfigModal')).toBeVisible();
    });

    test('el panda dice lo que pasa con tu clave', async ({ page }) => {
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();
        await page.locator('#aiConfigToggleBtn').click();

        const bocadillo = page.locator('#aiPandaConectar');
        await expect(bocadillo).toBeVisible();
        await expect(bocadillo).toContainText('API key');
        await expect(bocadillo).toContainText('never written into a project');
    });

    test('traduce el subtítulo y la cursiva llega entera', async ({ page }) => {
        // Este es el fallo que importa: sin el cierre, el subtítulo sale con un
        // "</i>" escrito con todas sus letras encima de la cara de alguien.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        await page.locator('#translation-1').click();
        await page.locator('#aiQuickTranslate').click();

        const respuesta = page.locator('.ai-message-bot').last();
        await expect(respuesta).toContainText('Vámonos');

        await page.locator('.ai-insert-btn').last().click();
        await expect(page.locator('#translation-1')).toHaveText('Vámonos, dijo');
        expect(await page.locator('#translation-1').innerHTML()).toContain('<i>');
    });

    test('se le dice lo que cabe en el subtítulo', async ({ page }) => {
        // Lo propio de subtitular: 2,5 segundos a 20 CPS son 50 caracteres.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        await page.locator('#translation-1').click();
        await page.locator('#aiQuickTranslate').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('Vámonos');

        const [sistema, persona] = encargos.get(page).at(-1);
        expect(persona.content).toContain('[máximo 50 caracteres en total, 42 por línea]');
        expect(sistema.content).toContain('condensando');
    });

    test('y se le deja de decir si se desmarca la casilla', async ({ page }) => {
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        await page.locator('#aiConfigToggleBtn').click();
        // Ya conectado, el botón de lo avanzado es el de la otra cara.
        await page.locator('#aiConectado .ia-avanzado-btn').click();
        await page.locator('#aiRespetarLimites').uncheck();
        await page.locator('#aiConfigCerrarBtn').click();
        await page.locator('#translation-1').click();
        await page.locator('#aiQuickTranslate').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('Vámonos');

        const [sistema, persona] = encargos.get(page).at(-1);
        expect(persona.content).not.toContain('máximo');
        expect(sistema.content).not.toContain('condensando');
    });

    test('los subtítulos de alrededor van como contexto', async ({ page }) => {
        // En subtitulado una frase se reparte entre dos y tres subtítulos
        // continuamente: sin ver los de al lado se traduce media oración como
        // si fuera una entera.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        await page.locator('#translation-1').click();
        await page.locator('#aiQuickTranslate').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('Vámonos');

        const [, persona] = encargos.get(page).at(-1);
        expect(persona.content).toContain('Save the file to your computer');
        expect(persona.content).toContain('Goodbye');
    });

    test('una sugerencia que se carga la cursiva no se ofrece', async ({ page }) => {
        // Mejor un subtítulo sin traducir que uno que sale roto en pantalla.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page, 'Vámonos, dijo');
        await conectar(page);

        await page.locator('#translation-1').click();
        await page.locator('#aiQuickTranslate').click();

        await expect(page.locator('.ai-message-bot').last()).toContainText('⚠️');
        await expect(page.locator('.ai-insert-btn')).toHaveCount(0);
    });

    test('pretraducir llena los subtítulos vacíos y los marca como borrador', async ({ page }) => {
        // Una pretraducción sin revisar no es una traducción: tiene que poder
        // distinguirse en la lista de lo que ha repasado una persona.
        await cargarSrt(page, SRT, 'cursiva.srt');
        // Contesta con una lista JSON, que es lo que se le pide en lote.
        await servicioDeMentira(page, (cuerpo) => {
            const cuantos = (cuerpo.messages.at(-1).content.match(/^\d+\./gm) || []).length;
            return JSON.stringify(Array.from({ length: cuantos }, (_, i) => `Traducción ${i + 1}`));
        });
        await conectar(page);

        await page.locator('.ai-opcion').nth(1).click();
        await expect(page.locator('#pretraducirSeccion')).toBeVisible();
        await page.locator('#pretraducirEmpezarBtn').click();

        await expect(page.locator('#pretraducirSeccion')).toBeHidden({ timeout: 15_000 });
        await expect(page.locator('#translation-0')).toHaveText('Traducción 1');
        // Y se ve en la lista de dónde ha salido.
        await expect(page.locator('#translation-unit-0')).toHaveClass(/borrador-ia/);

        // Tocarlo lo convierte en tuyo.
        await page.locator('#translation-0').click();
        await page.keyboard.type('.');
        await expect(page.locator('#translation-unit-0')).not.toHaveClass(/borrador-ia/);
    });

    test('pretraducir no pisa lo que ya está traducido', async ({ page }) => {
        // Lo que ya está hecho lo ha hecho alguien, y pisarlo con una máquina
        // sin avisar sería el peor regalo posible.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page, () => JSON.stringify(['De la IA', 'De la IA']));
        await conectar(page);

        await page.locator('#translation-0').click();
        await page.keyboard.type('Escrito a mano');
        await page.locator('#translation-0').blur();

        await page.locator('.ai-opcion').nth(1).click();
        await page.locator('#pretraducirEmpezarBtn').click();
        await expect(page.locator('#pretraducirSeccion')).toBeHidden({ timeout: 15_000 });

        await expect(page.locator('#translation-0')).toHaveText('Escrito a mano');
    });

    test('la clave no se guarda en el ordenador si no se pide', async ({ page }) => {
        // Por defecto solo dura lo que dure la pestaña.
        await cargarSrt(page, SRT, 'cursiva.srt');
        await servicioDeMentira(page);
        await conectar(page);

        const guardada = await page.evaluate(() => ({
            sesion: sessionStorage.getItem('subpanda_ia_clave_openai'),
            siempre: localStorage.getItem('subpanda_ia_clave_openai'),
        }));

        expect(guardada.sesion).toBe('sk-de-mentira');
        expect(guardada.siempre).toBeFalsy();
    });
});

/**
 * La IA local, en el navegador.
 *
 * No se puede descargar un modelo de dos gigas en una prueba, ni hay WebGPU en
 * el navegador con el que se pasan. Lo que sí se comprueba es todo lo demás, que
 * es lo que se ve: que los dos servicios locales están en la lista y marcados
 * como tales, que no piden clave, y que antes de descargar nada sale un panda
 * contando lo que hay que saber.
 */
/** Carga un archivo, abre el asistente y abre el cuadro de ajustes. */
async function abrirLosAjustes(page) {
    await cargarSrt(page, SRT, 'cursiva.srt');
    await page.locator('#aiBtn').click();
    await page.locator('#aiConfigToggleBtn').click();
    await expect(page.locator('#aiConfigModal')).toBeVisible();
}

test.describe('la IA local', () => {
    test('los servicios locales van en su propio grupo de la lista', async ({ page }) => {
        await abrirLosAjustes(page);

        const grupos = await page.locator('#aiProveedor optgroup').allTextContents();
        expect(grupos).toHaveLength(2);

        const nombres = await page
            .locator('#aiProveedor optgroup:nth-of-type(2) option')
            .allTextContents();
        expect(nombres.join(' ')).toContain('WebLLM');
        // El modelo que trae Chrome se probó y se quitó: tardaba tanto en estar
        // listo que no era una opción de verdad.
        expect(nombres.join(' ')).not.toContain('Nano');

        const etiqueta = await page
            .locator('#aiProveedor optgroup:nth-of-type(2)')
            .getAttribute('label');
        expect(etiqueta).toContain('local');
    });

    test('con uno local no se pide clave y se explica antes de descargar', async ({ page }) => {
        await abrirLosAjustes(page);

        await page.locator('#aiProveedor').selectOption('webllm');

        // Ni clave ni enlace para ir a por ella: aquí no hay ninguna.
        await expect(page.locator('#aiClaveBloque')).toBeHidden();
        await expect(page.locator('#aiLocalBloque')).toBeVisible();

        // Y lo que hay que saber ANTES de descargar dos gigas, no después.
        const dice = await page.locator('#aiPandaLocal').textContent();
        expect(dice).toContain('NDA');
        expect(dice).toContain('translates worse');

        // El botón ya no dice "conectar": dice lo que de verdad va a pasar.
        await expect(page.locator('#aiConectarBtn')).toHaveText(/Download/i);
    });

    test('y al volver a uno de la nube, la clave vuelve a pedirse', async ({ page }) => {
        await abrirLosAjustes(page);

        await page.locator('#aiProveedor').selectOption('webllm');
        await page.locator('#aiProveedor').selectOption('openai');

        await expect(page.locator('#aiClaveBloque')).toBeVisible();
        await expect(page.locator('#aiLocalBloque')).toBeHidden();
    });

    test('el saludo del pandabot dice que también hay IA local', async ({ page }) => {
        await cargarSrt(page, SRT, 'cursiva.srt');
        await page.locator('#aiBtn').click();

        await expect(page.locator('#aiChatContainer')).toContainText('local AI');
    });
});

test.describe('recuperar el espacio del navegador', () => {
    test('el botón de borrar está donde se elige el modelo y avisa antes', async ({ page }) => {
        await abrirLosAjustes(page);
        await page.locator('#aiProveedor').selectOption('webllm');

        // Diez gigas guardados en el navegador no salen en la carpeta de
        // descargas ni en ningún sitio donde alguien piense en mirar.
        const boton = page.locator('#aiBorrarModelosBtn');
        await expect(boton).toBeVisible();

        await boton.click();

        // Se pregunta: borrar diez gigas sin preguntar no lo hace nadie.
        await expect(page.locator('#confirmModal')).toBeVisible();
        await expect(page.locator('#confirmModal')).toContainText('download');
    });

    test('y al aceptar, dice lo que ha borrado', async ({ page }) => {
        await abrirLosAjustes(page);
        await page.locator('#aiProveedor').selectOption('webllm');

        await page.locator('#aiBorrarModelosBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        // Sin librería que cargar en estas pruebas no hay modelos que borrar,
        // pero el barrido del almacén se hace igual y se cuenta lo que pasó.
        await expect(page.locator('#aiEspacioEstado')).toContainText('space is back');
    });
});

test.describe('elegir el modelo local', () => {
    test('los recomendados salen arriba, en su propio grupo', async ({ page }) => {
        await abrirLosAjustes(page);
        await page.locator('#aiProveedor').selectOption('webllm');

        // El desplegable no se llena en estas pruebas —haría falta traerse la
        // librería del CDN—, pero el rótulo del grupo y el orden sí se
        // comprueban en tests/ia-local.test.js. Lo que se vigila aquí es que el
        // bloque de elegir modelo salga y el de la clave no.
        await expect(page.locator('#aiModeloLocalBloque')).toBeVisible();
        await expect(page.locator('#aiClaveBloque')).toBeHidden();
        await expect(page.locator('#aiConectarBtn')).toHaveText(/Download/i);
    });
});
