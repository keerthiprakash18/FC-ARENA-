import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read = path => fs.readFileSync(new URL('../'+path, import.meta.url),'utf8');
const css = read('apps/web/src/app/design-tokens.css');
const app = read('apps/web/src/app/arena-consolidated.css');
const preview = read('apps/web/src/app/settings/appearance/page.tsx');
test('signature identity is defined for all twelve persisted themes',()=>{
  const signatures=[...css.matchAll(/--theme-signature-pattern:\s*([^;]+);/g)].map(m=>m[1]);
  assert.equal(signatures.length,12);
  assert.equal(new Set(signatures).size,12);
  const dark=[...css.matchAll(/:root\[data-mode="dark"\]\[data-theme="([^"]+)"\][^{]*\{([^}]+)\}/g)];
  assert.equal(dark.length,12);
  const surfaces=dark.filter(m=>m[1]!=='luxury-gold').map(m=>m[2].match(/--theme-surface:\s*(#[0-9a-f]{6})/i)?.[1]);
  assert.equal(new Set(surfaces).size,11);
  assert(surfaces.every(Boolean));
  assert.match(app,/--arena-hero-surface: var\(--theme-signature-pattern\)/);
  assert.match(preview,/data-preview-mode=\{dark \? "dark" : "light"\}/);
  assert.match(preview,/dark=\{resolvedDark\}/);
  assert.match(preview,/unofficial fan themes/);
});
test('signature matchday text, accents and actions have literal endpoint contrast',()=>{
  const rules=[...css.matchAll(/(:root[^{]*)\{([^}]+)\}/g)].map(m=>({selector:m[1],values:Object.fromEntries([...m[2].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)].map(v=>[v[1],v[2]]))}));
  const themes=['luxury-gold',...rules.filter(r=>r.selector.startsWith(':root[data-theme=')).map(r=>r.selector.match(/data-theme="([^"]+)"/)[1])];
  const luminance=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
  for(const theme of themes)for(const mode of ['light','dark']){
    const v=Object.assign({},...rules.filter(r=>(!r.selector.includes('data-mode="dark"')||mode==='dark')&&(!r.selector.includes('data-theme=')||r.selector.includes('data-theme="'+theme+'"'))).map(r=>r.values));
    for(const [a,b] of [['matchday-text','matchday-start'],['matchday-text','matchday-end'],['matchday-accent','matchday-start'],['matchday-accent','matchday-end'],['on-matchday-accent','matchday-accent']]){
      const x=luminance(v['--theme-'+a]),y=luminance(v['--theme-'+b]);assert((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=4.5,theme+'/'+mode+' '+a+' on '+b);
    }
  }
});

test('header picker and dashboard career overview use signature tokens',()=>{
  const picker=read('apps/web/src/components/app/theme-quick-picker.tsx');
  const hero=read('apps/web/src/app/dashboard/career-hero.module.css');
  assert.match(picker,/data-preview-mode=\{resolvedDark \? "dark" : "light"\}/);
  assert.match(picker,/option.signature/);
  assert.match(hero,/var\(--theme-matchday-accent\)/);
  assert.match(hero,/var\(--theme-matchday-start\)/);
});
