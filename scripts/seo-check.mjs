const BASE = process.env.BASE_URL || 'http://localhost:3000';
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const get = async p => { const r = await fetch(BASE + p, { redirect: 'manual' }); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '' }; };

const pages = ['/', '/shop', '/workshops', '/cities/jaipur', '/products/crochet-lily-bouquet-p1', '/workshops/beginner-crochet-make-your-first-flower-w1'];
for (const p of pages) {
  const { status, text } = await get(p);
  ok(status === 200, `${p} → 200`);
  ok((text.match(/<h1[\s>]/g) || []).length === 1, `${p} has exactly one <h1>`);
  ok(/<title>[^<]{10,}<\/title>/.test(text), `${p} has <title>`);
  const desc = /<meta name="description" content="([^"]*)"/.exec(text);
  ok(!!desc && desc[1].length > 20 && desc[1].length <= 160, `${p} meta description 20-160 chars`);
  ok(/<link rel="canonical" href="[^"]+"/.test(text), `${p} has canonical`);
  ok(/<html[^>]*lang="en-IN"/.test(text), `${p} lang en-IN`);
  ok(/property="og:title"/.test(text) && /property="og:image"/.test(text), `${p} has og:title + og:image`);
  for (const m of text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(m[1]); ok(true, `${p} JSON-LD parses`); } catch { ok(false, `${p} JSON-LD parses`); }
  }
}

const prod = (await get('/products/crochet-lily-bouquet-p1')).text;
ok(prod.includes('"@type":"Product"') && prod.includes('"priceCurrency":"INR"'), 'product page has Product+Offer JSON-LD');
const ws = (await get('/workshops/beginner-crochet-make-your-first-flower-w1')).text;
ok(ws.includes('"@type":"Event"') && ws.includes('+05:30'), 'workshop page has Event JSON-LD');

for (const p of ['/products/anything-p1', '/products/nope', '/workshops/x-w1', '/cities/delhi', '/zzz'])
  ok((await get(p)).status === 404, `${p} → 404`);

const f = (await get('/shop?city=Jaipur&q=blue')).text;
ok(/<meta name="robots" content="noindex, follow"/.test(f), 'filtered /shop is noindex,follow');
ok(/<link rel="canonical" href="[^"]*\/shop"/.test(f), 'filtered /shop canonical is /shop');
ok((await get('/shop?q=' + 'x'.repeat(10000))).status === 200, 'huge q does not crash');

const sm = await get('/sitemap.xml');
ok(sm.status === 200 && sm.text.includes('/products/crochet-lily-bouquet-p1') && sm.text.includes('/cities/udaipur'), 'sitemap lists products + cities');
const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
ok(locs.length > 0 && locs.every(u => !u.includes('/api/') && !u.includes('?')), 'sitemap has no api or query urls');
const rb = await get('/robots.txt');
ok(rb.text.includes('Disallow: /api/') && rb.text.includes('Sitemap:'), 'robots.txt blocks /api and lists sitemap');
ok((await get('/manifest.webmanifest')).status === 200, 'manifest served');
ok((await get('/opengraph-image')).type.includes('image/png'), 'site OG image is png');
ok((await get('/api/health')).status === 200, 'api health still works');
ok((await get('/api/products')).status === 200, 'public products API is open');
for (const p of ['/api/orders', '/api/bookings', '/api/admin/summary']) ok((await get(p)).status === 401, `${p} → 401 without session`);
for (const p of ['/api/orders', '/api/bookings']) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  ok(r.status === 401, `POST ${p} → 401 without session`);
}
ok((await get('/api/auth/providers')).text.includes('google'), 'google provider configured');
for (const [m, p] of [['POST', '/api/products'], ['PATCH', '/api/products/p1'], ['DELETE', '/api/products/p1'], ['POST', '/api/workshops'], ['PATCH', '/api/workshops/w1'], ['DELETE', '/api/workshops/w1']]) {
  const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json' }, body: m === 'DELETE' ? undefined : '{}' });
  ok(r.status === 401, `${m} ${p} → 401 without session`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll SEO checks passed');
process.exit(failed ? 1 : 0);
