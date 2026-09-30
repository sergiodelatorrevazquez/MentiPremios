import { expect, test, type Page } from '@playwright/test';

const HARNESS = '/tests/e2e/harness/harness.html';
/**
 * Sin espacios y sin cortes, que es lo que hace que un texto se salga del viewport.
 * Los 50 caracteres no son casualidad: `LoginStep` pone `maxlength="50"` a la palabra
 * secreta, así que ese es el texto más largo que puede llegar a pintar la app.
 */
const LONG_SECRET = 'mariajosefernandezdelavegaysanzdesantamariadelossa';
const SECRET = 'mentipremios';
const LAST_QUESTION = 10;
const MemeQuestion = 6;
const MultimediaQuestion = 7;
const MIN_TOUCH_TARGET_PX = 44;

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) <= 640;

/** A portrait screenshot, the worst case for a full-screen dialog. */
const TALL_MEDIA = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="3200"><rect width="800" height="3200" fill="#90ee90"/></svg>';

async function useTallMedia(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/src/assets/') && !url.searchParams.has('import'),
    (route) => route.fulfill({ contentType: 'image/svg+xml', body: TALL_MEDIA }),
  );
}

async function openApp(page: Page, query = '') {
  await page.goto(`${HARNESS}${query}`);
  await expect(page.getByRole('button', { name: 'Ver foto en grande' })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { scroll: root.scrollWidth, client: root.clientWidth };
  });

  expect(overflow.scroll, 'the page must not scroll sideways').toBeLessThanOrEqual(overflow.client + 1);
}

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();

  expect(box, `${selector} must be rendered`).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.y, `${selector} must be fully visible from the top`).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height, `${selector} must be fully visible from the bottom`)
    .toBeLessThanOrEqual(viewport.height + 1);
  expect(box!.x, `${selector} must stay inside the left edge`).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, `${selector} must stay inside the right edge`)
    .toBeLessThanOrEqual(viewport.width + 1);
}

async function login(page: Page, query = '', secret = SECRET) {
  await openApp(page, query);
  await page.locator('#secret-word').fill(secret);
  await page.getByRole('button', { name: /Entrar|Comprobando/ }).click();
}

async function answerUntil(page: Page, questionNumber: number) {
  await page.getByRole('button', { name: 'Empezar la encuesta' }).click();
  await expect(page.getByText(`Pregunta 1 de ${LAST_QUESTION}`)).toBeVisible();

  for (let current = 1; current < questionNumber; current += 1) {
    await page.locator('.option-card').first().click();
    await page.getByRole('button', { name: 'Siguiente pregunta' }).click();
    await expect(page.getByText(`Pregunta ${current + 1} de ${LAST_QUESTION}`)).toBeVisible();
  }
}

async function longPress(page: Page, selector: string) {
  const option = page.locator(selector).first();
  const box = (await option.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
}

test.describe('responsive layout', () => {
  test('login screen fits the viewport', async ({ page }) => {
    await openApp(page);

    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, '.hero-title');
    await expectInsideViewport(page, '.field-input');

    const input = page.locator('.field-input');
    const box = (await input.boundingBox())!;
    const content = await page.locator('.app-content').boundingBox();
    expect(box.width).toBeLessThanOrEqual(content!.width);
  });

  test('login keeps the working button reachable with a long loading label', async ({ page }) => {
    await openApp(page, '?scenario=slow&delay=4000');
    await page.locator('#secret-word').fill(SECRET);
    await page.getByRole('button', { name: 'Entrar' }).click();

    const submit = page.getByRole('button', { name: 'Comprobando...' });
    await expect(submit).toBeVisible();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, '.footer .button-primary');

    if (isMobile(page)) {
      const box = (await submit.boundingBox())!;
      expect(box.height, 'the loading action stays a comfortable touch target')
        .toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      const content = (await page.locator('.app-content').boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(content.x + content.width + 1);
    }
  });

  test('a question with many options stays inside the viewport', async ({ page }) => {
    await login(page);
    await answerUntil(page, MemeQuestion);

    await expectNoHorizontalOverflow(page);
    await expect(page.locator('.options-grid')).toHaveClass(/options-grid--8/);
    await expect(page.locator('.option-card')).toHaveCount(8);

    const clipped = await page.locator('.option-text').evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).length,
    );
    expect(clipped, 'long option labels must wrap instead of being cut').toBe(0);

    if (isMobile(page)) {
      const columns = await page.locator('.options-grid').evaluate(
        (node) => getComputedStyle(node).gridTemplateColumns.split(' ').length,
      );
      expect(columns, 'option cards collapse to a single column on mobile').toBe(1);

      const smallest = await page.locator('.option-card').evaluateAll(
        (nodes) => Math.min(...nodes.map((node) => node.getBoundingClientRect().height)),
      );
      expect(smallest, 'every option stays tappable').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    }
  });

  test('multimedia options keep their preview and open a reachable dialog', async ({ page }) => {
    await useTallMedia(page);
    await login(page);
    await answerUntil(page, MultimediaQuestion);

    await expectNoHorizontalOverflow(page);
    for (const preview of await page.locator('.option-media').all()) {
      const box = (await preview.boundingBox())!;
      const grid = (await page.locator('.options-grid').boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(grid.width + 1);
    }

    await longPress(page, '.option-card');
    const dialog = page.locator('.photo-modal');
    await expect(dialog).toBeVisible();
    await expectInsideViewport(page, '.photo-modal-image, .photo-modal-video');
    await expectInsideViewport(page, '.modal-close-btn');
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  });

  test('the photo dialog keeps the close button on screen for a tall image', async ({ page }) => {
    await useTallMedia(page);
    await openApp(page);

    await page.getByRole('button', { name: 'Ver foto en grande' }).click();
    await expect(page.locator('.photo-modal')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, '.photo-modal-image');
    await expectInsideViewport(page, '.modal-close-btn');

    const [media, close] = await Promise.all([
      page.locator('.photo-modal-image').boundingBox(),
      page.locator('.modal-close-btn').boundingBox(),
    ]);
    expect(close!.y, 'the close button keeps a margin from the top edge')
      .toBeGreaterThanOrEqual(7);
    expect(close!.height, 'the close button is a comfortable touch target')
      .toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(close!.y + close!.height, 'the close button does not overlap the media')
      .toBeLessThanOrEqual(media!.y + 1);

    await page.locator('.modal-close-btn').click();
    await expect(page.locator('.photo-modal')).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('a long secret word and the welcome copy stay readable', async ({ page }) => {
    await login(page, '', LONG_SECRET);

    // El saludo es el identificador del documento, que es la palabra secreta: lo que se
    // teclea en el login es, de todo lo que se pinta, lo más largo que puede llegar a ser.
    await expect(page.locator('.hero-title')).toHaveText(LONG_SECRET);
    await expectNoHorizontalOverflow(page);

    const title = (await page.locator('.hero-title').boundingBox())!;
    const content = (await page.locator('.app-content').boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(content.x + content.width + 1);

    await page.getByRole('button', { name: 'Empezar la encuesta' }).click();
    await expectNoHorizontalOverflow(page);
  });

  test('a failed submission keeps its retry action inside the viewport', async ({ page }) => {
    await login(page, '?scenario=submit-error&delay=1500');
    await page.getByRole('button', { name: 'Empezar la encuesta' }).click();

    for (let current = 1; current < LAST_QUESTION; current += 1) {
      await page.locator('.option-card').first().click();
      await page.getByRole('button', { name: 'Siguiente pregunta' }).click();
    }

    const submit = page.getByRole('button', { name: 'Enviar y cerrar' });
    await expect(submit).toBeVisible();
    await page.locator('.option-card').first().click();
    await submit.click();

    const retry = page.getByRole('button', { name: 'Reintentar envío' });
    await expect(retry).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, '.footer-actions .button-primary');
    await expect(page.locator('.status--error')).toBeVisible();
  });

  test('the final confirmation fits the viewport with a long message', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Empezar la encuesta' }).click();

    for (let current = 1; current < LAST_QUESTION; current += 1) {
      await page.locator('.option-card').first().click();
      await page.getByRole('button', { name: 'Siguiente pregunta' }).click();
    }
    await page.locator('.option-card').first().click();
    await page.getByRole('button', { name: 'Enviar y cerrar' }).click();

    await expect(page.getByText('Gracias por participar')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('.status--success')).toContainText('Respuestas guardadas');
  });
});
