/**
 * El asistente de IA, desde la herramienta.
 *
 * Ninguna de estas pruebas llama a un servicio de verdad: se intercepta la
 * petición y se contesta desde aquí. Así se puede comprobar el camino entero
 * —elegir servicio, guardar la clave, pedir una sugerencia, pretraducir— sin
 * gastar dinero y sin depender de que OpenAI esté de buenas.
 */
import { test, expect, cargarPo } from './apoyo.js';

/** PO con una etiqueta dentro, que es lo que puede romperse. */
const PO = `msgid ""
msgstr ""
"Language: es\\n"

msgid "Save"
msgstr ""

msgid "Press %s to continue"
msgstr ""

msgid "Delete"
msgstr ""
`;

/**
 * Deja el asistente configurado con OpenAI y una clave de mentira, y hace que
 * el servicio conteste lo que se le diga.
 *
 * @param {import('@playwright/test').Page} page
 * @param {(cuerpo: Object) => string} responder Qué contesta el servicio.
 */
async function conIaDeMentira(page, responder) {
    await page.route('https://api.openai.com/**', async (ruta) => {
        const peticion = ruta.request();

        if (peticion.url().endsWith('/models')) {
            return ruta.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }),
            });
        }

        const cuerpo = JSON.parse(peticion.postData() || '{}');
        return ruta.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ choices: [{ message: { content: responder(cuerpo) } }] }),
        });
    });

    await page.evaluate(() => {
        localStorage.setItem('poanda_ia_proveedor', 'openai');
        localStorage.setItem('poanda_ia_modelo_openai', 'gpt-4o-mini');
        sessionStorage.setItem('poanda_ia_clave_openai', 'sk-de-mentira');
    });
    await page.reload();
}

/**
 * Un traductor de mentira que se comporta como uno de verdad: devuelve una
 * traducción por segmento y **conserva las marcas** de las etiquetas, que es lo
 * que Poanda comprueba antes de guardar nada.
 *
 * @param {Object} cuerpo Lo que se le mandó al servicio.
 * @returns {string} La lista JSON de traducciones.
 */
function traductorDeMentira(cuerpo) {
    const encargo = cuerpo.messages.at(-1).content;
    const lineas = encargo.split('\n').filter((l) => /^\d+\. /.test(l));

    return JSON.stringify(
        lineas.map((linea, i) => {
            const marcas = linea.match(/⟦\d+⟧/g) || [];
            return `Traducido ${i + 1}${marcas.length ? ` ${marcas.join(' ')}` : ''}`;
        }),
    );
}

/** Abre el panel del asistente. */
async function abrirAsistente(page) {
    await page.locator('#aiBtn').click();
    await expect(page.locator('#aiSidebar')).toHaveClass(/show-sidebar/);
}

test.describe('ajustes del asistente', () => {
    test('sin configurar, abrir PandaBot lleva directo a los ajustes', async ({ page }) => {
        // Lo primero que hay que ver al abrirlo por primera vez es dónde se
        // pone la clave, no un cuadro de chat que solo va a dar un error.
        await abrirAsistente(page);

        await expect(page.locator('#aiConfigPanel')).toBeVisible();
        await expect(page.locator('.ai-message-bot').first()).toContainText(/AI service/i);
    });

    test('ya configurado, se abre el chat y no los ajustes', async ({ page }) => {
        await conIaDeMentira(page, () => 'Hola');
        await abrirAsistente(page);

        await expect(page.locator('#aiConfigPanel')).toBeHidden();
        await expect(page.locator('.ai-message-bot').first()).toContainText(/Ask me anything/i);
    });

    test('se puede elegir entre los cuatro servicios', async ({ page }) => {
        await abrirAsistente(page);

        const opciones = await page.locator('#aiProveedor option').allTextContents();
        expect(opciones.join(' ')).toMatch(/Gemini/);
        expect(opciones.join(' ')).toMatch(/OpenAI/);
        expect(opciones.join(' ')).toMatch(/Anthropic/);
        expect(opciones.join(' ')).toMatch(/Ollama/);
    });

    test('con una IA local no se pide clave y sí la dirección', async ({ page }) => {
        // Pedir una clave que no existe solo confunde; la dirección, en cambio,
        // es lo único que hay que tocar para apuntar a Ollama o a LM Studio.
        await abrirAsistente(page);

        await page.locator('#aiProveedor').selectOption('compatible');
        await expect(page.locator('#aiClaveBloque')).toBeHidden();
        await expect(page.locator('#aiUrlBloque')).toBeVisible();
        await expect(page.locator('#aiBaseUrl')).toHaveValue(/11434/);
    });

    test('con un servicio de la nube se pide clave y no la dirección', async ({ page }) => {
        await abrirAsistente(page);

        await page.locator('#aiProveedor').selectOption('openai');
        await expect(page.locator('#aiClaveBloque')).toBeVisible();
        await expect(page.locator('#aiUrlBloque')).toBeHidden();
    });

    test('la clave no se guarda en el ordenador salvo que se marque', async ({ page }) => {
        // Por defecto vive solo mientras la pestaña esté abierta.
        await page.route('https://api.openai.com/v1/models', (ruta) =>
            ruta.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }),
            }),
        );

        await abrirAsistente(page);
        await page.locator('#aiProveedor').selectOption('openai');
        await page.locator('#aiClave').fill('sk-secreta');
        await page.locator('#aiConectarBtn').click();
        await expect(page.locator('#aiConectado')).toBeVisible();

        const guardado = await page.evaluate(() => ({
            sesion: sessionStorage.getItem('poanda_ia_clave_openai'),
            ordenador: localStorage.getItem('poanda_ia_clave_openai'),
        }));

        expect(guardado.sesion).toBe('sk-secreta');
        expect(guardado.ordenador).toBeNull();
    });

    test('conectar y guardar son un solo botón, y solo guarda si conecta', async ({ page }) => {
        // Guardar una clave que no funciona es el caso peor: se queda ahí tan
        // tranquila y no da la cara hasta media pretraducción.
        await page.route('https://api.openai.com/v1/models', (ruta) =>
            ruta.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: { message: 'Incorrect API key' } }),
            }),
        );

        await abrirAsistente(page);
        await page.locator('#aiProveedor').selectOption('openai');
        await page.locator('#aiClave').fill('sk-mal-pegada');
        await page.locator('#aiConectarBtn').click();

        await expect(page.locator('#aiEstadoConexion')).toContainText('❌');
        // Sigue en la cara de "sin conectar" y no ha guardado nada.
        await expect(page.locator('#aiSinConectar')).toBeVisible();
        const guardada = await page.evaluate(() =>
            sessionStorage.getItem('poanda_ia_clave_openai'),
        );
        expect(guardada).toBeNull();
    });

    test('al conectar salen todos los modelos y queda elegido el más reciente', async ({
        page,
    }) => {
        await page.route('https://api.openai.com/v1/models', (ruta) =>
            ruta.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [
                        { id: 'gpt-4o-mini', created: 1_700_000_000 },
                        { id: 'gpt-5.2', created: 1_770_000_000 },
                        { id: 'text-embedding-3-large', created: 1_780_000_000 },
                    ],
                }),
            }),
        );

        await abrirAsistente(page);
        await page.locator('#aiProveedor').selectOption('openai');
        await page.locator('#aiClave').fill('sk-de-mentira');
        await page.locator('#aiConectarBtn').click();

        await expect(page.locator('#aiConectado')).toBeVisible();
        await expect(page.locator('#aiConectadoServicio')).toContainText('OpenAI');

        // El más reciente, elegido; y los de embeddings, fuera de la lista.
        await expect(page.locator('#aiModelo')).toHaveValue('gpt-5.2');
        const modelos = await page.locator('#aiModelo option').allTextContents();
        expect(modelos).toEqual(['gpt-5.2', 'gpt-4o-mini']);
    });

    test('se puede cambiar de servicio después de haberse conectado', async ({ page }) => {
        // De Gemini a OpenAI sin tener que borrar nada a mano.
        await conIaDeMentira(page, () => 'Hola');
        await abrirAsistente(page);
        await page.locator('#aiConfigToggleBtn').click();

        await expect(page.locator('#aiConectado')).toBeVisible();
        await page.locator('#aiCambiarBtn').click();

        await expect(page.locator('#aiSinConectar')).toBeVisible();
        await expect(page.locator('#aiProveedor')).toBeVisible();
    });
});

test.describe('preguntar al asistente', () => {
    test('se puede consultar sin tener ningún archivo abierto', async ({ page }) => {
        // Documentarse sobre un tema no tiene por qué esperar a abrir un
        // archivo; antes hacía falta estar dentro de un segmento para preguntar.
        await conIaDeMentira(page, () => 'En este contexto, "commit" se traduce como "confirmar".');
        await abrirAsistente(page);

        await page.locator('#aiUserInput').fill('¿Cómo traduzco "commit" en control de versiones?');
        await page.locator('#aiSendBtn').click();

        await expect(page.locator('.ai-message-bot').last()).toContainText('confirmar');
    });

    test('se puede repreguntar y la IA recuerda lo hablado', async ({ page }) => {
        // La mitad de la utilidad de un asistente frente a un buscador.
        await conIaDeMentira(page, (cuerpo) => {
            const turnos = cuerpo.messages.filter((m) => m.role === 'user').length;
            return turnos > 1 ? 'En América se prefiere "computadora".' : 'Se traduce "ordenador".';
        });
        await abrirAsistente(page);

        await page.locator('#aiUserInput').fill('¿Cómo traduzco "computer"?');
        await page.locator('#aiSendBtn').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('ordenador');

        await page.locator('#aiUserInput').fill('¿Y en Latinoamérica?');
        await page.locator('#aiSendBtn').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('computadora');
    });

    test('sin configurar, lo dice y abre los ajustes en vez de fallar', async ({ page }) => {
        await abrirAsistente(page);
        await page.locator('#aiUserInput').fill('Hola');
        await page.locator('#aiSendBtn').click();

        await expect(page.locator('.ai-message-bot').last()).toContainText(/AI service/i);
        await expect(page.locator('#aiConfigPanel')).toBeVisible();
    });
});

test.describe('sugerir la traducción de un segmento', () => {
    test('la sugerencia se puede insertar en el segmento', async ({ page }) => {
        await conIaDeMentira(page, () => 'Guardar');
        await cargarPo(page, PO);

        await page.locator('#msgstr-1-0').click();
        await abrirAsistente(page);
        await page.locator('#aiQuickTranslate').click();

        const sugerencia = page.locator('.ai-message-bot').last();
        await expect(sugerencia).toContainText('Guardar');

        await sugerencia.locator('.ai-insert-btn').click();
        await expect(page.locator('#msgstr-1-0')).toHaveValue('Guardar');
    });

    test('al segmento con etiqueta se le mandan marcas, no la etiqueta', async ({ page }) => {
        // Lo que el modelo no ve, no lo puede estropear.
        let loQueSeMando = '';
        await conIaDeMentira(page, (cuerpo) => {
            loQueSeMando = cuerpo.messages.map((m) => m.content).join('\n');
            return 'Pulsa ⟦0⟧ para continuar';
        });
        await cargarPo(page, PO);

        await page.locator('#msgstr-2-0').click();
        await abrirAsistente(page);
        await page.locator('#aiQuickTranslate').click();
        await expect(page.locator('.ai-message-bot').last()).toContainText('Pulsa %s');

        expect(loQueSeMando).toContain('⟦0⟧');
        expect(loQueSeMando).not.toContain('%s');
    });

    test('si la sugerencia pierde la etiqueta, no se ofrece', async ({ page }) => {
        // Ofrecerla sería ofrecer un archivo roto con buena letra.
        await conIaDeMentira(page, () => 'Pulsa para continuar');
        await cargarPo(page, PO);

        await page.locator('#msgstr-2-0').click();
        await abrirAsistente(page);
        await page.locator('#aiQuickTranslate').click();

        const respuesta = page.locator('.ai-message-bot').last();
        await expect(respuesta).toContainText(/discarded/i);
        await expect(respuesta.locator('.ai-insert-btn')).toHaveCount(0);
    });
});

test.describe('pretraducir el archivo', () => {
    test('traduce los segmentos vacíos y los marca como borrador', async ({ page }) => {
        await conIaDeMentira(page, traductorDeMentira);
        await cargarPo(page, PO);

        await page.locator('#toolsBtn').click();
        await page.locator('#pretraducirBtn').click();
        await page.locator('input[name="motorIA"][value="contexto"]').check();
        await page.locator('#pretraducirEmpezarBtn').click();

        await expect(page.locator('#messageBox')).toBeVisible({ timeout: 15_000 });
        await page.locator('#messageClose').click();

        // Los tres segmentos vacíos están traducidos y marcados.
        await expect(page.locator('#msgstr-1-0')).not.toHaveValue('');
        await expect(page.locator('.segmento-fila.borrador-ia')).toHaveCount(3);
    });

    test('lo ya traducido no se toca', async ({ page }) => {
        await conIaDeMentira(page, traductorDeMentira);
        await cargarPo(page, PO);

        // Se traduce uno a mano antes de pretraducir. Sin esperar a que el
        // editor lo recoja: hacerlo justo después es el caso en el que la
        // pretraducción podría pisar lo que alguien acaba de escribir.
        await page.locator('#msgstr-1-0').fill('Mi traducción');
        await page.locator('#msgstr-1-0').blur();

        await page.locator('#toolsBtn').click();
        await page.locator('#pretraducirBtn').click();
        await page.locator('input[name="motorIA"][value="contexto"]').check();
        await page.locator('#pretraducirEmpezarBtn').click();

        await expect(page.locator('#messageBox')).toBeVisible({ timeout: 15_000 });
        await page.locator('#messageClose').click();

        // Lo que hizo una persona sigue ahí y sin marca de borrador.
        await expect(page.locator('#msgstr-1-0')).toHaveValue('Mi traducción');
        await expect(page.locator('.segmento-fila.borrador-ia')).toHaveCount(2);
    });

    test('validar a mano quita la marca de borrador', async ({ page }) => {
        await conIaDeMentira(page, traductorDeMentira);
        await cargarPo(page, PO);

        await page.locator('#toolsBtn').click();
        await page.locator('#pretraducirBtn').click();
        await page.locator('input[name="motorIA"][value="contexto"]').check();
        await page.locator('#pretraducirEmpezarBtn').click();
        await expect(page.locator('#messageBox')).toBeVisible({ timeout: 15_000 });
        await page.locator('#messageClose').click();

        await expect(page.locator('.segmento-fila.borrador-ia')).toHaveCount(3);
        await page.locator('#validateBtn-1-0').click();
        await expect(page.locator('.segmento-fila.borrador-ia')).toHaveCount(2);
    });

    test('sin nada que traducir, lo dice en vez de abrir el cuadro', async ({ page }) => {
        await cargarPo(page, 'msgid "Save"\nmsgstr "Guardar"\n');

        await page.locator('#toolsBtn').click();
        await page.locator('#pretraducirBtn').click();

        await expect(page.locator('#messageText')).toContainText(/nothing left to translate/i);
        await expect(page.locator('#pretraducirModal')).toBeHidden();
    });
});
