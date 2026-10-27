const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OpenSerp } = require('../dist/nodes/OpenSerp/OpenSerp.node.js');

const search = { resource: 'search', operation: 'single', engine: 'google', text: 'test', limit: 10 };
const response = (body, statusCode = 200, headers = {}) => ({ body: typeof body === 'string' ? body : JSON.stringify(body), statusCode, headers });

function context(params, request, { credentials = { apiKey: 'osk_live_test' }, continueOnFail = false, count = 1 } = {}) {
  return {
    getInputData: () => Array.from({ length: count }, () => ({ json: {} })),
    getCredentials: async () => credentials,
    getNodeParameter: (key, _index, fallback) => params[key] ?? fallback,
    continueOnFail: () => continueOnFail,
    getNode: () => ({ name: 'OpenSERP', type: 'openSerp' }),
    helpers: { httpRequest: request },
  };
}

for (const credentials of [{ apiKey: 'osk_live_test' }, { baseUrl: 'http://openserp:7000///' }]) {
  for (const [resource, operation, path] of [
    ['search', 'single', '/google/search'], ['search', 'mega', '/mega/search'],
    ['image', 'single', '/google/image'], ['image', 'mega', '/mega/image'], ['extract', 'getContent', '/extract'],
  ]) {
    test(`${credentials.apiKey ? 'Cloud' : 'OSS'} ${resource}/${operation} keeps its route and authentication`, async () => {
      let calls = 0;
      await new OpenSerp().execute.call(context({ ...search, resource, operation, url: 'https://example.com', mode: 'fast', engines: ['google', 'bing'] }, async (options) => {
        calls++;
        const url = new URL(options.url);
        assert.equal(url.origin, credentials.apiKey ? 'https://api.openserp.org' : 'http://openserp:7000');
        assert.equal(url.pathname, `${credentials.apiKey ? '/v1' : ''}${path}`);
        assert.equal(url.searchParams.get('format'), 'json');
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Accept, 'application/json');
        assert.equal(options.headers.Authorization, credentials.apiKey ? 'Bearer osk_live_test' : undefined);
        assert.equal(options.headers['X-OpenSERP-Client'], 'n8n');
        assert.equal(options.ignoreHttpStatusErrors, true);
        assert.equal(options.returnFullResponse, true);
        if (operation === 'mega') assert.equal(url.searchParams.get('engines'), 'google,bing');
        return response({ results: [] });
      }, { credentials }));
      assert.equal(calls, 1);
    });
  }
}

test('search options retain zero offsets, false flags, and wire names', async () => {
  await new OpenSerp().execute.call(context({ ...search, region: 'US', lang: 'EN',
    additionalOptions: { start: 0, date: '20261001..20261028', file: 'pdf', site: 'example.com', filter: false, features: true },
    extractionOptions: { extract: true, extractTop: 3, extractMode: 'rendered', minRunes: 0 },
  }, async (options) => {
    const query = new URL(options.url).searchParams;
    for (const [key, value] of Object.entries({ start: '0', filter: 'false', features: 'true', region: 'US', lang: 'EN', date: '20261001..20261028', file: 'pdf', site: 'example.com', extract_mode: 'rendered', min_runes: '0' })) assert.equal(query.get(key), value, key);
    assert.equal(query.has('extractMode'), false);
    assert.equal(query.has('minRunes'), false);
    return response({ results: [] });
  }));
});

test('extraction retains false and zero options', async () => {
  await new OpenSerp().execute.call(context({ resource: 'extract', operation: 'getContent', url: 'https://example.com',
    extractOptions: { mode: 'fast', clean: false, useLlmsTxt: false, minRunes: 0, lang: 'en' },
  }, async (options) => {
    const query = new URL(options.url).searchParams;
    for (const [key, value] of Object.entries({ url: 'https://example.com', mode: 'fast', clean: 'false', use_llms_txt: 'false', min_runes: '0', lang: 'en' })) assert.equal(query.get(key), value);
    return response({ content: 'Example' });
  }));
});

test('fan-out keeps item links and public telemetry on the first result', async () => {
  const [items] = await new OpenSerp().execute.call(context(search, async () => response({ results: [{ title: 'First' }, { title: 'Second' }], meta: { engine_used: 'google' } }, 200, {
    'x-request-id': 'req_meta', 'x-credits-used': '2', 'x-credits-remaining': '98', 'x-engine-used': 'google', 'x-network-bytes': '500',
  }), { count: 2 }));
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((item) => item.pairedItem.item), [0, 0, 1, 1]);
  assert.deepEqual(items[0].json.openserp_meta, { response_meta: { engine_used: 'google' }, status: 200, request_id: 'req_meta', credits: { used: 2, remaining: 98 }, engine_used: 'google', network_bytes: 500 });
  assert.equal(items[1].json.openserp_meta, undefined);
});

test('empty results still emit an item', async () => {
  const [items] = await new OpenSerp().execute.call(context(search, async () => response({ results: [] })));
  assert.deepEqual(items, [{ json: { results: [], openserp_meta: { status: 200 } }, pairedItem: { item: 0 } }]);
});

for (const [resource, operation, path] of [['account', 'getMe', '/me'], ['account', 'pricing', '/pricing'], ['engines', 'capabilities', '/engines/capabilities'], ['engines', 'status', '/engines/status']]) {
  test(`${resource}/${operation} keeps its Cloud route and blocks OSS`, async () => {
    let calls = 0;
    const request = async (options) => { calls++; assert.equal(new URL(options.url).pathname, `/v1${path}`); return response({ engines: {} }); };
    const [items] = await new OpenSerp().execute.call(context({ resource, operation }, request));
    assert.deepEqual(items[0].json.engines, {});
    const [failures] = await new OpenSerp().execute.call(context({ resource, operation }, request, { credentials: {}, continueOnFail: true }));
    assert.match(failures[0].json.error, /only available against OpenSERP Cloud/);
    assert.equal(calls, 1);
  });
}

test('custom base URLs and timeouts are passed through', async () => {
  await new OpenSerp().execute.call(context(search, async (options) => {
    assert.equal(new URL(options.url).pathname, '/custom/v1/google/search');
    assert.equal(options.timeout, 1234);
    return response({ results: [] });
  }, { credentials: { apiKey: 'osk_live_test', baseUrl: 'https://example.com/custom/v1/', timeoutMs: 1234 } }));
});

for (const status of [400, 401, 402, 429, 503]) {
  test(`HTTP ${status} retains public error details without retrying`, async () => {
    let calls = 0;
    const [items] = await new OpenSerp().execute.call(context(search, async () => {
      calls++;
      return response({ error: 'engine_unavailable', message: 'Try later', retry_after: 30, request_id: 'req_body' }, status, { 'X-Request-Id': 'req_header', 'Retry-After': '60' });
    }, { continueOnFail: true }));
    assert.equal(items[0].json.status, status);
    assert.equal(items[0].json.code, 'engine_unavailable');
    assert.equal(items[0].json.request_id, 'req_body');
    assert.equal(items[0].json.retry_after, 60);
    assert.match(items[0].json.error, /Try later.*openserp.org\/docs/);
    assert.equal(calls, 1);
  });
}

test('retry delay falls back to the body when the header is invalid', async () => {
  const [items] = await new OpenSerp().execute.call(context(search, async () => response({ error: 'engine_unavailable', retry_after: 60 }, 503, { 'Retry-After': '-1', 'X-Request-Id': 'req_error' }), { continueOnFail: true }));
  assert.equal(items[0].json.request_id, 'req_error');
  assert.equal(items[0].json.retry_after, 60);
});

test('HTTP errors stop execution unless Continue On Fail is enabled', async () => {
  await assert.rejects(new OpenSerp().execute.call(context(search, async () => response({ error: 'unauthorized', message: 'Check your API key' }, 401))), /Check your API key/);
});

test('timeouts preserve request_timeout without retrying', async () => {
  let calls = 0;
  const [items] = await new OpenSerp().execute.call(context(search, async () => { calls++; throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); }, { continueOnFail: true }));
  assert.equal(items[0].json.code, 'request_timeout');
  assert.equal(items[0].json.status, 0);
  assert.match(items[0].json.error, /30000ms/);
  assert.equal(calls, 1);
});

test('Continue On Fail processes subsequent inputs and keeps pairing', async () => {
  let calls = 0;
  const [items] = await new OpenSerp().execute.call(context(search, async () => ++calls === 1 ? response('Unavailable', 503) : response({ results: [{ title: 'Recovered' }] }), { continueOnFail: true, count: 2 }));
  assert.equal(items[0].json.status, 503);
  assert.equal(items[1].json.title, 'Recovered');
  assert.deepEqual(items.map((item) => item.pairedItem.item), [0, 1]);
});

const supportsBatch = new OpenSerp().description.properties.some((property) => property.name === 'operation' && property.options?.some((option) => option.value === 'getContentBatch'));
test('batch extraction preserves POST payloads and Cloud/OSS envelopes', { skip: !supportsBatch }, async () => {
  for (const oss of [false, true]) {
    const [items] = await new OpenSerp().execute.call(context({ resource: 'extract', operation: 'getContentBatch', urls: 'https://example.com\nhttps://example.org', extractOptions: { clean: false, useLlmsTxt: true, minRunes: 0, mode: 'fast', region: 'DE' } }, async (options) => {
      assert.equal(new URL(options.url).pathname, `${oss ? '' : '/v1'}/extract/batch`);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Accept, 'application/json');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), { urls: ['https://example.com', 'https://example.org'], clean: false, use_llms_txt: true, min_runes: 0, mode: 'fast', region: 'DE' });
      return response(oss ? [{ content: 'Page', metadata: { source: 'https://example.com' } }, { metadata: { source: 'https://example.org', error: 'unavailable' } }] : { results: [{ url: 'https://example.com', content: 'Page' }, { url: 'https://example.org', error: 'unavailable' }], meta: { requested: 2, succeeded: 1, failed: 1 } });
    }, { credentials: oss ? { baseUrl: 'http://openserp:7000' } : { apiKey: 'osk_live_test' } }));
    assert.equal(items[0].json.url, 'https://example.com');
    assert.equal(items[1].json.error, 'unavailable');
    assert.deepEqual(items[0].json.openserp_meta.response_meta, { requested: 2, succeeded: 1, failed: 1 });
  }
});
