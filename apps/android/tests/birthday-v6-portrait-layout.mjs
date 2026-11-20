// The owner-provided 20 Nov Android recording showed the app header and
// bottom nav covering the birthday scene and cake CTA. Verify REAL CSS
// geometry in Chromium without production login, DOB, data or API writes.
// The DOM fixture mirrors the exact BirthdayMagic scene class structure;
// the separate source contract ensures the component is portaled to body.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const css = fs.readFileSync(path.join(root, "apps/web/src/components/experience/birthday-magic.module.css"), "utf8");
const source = fs.readFileSync(path.join(root, "apps/web/src/components/experience/birthday-magic.tsx"), "utf8");
assert.match(source, /import\\s*\\{\\s*createPortal\\s*\\}\\s*from\\s*["']react-dom["']/);
assert.match(source, /createPortal\\([\\s\\S]*document\\.body/);
assert.match(source, /data-birthday-scene=\\{scene\\}/);

const stage = '<div class="cakeStage"><div class="cakeGround"></div><div class="cakeStand"></div><div class="cakePedestal"></div><div class="cakeBody"><i class="cakeRibbon"></i><i class="cakeLace"></i></div><div class="cakeTop"></div><div class="berries"><i></i><i></i><i></i></div><div class="candles"><span class="candle"><i class="flame"></i></span><span class="candle"><i class="flame"></i></span><span class="candle"><i class="flame"></i></span></div><div class="cakeSlice"></div></div>';
const scenes = {
  welcome: '<div class="screen birthdayWelcome"><div class="welcomeHeader"><span>FC <strong>ARENA.</strong></span><span class="welcomeEdition">✧ BIRTHDAY EDITION</span></div><div class="birthdayWelcomeCopy"><p class="welcomeGreeting">TODAY, THE ARENA CELEBRATES ♥</p><h2>Happy <em>birthday!</em></h2><p class="welcomeName">PLAY_REVIEWER</p><p class="welcomeDescription">A little surprise, made just for you. Because today is more than just another matchday.</p></div><div class="birthdayWelcomeArt"><div class="welcomeHalo"></div><div class="welcomeSun"></div><div class="welcomeCake"><div class="wcPlate"></div><div class="wcBottom"></div><div class="wcTop"></div><div class="wcCandles"><i></i><i></i><i></i></div><div class="wcHeart">♡</div></div></div><div class="welcomeFooter"><button class="primary">Open your birthday surprise ↗</button><p>From your FC ARENA family, with love. ♡</p></div></div>',
  cake: '<div class="screen"><div class="fallbackWarmth"></div>' + stage + '<div class="cakeCopy"><p class="eyebrow">A MOMENT TO REMEMBER</p><h2>Make a wish,<br><em>PLAY_REVIEWER.</em></h2><p>Close your eyes for a second. Think of something beautiful.</p></div><div class="cakeActions"><p class="wishNote">Wish made. May beautiful things find you. ♥</p><button class="primary">Cut your birthday cake ♡</button></div></div>',
  letter: '<div class="letter"><p class="eyebrow">WITH LOVE, FROM YOUR FC ARENA FAMILY</p><div class="deco">✧</div><h2>Happy birthday,<br><em>PLAY_REVIEWER.</em></h2><p>To another year of great matches, little joys, unforgettable friendships and moments worth celebrating.</p><p>We are really glad you are part of our ARENA. Today, we celebrate <strong>you.</strong></p><strong class="signature">With love, FC ARENA ♥</strong><button class="primary">One more thing… →</button></div>',
  gift: '<div class="gift"><div class="giftVessel"><div class="gvLoopLeft"></div><div class="gvLoopRight"></div><div class="gvBox"><div class="gvRibbon"></div><div class="gvHorizontal"></div></div><div class="gvLid"><div class="gvLidRibbon"></div></div></div><p class="eyebrow">A SMALL GIFT, JUST FOR YOU</p><h2>Your day,<br><em>your story.</em></h2><p>Today your FC ARENA home wears a little birthday magic. Come back and relive this whenever you like.</p><div class="profileChip"><span>P</span><div><strong>PLAY_REVIEWER</strong><small>FC ARENA PLAYER · BIRTHDAY EDITION</small></div></div><button class="primary">Back to my ARENA →</button><small class="disclaimer">Celebration only. No coins, rankings or match records are changed.</small></div>',
};
const viewports = [
  { width: 320, height: 568 }, { width: 360, height: 640 },
  { width: 360, height: 803 }, { width: 390, height: 844 },
  { width: 412, height: 915 }, { width: 430, height: 932 },
  { width: 768, height: 1024 },
];
const browser = await chromium.launch({ headless: true });
let failures = [];
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  for (const [scene, content] of Object.entries(scenes)) {
    await page.setContent('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><header class="appHeader">FC ARENA</header><nav class="appBottomNav">Home | League | Cups | Matches | More</nav><div class="overlay" data-birthday-modal><div class="paper"><button class="sound">Music on</button><button class="close">Skip ×</button>' + content + '</div></div>');
    await page.addStyleTag({ content: '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}.appHeader{position:fixed;top:0;left:0;right:0;height:60px;background:white;z-index:9000}.appBottomNav{position:fixed;bottom:0;left:0;right:0;height:65px;background:white;z-index:9000}' });
    await page.addStyleTag({ content: css });
    const result = await page.evaluate(() => {
      const modal = document.querySelector('.paper');
      const action = document.querySelector('.paper .primary');
      const close = document.querySelector('.paper .close');
      if (!modal || !action || !close) return { error: 'missing controls' };
      // When text overflows (short WebViews) scroll its scene container
      // just enough to reach the CTA, exactly as a player would.
      action.scrollIntoView({ block: 'end' });
      const bounds = action.getBoundingClientRect(), shell = modal.getBoundingClientRect(), skip = close.getBoundingClientRect();
      const element = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      return {
        actionTop: bounds.top, actionBottom: bounds.bottom,
        actionLeft: bounds.left, actionRight: bounds.right,
        modalTop: shell.top, modalBottom: shell.bottom,
        skipTop: skip.top, skipBottom: skip.bottom,
        tapped: element === action || action.contains(element),
        viewportH, viewportW,
        documentOverflowX: document.documentElement.scrollWidth > viewportW + 1,
      };
    });
    const okay = !result.error && result.actionTop >= -1 && result.actionBottom <= result.viewportH + 1 &&
      result.actionLeft >= -1 && result.actionRight <= result.viewportW + 1 &&
      result.modalTop >= -1 && result.modalBottom <= result.viewportH + 1 &&
      result.skipTop >= 0 && result.skipBottom < result.viewportH &&
      result.tapped && !result.documentOverflowX;
    if (!okay) failures.push({ viewport, scene, result });
    if (process.env.BIRTHDAY_V6_LAYOUT_OUTPUT) {
      const dir = process.env.BIRTHDAY_V6_LAYOUT_OUTPUT;
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${viewport.width}x${viewport.height}-${scene}.png`) });
    }
  }
  await page.close();
}
await browser.close();
assert.deepEqual(failures, [], 'Birthday scenes must cover app chrome and keep all action buttons visible and tappable');
console.log('BIRTHDAY_V6_PORTRAIT_ALIGNMENT=PASS sizes=' + viewports.length + ' scenes=' + Object.keys(scenes).length);
