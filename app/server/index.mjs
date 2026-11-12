import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import Busboy from 'busboy';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const dataDir = path.resolve(process.env.DATA_DIR || './data');
await mkdir(dataDir, { recursive: true });
const filePath = path.join(dataDir, 'orders.json');
let orders = {};
try { orders = JSON.parse(await readFile(filePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const save = async () => {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(orders, null, 2));
  await rename(temporary, filePath);
};
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const same = (a, b) => {
  if (!a || !b) return false;
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const publicOrder = order => ({ id: order.id, title: order.title, status: order.status, total: order.total,
  config: order.config, scenario: order.scenario,
  createdAt: order.createdAt, photos: order.photos.map(({ name }) => name), messages: order.messages });
const readBody = async req => {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 64_000) throw new Error('Request too large'); }
  return JSON.parse(body);
};
const receiveOrder = async req => {
  const uploadDir = path.join(dataDir, 'uploads', randomUUID());
  await mkdir(uploadDir, { recursive: true });
  const photos = []; const writes = []; let metadata; let uploadError;
  try {
    const parser = Busboy({ headers: req.headers, limits: { files: 100, fileSize: 30 * 1024 * 1024, fields: 1 } });
    parser.on('filesLimit', () => { uploadError = new Error('Too many photos'); });
    parser.on('field', (name, value) => { if (name === 'order') metadata = JSON.parse(value); });
    parser.on('file', (name, stream, info) => {
      if (name !== 'photo' || !/^image\/(jpeg|png|webp|heic|heif)$/.test(info.mimeType)) {
        stream.resume(); uploadError = new Error('Unsupported image'); return;
      }
      const filename = `${randomUUID()}.${info.mimeType.split('/')[1]}`;
      photos.push({ name: info.filename.slice(0, 120), file: path.join(uploadDir, filename), mime: info.mimeType });
      writes.push(pipeline(stream, createWriteStream(path.join(uploadDir, filename))).then(() => {
        if (stream.truncated) throw new Error('Image too large');
      }));
    });
    await new Promise((resolve, reject) => { parser.on('close', resolve); parser.on('error', reject); req.pipe(parser); });
    await Promise.all(writes);
    if (uploadError) throw uploadError;
    if (!metadata || !metadata.idempotencyKey || !metadata.title || !metadata.config || !photos.length)
      throw new Error('Order details and photos are required');
    return { metadata, photos, uploadDir };
  } catch (error) { await rm(uploadDir, { recursive: true, force: true }); throw error; }
};
const adminDir = path.join(import.meta.dirname, 'admin');
const adminAssets = {
  '/admin/': ['index.html', 'text/html; charset=utf-8'],
  '/admin/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/admin/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, X-Order-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  try {
    if (url.pathname === '/admin' && req.method === 'GET') {
      res.writeHead(302, { Location: '/admin/' }); res.end(); return;
    }
    if (req.method === 'GET' && adminAssets[url.pathname]) {
      const [file, contentType] = adminAssets[url.pathname];
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      res.end(await readFile(path.join(adminDir, file)));
      return;
    }
    if (req.method === 'GET' && /^\/admin\/photos\/[1-6]\.jpg$/.test(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
      res.end(await readFile(path.join(adminDir, 'photos', path.basename(url.pathname))));
      return;
    }
    if (url.pathname === '/api/orders' && req.method === 'POST') {
      const { metadata, photos, uploadDir } = await receiveOrder(req);
      const prior = Object.values(orders).find(o => o.idempotencyKey === metadata.idempotencyKey);
      if (prior) { await rm(uploadDir, { recursive:true, force:true }); json(res, 200, { ...publicOrder(prior), token:prior.token }); return; }
      const id = randomUUID(); const token = randomUUID();
      const order = { id, token, idempotencyKey:metadata.idempotencyKey, title:metadata.title,
        config:metadata.config, scenario:metadata.scenario, total:metadata.total, delivery:metadata.delivery,
        payment:metadata.payment, createdAt:new Date().toISOString(), status:'accepted', photos, messages:[] };
      orders[id] = order; await save(); json(res, 201, { ...publicOrder(order), token }); return;
    }
    if (url.pathname === '/api/admin/orders' && req.method === 'GET') {
      return json(res, 200, Object.values(orders).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicOrder));
    }
    const match = url.pathname.match(/^\/api\/(admin\/)?orders\/([^/]+)(?:\/(messages|photos)(?:\/(\d+))?)?$/);
    if (!match) return json(res, 404, { error:'Not found' });
    const [, admin, id, resource, index] = match;
    const order = orders[id];
    if (!order) return json(res, 404, { error:'Order not found' });
    if (!admin && !same(req.headers['x-order-token'], order.token))
      return json(res, 401, { error:'Unauthorized' });
    if (resource === 'photos' && admin && req.method === 'GET') {
      const photo = order.photos[Number(index)]; if (!photo) return json(res,404,{error:'Photo not found'});
      res.writeHead(200, {'Content-Type':photo.mime}); res.end(await readFile(photo.file)); return;
    }
    if (resource === 'messages' && req.method === 'POST') {
      const body = await readBody(req); const text = String(body.text || '').trim().slice(0, 2000);
      if (!text) return json(res, 400, { error:'Message is empty' });
      order.messages.push({ id:randomUUID(), from:admin ? 'admin':'customer', text, at:new Date().toISOString() });
      await save(); return json(res, 201, publicOrder(order));
    }
    if (admin && !resource && req.method === 'PATCH') {
      const body = await readBody(req);
      if (!['accepted','printing','ready','shipping','delivered'].includes(body.status)) return json(res,400,{error:'Invalid status'});
      order.status = body.status; await save(); return json(res,200,publicOrder(order));
    }
    if (!admin && !resource && req.method === 'GET') return json(res,200,publicOrder(order));
    return json(res,404,{error:'Not found'});
  } catch (error) { json(res, 400, { error:error.message }); }
}).listen(port, host, () => console.log(`PicPac API on http://${host}:${port}`));
