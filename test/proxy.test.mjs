import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHandler, readConfig, validateImage } from '../server/proxy.mjs';

const config = { apiKey: 'test-provider-secret', model: 'configured-vision-model', token: 'a'.repeat(64), origin: 'https://jammydav.github.io', maxRequests: 20 };
// Minimal marker fixture for validation tests; provider calls are mocked, never billable.
function image(width = 640, height = 480) {
  const bytes = Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,0,0,0,0,1,1,0x11,0,0xff,0xd9]);
  bytes.writeUInt16BE(height, 7); bytes.writeUInt16BE(width, 9);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}
async function setup(t, overrides = {}, fetcher = async () => ({ ok: true,
  json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'A cup.' }] }] }) })) {
  const server = http.createServer(createHandler({ ...config, ...overrides }, { fetcher }));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => { server.close(done); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/recognize`;
  return (body = { image: image() }, headers = {}, method = 'POST') => fetch(url, {
    method, headers: { Origin: config.origin, Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', ...headers },
    body: ['OPTIONS', 'GET'].includes(method) ? undefined : JSON.stringify(body)
  });
}

test('proxy configuration fails closed and requires a separate access token', () => {
  assert.throws(() => readConfig({}), /Missing/);
  const env = { OPENAI_API_KEY: 'key', OPENAI_MODEL: 'model', VISION_ACCESS_TOKEN: config.token, ALLOWED_ORIGIN: config.origin };
  assert.equal(readConfig(env).origin, config.origin);
  assert.throws(() => readConfig({ ...env, ALLOWED_ORIGIN: config.origin + '/Vision/' }), /origin/);
  assert.throws(() => readConfig({ ...env, VISION_ACCESS_TOKEN: 'sk-' + 'a'.repeat(64) }), /separate/);
});

test('proxy rejects disallowed origins, missing authentication and unsupported requests without provider calls', async t => {
  let calls = 0;
  const request = await setup(t, {}, async () => { calls++; throw new Error('must not call'); });
  assert.equal((await request({}, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request({}, { Authorization: '' })).status, 401);
  assert.equal((await request({}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request({}, {}, 'GET')).status, 405);
  assert.equal((await request({ image: 'https://attacker.example/image' })).status, 400);
  assert.equal(calls, 0);
});

test('preflight allows exact origin without requiring credentials', async t => {
  const request = await setup(t);
  const response = await request({}, { Authorization: '' }, 'OPTIONS');
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), config.origin);
  assert.equal(response.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
});

test('JPEG validation rejects wrong types, oversized dimensions and extra fields', () => {
  assert.equal(validateImage({ image: image() }), image());
  assert.throws(() => validateImage({ image: image(769) }), /dimensions/);
  assert.throws(() => validateImage({ image: image(), model: 'override' }), /Expected/);
  assert.throws(() => validateImage({ image: 'data:image/jpeg;base64,AAAA' }), /JPEG/);
});

test('proxy keeps provider key on server and uses one non-stored image request', async t => {
  let calls = 0;
  const request = await setup(t, { maxRequests: 1 }, async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.headers.Authorization, `Bearer ${config.apiKey}`);
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.model, config.model);
    assert.equal(body.input[0].content[1].type, 'input_image');
    assert.equal(body.max_output_tokens, 300);
    return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'A cup.' }] }] }) };
  });
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { description: 'A cup.' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await request()).status, 429);
  assert.equal(calls, 1);
});

test('proxy hides upstream errors and enforces a six request per minute limit', async t => {
  const request = await setup(t, {}, async () => { throw new Error('secret-provider-diagnostics'); });
  for (let i = 0; i < 6; i++) {
    const response = await request();
    assert.equal(response.status, 502);
    assert(!JSON.stringify(await response.json()).includes('secret'));
  }
  assert.equal((await request()).status, 429);
});

test('proxy accepts only one in-flight provider call', async t => {
  let release, began;
  const started = new Promise(done => { began = done; });
  const request = await setup(t, {}, async () => {
    began();
    await new Promise(done => { release = done; });
    return { ok: false };
  });
  const first = request();
  await started;
  try { assert.equal((await request()).status, 429); }
  finally { release(); }
  assert.equal((await first).status, 502);
});
