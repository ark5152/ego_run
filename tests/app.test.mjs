import test from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../src/index.mjs';
import {ASSETS,SW,MANIFEST,APP_HTML} from '../build/generated.mjs';

const env={NOTION_TOKEN:'fixture-token',WIDGET_SECRET:'fixture-key'};
const get=p=>route(new Request('https://budget.example'+p),env);

test('/app redirects to /app/ so relative assets resolve',async()=>{
  const r=await get('/app?x=1');assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://budget.example/app/?x=1');
});
test('app shell is served with a strict CSP and no secrets',async()=>{
  const r=await get('/app/');assert.equal(r.status,200);
  assert.match(r.headers.get('content-type'),/text\/html/);
  assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const html=await r.text();assert.equal(html,APP_HTML);
  assert.ok(!html.includes('fixture-key')&&!html.includes('fixture-token'));
  assert.match(html,/rel="manifest" href="manifest.webmanifest"/);
});
test('manifest is valid and its icons exist',async()=>{
  const r=await get('/app/manifest.webmanifest');assert.match(r.headers.get('content-type'),/manifest\+json/);
  const m=JSON.parse(await r.text());assert.equal(m.display,'standalone');assert.equal(m.background_color,'#FFF6EE');
  for(const i of m.icons){const a=await get('/app/'+i.src);assert.equal(a.status,200,i.src);assert.equal(a.headers.get('content-type'),'image/png')}
  assert.equal(MANIFEST.includes('maskable'),true);
});
test('every image the app references is served',async()=>{
  const refs=new Set([...APP_HTML.matchAll(/assets\/[a-z0-9_./-]+\.png/g)].map(m=>m[0]));
  for(const f of ['wallet','calculator','calendar','house','bill','spoon-chopsticks','book-pen','bus','shopping-bag','bankbook','banknotes','money-envelope','subscription-laptop','chart','suitcase','piggy-bank','makeup','smartphone','grocery-basket','medical','pet-food','credit-card','knitting','clothes-shoes','movie-ticket','car','book','detergent-tissue','chicken-box'].map((n,i)=>`assets/icons/${String(i+1).padStart(2,'0')}_${n}.png`))refs.add(f);
  for(const ref of refs){const r=await get('/app/'+ref);assert.equal(r.status,200,ref);const b=new Uint8Array(await r.arrayBuffer());assert.deepEqual([...b.slice(1,4)],[80,78,71],ref)}
});
test('service worker precaches the shell and never caches the API',async()=>{
  const r=await get('/app/sw.js');assert.match(r.headers.get('content-type'),/javascript/);
  const s=await r.text();assert.equal(s,SW);assert.ok(!s.includes('__BUILD_VERSION__')&&!s.includes('__ASSET_LIST__'));
  assert.match(s,/startsWith\('\/api\/'\)\)return/);
  for(const k of Object.keys(ASSETS))assert.ok(s.includes(JSON.stringify(k.replace('/app/',''))),k);
});
test('unknown asset falls through to a 404, widgets and API still work',async()=>{
  assert.equal((await get('/app/assets/nope.png')).status,404);
  for(const p of ['/','/records','/calendar','/monthly'])assert.equal((await get(p)).status,200,p);
  const api=await route(new Request('https://budget.example/api/load',{method:'POST',headers:{'x-widget-key':'wrong'},body:'{}'}),env);
  assert.equal(api.status,401);
});
