const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OpenSerp } = require('../dist/nodes/OpenSerp/OpenSerp.node.js');

function context(params, continueOnFail = false) {
  return {
    getInputData: () => [{ json: {} }],
    getCredentials: async () => ({ apiKey: 'osk_live_test' }),
    getNodeParameter: (key, _index, fallback) => params[key] ?? fallback,
    continueOnFail: () => continueOnFail,
    getNode: () => ({ name: 'OpenSERP', type: 'openSerp' }),
  };
}

test('Cloud paging survives result fan-out without optional engine arrays', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/v1/mega/search');
    assert.equal(url.searchParams.get('start'), '10');
    assert.equal(url.searchParams.get('mode'), 'any');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer osk_live_test');
    return Response.json({
      meta: { engine_used: 'bing' },
      results: [{ title: 'Page 2', url: 'https://example.com' }],
      pagination: { page: 2, has_more: true, next_start: 20 },
    }, { headers: { 'X-Engine-Used': 'bing', 'X-Request-Id': 'req_n8n' } });
  };
  const [items] = await new OpenSerp().execute.call(context({
    resource: 'search', operation: 'mega', text: 'test', limit: 10, mode: 'any',
    additionalOptions: { start: 10 }, engines: ['google', 'bing'],
  }));
  assert.equal(items[0].json.openserp_meta.pagination.next_start, 20);
  assert.equal(items[0].json.openserp_meta.engine_used, 'bing');
  assert.equal(items[0].json.openserp_meta.response_meta.engines_tried, undefined);
});

test('Continue On Fail preserves public error details and retry delay', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({
    error: 'engine_unavailable', code: 503, retry_after: 60,
  }, { status: 503, headers: { 'X-Request-Id': 'req_error', 'Retry-After': '60' } });
  const [items] = await new OpenSerp().execute.call(context({
    resource: 'search', operation: 'single', engine: 'google', text: 'test', limit: 10,
  }, true));
  assert.equal(items[0].json.status, 503);
  assert.equal(items[0].json.code, 'engine_unavailable');
  assert.equal(items[0].json.request_id, 'req_error');
  assert.equal(items[0].json.retry_after, 60);
});

test('engine status preserves the public engine map', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const engines of [{}, { google: { status: 'operational' } }]) {
    globalThis.fetch = async () => Response.json({ engines });
    const [items] = await new OpenSerp().execute.call(context({ resource: 'engines', operation: 'status' }));
    assert.deepEqual(items[0].json.engines, engines);
  }
});
