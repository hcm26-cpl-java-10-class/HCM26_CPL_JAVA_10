import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import axios from 'axios';
import ts from 'typescript';

function load(relativePath, mocks = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', compiled)((id) => {
    if (!Object.hasOwn(mocks, id)) throw new Error(`Unexpected runtime import: ${id}`);
    return mocks[id];
  }, module, module.exports);
  return module.exports;
}

async function fixture(context) {
  const received = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({url: request.url, headers: request.headers, body: Buffer.concat(chunks)});
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(request.url.endsWith('/import/rows')
      ? {successCount: 1, failureCount: 0, errors: []}
      : {totalRows: 1, validRows: 1, invalidRows: 0, rows: []}));
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const client = axios.create({baseURL: `http://127.0.0.1:${server.address().port}`, headers: {'Content-Type': 'application/json'}, proxy: false, timeout: 5000});
  const {subjectApi} = load('src/api/features/subject.api.ts', {
    '@/api/base-service.api': {createBaseApiService: () => ({})},
    '../axios': {default: client},
    '@/utils/subject-identity.utils': load('src/utils/subject-identity.utils.ts'),
    '@/utils/subject-query.utils': load('src/utils/subject-query.utils.ts'),
  });
  return {subjectApi, client, received};
}

test('file preview reaches HTTP as multipart with the original filename and bytes', async (context) => {
  const {subjectApi, client, received} = await fixture(context);
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x10, 0x20]);
  const result = await subjectApi.previewImport(new File([bytes], 'subjects.xlsx', {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  assert.equal(result.validRows, 1);
  const request = received[0];
  assert.equal(request.url, '/subjects/import/preview');
  assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/i);
  const boundary = request.headers['content-type'].split('boundary=')[1].replace(/^"|"$/g, '');
  assert.ok(request.body.includes(Buffer.from(`--${boundary}\r\n`)));
  assert.ok(request.body.includes(Buffer.from('name="file"; filename="subjects.xlsx"')));
  assert.ok(request.body.includes(bytes));
  assert.ok(request.body.includes(Buffer.from(`--${boundary}--`)));
  assert.equal(client.defaults.headers['Content-Type'], 'application/json');
});

test('edited-row recheck still sends JSON after a file preview', async (context) => {
  const {subjectApi, received} = await fixture(context);
  await subjectApi.previewImport(new File(['Code,Name,Version,Hours\nSAMPLE,Sample,1.0,8'], 'subjects.csv', {type: 'text/csv'}));
  const rows = [{rowNumber: 2, values: {Code: 'SAMPLE', Name: 'Sample', Version: '1.0', Hours: '8'}}];
  await subjectApi.previewImportRows(rows);
  const request = received[1];
  assert.equal(request.url, '/subjects/import/preview-rows');
  assert.match(request.headers['content-type'], /^application\/json/i);
  assert.deepEqual(JSON.parse(request.body.toString('utf8')), {rows});
});

test('saving corrected rows uses JSON with every corrected cell preserved', async (context) => {
  const {subjectApi, received} = await fixture(context);
  const rows = [{rowNumber: 9, values: {Code: 'SAMPLE', Hours: '12', Outline: 'Corrected outline'}}];
  const result = await subjectApi.importRows(rows);
  assert.equal(result.successCount, 1);
  assert.equal(received[0].url, '/subjects/import/rows');
  assert.match(received[0].headers['content-type'], /^application\/json/i);
  assert.deepEqual(JSON.parse(received[0].body.toString('utf8')), {rows});
});
