const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'db.json');
const PORT = Number(process.env.PORT || 3000);
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
function readDb() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function send(res, status, data) { res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'access-control-allow-origin':'*' }); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve, reject) => { let s=''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}); return res.end(); }
    if (url.pathname.startsWith('/api/')) {
      const db = readDb();
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok:true, service:'Rajasthan Creative Marketplace', timestamp:new Date().toISOString() });
      if (req.method === 'GET' && url.pathname === '/api/products') {
        const city = url.searchParams.get('city'); const q = (url.searchParams.get('q') || '').toLowerCase(); const category = url.searchParams.get('category');
        const products = db.products.filter(p => p.status === 'APPROVED' && (!city || city === 'All Rajasthan' || p.city === city) && (!category || category === 'All categories' || p.category === category) && (!q || `${p.name} ${p.description} ${p.seller} ${p.category}`.toLowerCase().includes(q)));
        return send(res, 200, products);
      }
      if (req.method === 'GET' && url.pathname === '/api/workshops') {
        const city = url.searchParams.get('city'); const type = url.searchParams.get('type'); const q = (url.searchParams.get('q') || '').toLowerCase();
        return send(res, 200, db.workshops.filter(w => w.status === 'APPROVED' && (!city || city === 'All Rajasthan' || w.city === city) && (!type || type === 'ALL' || w.type === type) && (!q || `${w.title} ${w.description} ${w.venue} ${w.host}`.toLowerCase().includes(q))));
      }
      if (req.method === 'POST' && url.pathname === '/api/orders') {
        const b = await body(req); if (!Array.isArray(b.items) || !b.items.length) return send(res, 400, { error:'Add at least one item.' });
        const items = b.items.map(i => { const p = db.products.find(p => p.id === i.productId && p.status === 'APPROVED'); const qty = Number(i.quantity); if (!p || !Number.isInteger(qty) || qty < 1 || qty > p.stock) throw new Error('A product is unavailable or quantity exceeds stock.'); return { productId:p.id, name:p.name, seller:p.seller, quantity:qty, unitPricePaise:p.pricePaise, lineTotalPaise:p.pricePaise * qty }; });
        const order = { id:crypto.randomUUID(), createdAt:new Date().toISOString(), customerName:String(b.customerName || 'Demo Customer').slice(0,100), email:String(b.email || '').slice(0,200), items, totalPaise:items.reduce((s,i)=>s+i.lineTotalPaise,0), status:'DEMO_ORDER_CREATED', note:'Demo only: no payment has been collected.' };
        for (const i of items) { const p = db.products.find(p => p.id === i.productId); p.stock -= i.quantity; }
        db.orders.push(order); writeDb(db); return send(res, 201, order);
      }
      if (req.method === 'POST' && url.pathname === '/api/bookings') {
        const b = await body(req); const w = db.workshops.find(w => w.id === b.workshopId && w.status === 'APPROVED'); const qty = Number(b.quantity || 1);
        if (!w) return send(res, 404, { error:'Workshop not found.' });
        if (!Number.isInteger(qty) || qty < 1 || qty > w.seats - w.booked) return send(res, 409, { error:'Not enough seats remaining.' });
        const booking = { id:crypto.randomUUID(), createdAt:new Date().toISOString(), workshopId:w.id, title:w.title, attendeeName:String(b.attendeeName || 'Demo Guest').slice(0,100), email:String(b.email || '').slice(0,200), quantity:qty, totalPaise:w.pricePaise*qty, status:w.type === 'FREE' ? 'CONFIRMED_FREE_DEMO' : 'DEMO_BOOKING_CREATED', note:w.type === 'FREE' ? 'Free demo booking confirmed; no payment required.' : 'Demo only: no payment has been collected.' };
        w.booked += qty; db.bookings.push(booking); writeDb(db); return send(res, 201, booking);
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/summary') return send(res, 200, { products:db.products.length, workshops:db.workshops.length, orders:db.orders.length, bookings:db.bookings.length, note:'Local demo summary; admin authentication is not implemented.' });
      return send(res, 404, { error:'API route not found.' });
    }
    let requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(ROOT, 'public', '.' + requested);
    if (!file.startsWith(path.resolve(ROOT, 'public') + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); return res.end('Not found'); } res.writeHead(200, {'content-type':MIME[path.extname(file)] || 'application/octet-stream'}); res.end(data); });
  } catch (e) { send(res, 400, { error:e.message || 'Request failed.' }); }
});
server.listen(PORT, () => console.log(`Rajasthan Creative Marketplace running at http://localhost:${PORT}`));
