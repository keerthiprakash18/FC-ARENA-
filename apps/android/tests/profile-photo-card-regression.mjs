import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, user, career } from './phase-ui-harness.mjs';
import { summarizeExperience } from '../../api/src/experience/experience-policy.ts';

const output = path.resolve('.cache/profile-fix/screenshots'); fs.mkdirSync(output, { recursive: true });
const photo = await sharp(Buffer.from('<svg width="900" height="300"><rect width="300" height="300" fill="#ff0000"/><rect x="300" width="300" height="300" fill="#00ff00"/><rect x="600" width="300" height="300" fill="#0000ff"/></svg>')).png().toBuffer();
const progress = summarizeExperience([], 0, false);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
let checked = 0;
async function multipart(route) { const r = route.request(); return await new Request(r.url(), { method: r.method(), headers: r.headers(), body: r.postDataBuffer() }).formData(); }
try {
  for (const width of [320, 390, 768]) for (const native of [false, true]) {
    let avatar = null, savedPhoto, cardPng, failUpload = true, failCard = true, uploads = 0;
    const id = '81fb40f4-7e4f-40a6-a429-c87dd7242ae2';
    const snapshot = () => ({ ...career, profile: { ...career.profile, fullName: user.fullName, email: user.email, phoneNumber: null, profileImageUrl: avatar, joinedAt: '2026-01-01T00:00:00Z' } });
    const { context, page, errors } = await createUiContext(browser, { width, native, mode: native ? 'DARK' : 'LIGHT', overrides: {
      '/api/experience/me': progress,
      '/api/players/me/career': (route, headers) => route.fulfill({ headers, json: { success: true, data: snapshot(), error: null } }),
      [`/api/players/card-exports/${id}`]: (route, headers) => route.fulfill({ headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="FC-ARENA-P3.png"', 'Cache-Control': 'private, no-store' }, body: cardPng }),
    }, onMutation: async (route, headers) => {
      const p = new URL(route.request().url()).pathname;
      const reply = (status, data, message) => route.fulfill({ status, headers, json: { success: status < 400, data, error: message ? { code: 'TEST_ERROR', message } : null } });
      if (p === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
      if (p === '/api/players/me/profile-image') {
        uploads++; const form = await multipart(route); const image = form.get('image');
        assert.equal(image.type, 'image/jpeg'); const bytes = Buffer.from(await image.arrayBuffer());
        assert.deepEqual(await sharp(bytes).metadata().then(m => [m.width, m.height]), [512, 512]);
        const pixel = await sharp(bytes).extract({ left: 256, top: 256, width: 1, height: 1 }).raw().toBuffer(); assert(pixel[0] > 245 && pixel[1] < 10, 'The selected left/red crop is uploaded, rather than the automatic middle crop');
        if (failUpload) { failUpload = false; return reply(500, null, 'Photo upload temporarily unavailable.'); }
        savedPhoto = await sharp(bytes).webp().toBuffer(); avatar = 'https://res.cloudinary.com/fc-test/profile.webp?fc_photo=' + uploads;
        return reply(201, { profileImageUrl: avatar, message: 'Profile photo updated.' });
      }
      if (p === '/api/players/me/card-export') {
        if (failCard) { failCard = false; return reply(500, null, 'Card preparation temporarily unavailable.'); }
        const form = await multipart(route); cardPng = Buffer.from(await form.get('image').arrayBuffer());
        assert.deepEqual(await sharp(cardPng).metadata().then(m => [m.width, m.height]), [1080, 1350]);
        const pixel = await sharp(cardPng).extract({ left: 540, top: 400, width: 1, height: 1 }).raw().toBuffer(); assert(pixel[0] > 240 && pixel[1] < 15, 'The exported player card contains the saved photo');
        return reply(201, { path: `/players/card-exports/${id}?grant=fixture.signature`, filename: 'FC-ARENA-P3.png', expiresAt: new Date(Date.now() + 300000).toISOString() });
      }
      throw new Error('Unexpected mutation ' + p);
    } });
    await context.route('https://res.cloudinary.com/fc-test/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*', 'Content-Type': 'image/webp' }, body: savedPhoto }));
    try {
      await page.goto('https://fcarena.in/profile');
      await page.getByRole('button', { name: 'Add profile photo', exact: true }).waitFor();
      await page.locator('input[type=file]').first().setInputFiles({ name: 'landscape.png', mimeType: 'image/png', buffer: photo });
      const dialog = page.getByRole('dialog', { name: 'Adjust your profile photo' });
      await dialog.getByLabel('Photo zoom', { exact: true }).waitFor();
      const saveBox = await dialog.getByRole('button', { name: 'Save photo', exact: true }).boundingBox(); assert(saveBox.y >= 0 && saveBox.y + saveBox.height <= 850, 'Save stays visible on a small phone');
      const crop = dialog.getByLabel('Profile photo crop preview');
      const pixel = () => crop.evaluate(c => Array.from(c.getContext('2d').getImageData(256, 256, 1, 1).data));
      assert((await pixel())[1] > 245, 'Initial crop is the green middle');
      await dialog.getByLabel('Horizontal position', { exact: true }).focus(); await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('.photo-crop-stage canvas')?.getContext('2d').getImageData(256, 256, 1, 1).data[0] > 245);
      const box = await crop.boundingBox(); await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
      assert((await pixel())[1] > 245, 'Dragging changes the selected region');
      await dialog.getByRole('button', { name: 'Rotate 90°' }).click();
      await dialog.getByLabel('Vertical position', { exact: true }).focus(); await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('.photo-crop-stage canvas')?.getContext('2d').getImageData(256, 256, 1, 1).data[0] > 245);
      await dialog.getByLabel('Photo zoom', { exact: true }).focus(); await page.keyboard.press('End');
      assert.equal(await dialog.getByLabel('Photo zoom', { exact: true }).inputValue(), '3');
      await dialog.getByRole('button', { name: 'Reset crop' }).click(); await dialog.getByLabel('Horizontal position', { exact: true }).focus(); await page.keyboard.press('Home');
      assert.equal(uploads, 0, 'Choosing/adjusting a photo never uploads before Save');
      await checkLayout(page, `Photo editor ${width} native=${native}`);
      if (width === 390 && native) await page.screenshot({ path: path.join(output, 'photo-crop-preview.png') });
      await dialog.getByRole('button', { name: 'Save photo', exact: true }).click(); await dialog.getByText('Photo upload temporarily unavailable.', { exact: true }).waitFor();
      assert.equal(avatar, null); assert((await pixel())[0] > 245, 'A failed save retains the crop for retry');
      await dialog.getByRole('button', { name: 'Save photo', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      assert.equal(uploads, 2); await page.locator('.profile-photo-current img').waitFor();
      assert.equal(await page.locator('.edition-portrait img').getAttribute('src'), avatar);
      // Invalid input stays recoverable: Cancel and another file choice remain available.
      await page.locator('input[type=file]').first().setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
      await dialog.getByText('Choose a JPG, PNG or WEBP photo.', { exact: true }).waitFor(); assert(await dialog.getByRole('button', { name: 'Save photo', exact: true }).isDisabled());
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); assert.equal(uploads, 2);
      if (width === 390 && native) {
        const portrait = await sharp(photo).jpeg().withMetadata({ orientation: 6 }).toBuffer();
        await page.locator('input[type=file]').first().setInputFiles({ name: 'camera-portrait.jpg', mimeType: 'image/jpeg', buffer: portrait });
        await dialog.getByLabel('Vertical position', { exact: true }).waitFor(); await dialog.getByLabel('Vertical position', { exact: true }).focus(); await page.keyboard.press('Home');
        await page.waitForFunction(() => document.querySelector('.photo-crop-stage canvas')?.getContext('2d').getImageData(256, 256, 1, 1).data[0] > 245);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); assert.equal(uploads, 2, 'Camera EXIF rotation is previewed without changing the saved photo');
      }
      await page.getByRole('button', { name: 'Download player card ↓', exact: true }).click(); await page.getByText('Card preparation temporarily unavailable.', { exact: false }).waitFor();
      const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download player card ↓', exact: true }).click(); const downloaded = await downloading;
      assert(downloaded.url().startsWith('https://api.fcarena.in/api/players/card-exports/'), 'Android receives an HTTPS attachment, never a blob URL');
      assert.equal(page.url(), 'https://fcarena.in/profile', 'Downloading retains the main profile document');
      assert.equal(downloaded.suggestedFilename(), 'FC-ARENA-P3.png'); const saved = fs.readFileSync(await downloaded.path()); assert.deepEqual(await sharp(saved).metadata().then(m => [m.width, m.height]), [1080, 1350]);
      await page.getByRole('link', { name: 'Save PNG ↓', exact: true }).waitFor();
      const retryDownload = page.waitForEvent('download'); await page.getByRole('link', { name: 'Save PNG ↓', exact: true }).click(); await retryDownload;
      await checkLayout(page, `Profile + download ${width} native=${native}`);
      if (width === 390 && native) await page.screenshot({ path: path.join(output, 'profile-photo-saved.png'), fullPage: true });
      assert.deepEqual(errors, []); checked++;
    } finally { await context.close(); }
  }
  console.log(`PASS: ${checked} browser/native layouts; drag/zoom/rotate crop, exact uploaded pixels, save failure/retry, invalid-image cancellation, avatar/card consistency and real HTTPS PNG downloads.`);
} finally { await browser.close(); }
