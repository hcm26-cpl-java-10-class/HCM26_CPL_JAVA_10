import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import axios from 'axios';
import ts from 'typescript';

for (const extension of ['xlsx', 'csv']) {
  test(`assignment ${extension} import sends multipart with original file bytes`, async (context) => {
    const received = [];
    const server = http.createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      received.push({ url: request.url, headers: request.headers, body: Buffer.concat(chunks) });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ successCount: 1, failureCount: 0, errors: [] }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    context.after(() => new Promise((resolve) => server.close(resolve)));
    const client = axios.create({
      baseURL: `http://127.0.0.1:${server.address().port}`,
      headers: { 'Content-Type': 'application/json' }, proxy: false, timeout: 5000,
    });
    const source = readFileSync(new URL('../src/api/features/class-setup.api.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)((id) => {
      if (id === '../axios') return { default: client };
      if (id === '@/components/datatable/util/dataio.utils') return {};
      throw new Error(`Unexpected import: ${id}`);
    }, module, module.exports);
    const bytes = extension === 'xlsx' ? Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff]) : Buffer.from('Class,Trainer\nJava,Trainer');
    const result = await module.exports.classSetupApi.importAssignments(new File([bytes], `assignments.${extension}`));
    assert.equal(result.successCount, 1);
    const request = received[0];
    assert.equal(request.url, '/teaching-assignments/import');
    assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/i);
    const boundary = request.headers['content-type'].split('boundary=')[1].replace(/^"|"$/g, '');
    assert.ok(request.body.includes(Buffer.from(`--${boundary}\r\n`)));
    assert.ok(request.body.includes(Buffer.from(`name="file"; filename="assignments.${extension}"`)));
    assert.ok(request.body.includes(bytes));
    assert.equal(client.defaults.headers['Content-Type'], 'application/json');
  });
}
