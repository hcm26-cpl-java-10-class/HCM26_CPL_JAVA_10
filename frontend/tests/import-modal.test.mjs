import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Exercise the actual modal handler with lightweight UI adapters.
function setup(importFile) {
  const notifications = [];
  const results = [];
  const closes = [];
  const loading = [];
  const source = readFileSync(new URL('../src/components/datatable/dataio/ImportModal.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react': { useState: () => [false, value => loading.push(value)] },
    'axios': { isAxiosError: error => error?.isAxiosError === true },
    'sonner': { toast: Object.fromEntries(['success', 'warning', 'error'].map(type =>
      [type, message => notifications.push({ type, message })])) },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/tabs': { Tabs: 'Tabs' },
    '@/components/ui/dialog': Object.fromEntries([
      'Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle',
    ].map(name => [name, name])),
    './ImportTab': { ImportTab: 'ImportTab' },
    './ImportPreviewDialog': { ImportPreviewDialog: 'ImportPreviewDialog' },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    if (!Object.hasOwn(mocks, id)) throw new Error(`Unexpected import: ${id}`);
    return mocks[id];
  }, module, module.exports);
  const tree = module.exports.ImportModal({
    open: true, onOpenChange: value => closes.push(value),
    table: { schema: { entityName: 'subject' }, importFile },
    onImportSuccess: result => results.push(result),
  });
  function find(node) {
    if (node?.type === 'ImportTab') return node;
    for (const child of [node?.props?.children].flat().filter(Boolean)) {
      const match = find(child);
      if (match) return match;
    }
  }
  return { onImport: find(tree).props.onImport, notifications, results, closes, loading };
}

for (const [successCount, failureCount, type] of [[2, 0, 'success'], [1, 1, 'warning'], [0, 2, 'error']]) {
  test(`reports ${successCount} successful and ${failureCount} failed rows as ${type}`, async () => {
    const result = { successCount, failureCount, errors: failureCount ? [{ rowNumber: 2, message: 'Duplicate subject' }] : [] };
    const modal = setup(async () => result);
    await modal.onImport({ name: 'subjects.csv' });
    assert.deepEqual(modal.results, [result]);
    assert.deepEqual(modal.closes, [false]);
    assert.deepEqual(modal.loading, [true, false]);
    assert.equal(modal.notifications.length, 1);
    assert.equal(modal.notifications[0].type, type);
    assert.ok(modal.notifications[0].message.includes(`${successCount} row(s)`));
    if (failureCount) assert.ok(modal.notifications[0].message.includes(`${failureCount} row(s) failed`));
  });
}

test('request failure keeps the import dialog open and does not treat an error body as row results', async () => {
  const error = { isAxiosError: true, response: { status: 400, data: { message: 'Invalid import file' } } };
  const modal = setup(async () => { throw error; });
  await assert.rejects(modal.onImport({ name: 'subjects.csv' }), failure => failure === error);
  assert.deepEqual(modal.results, []);
  assert.deepEqual(modal.closes, []);
  assert.deepEqual(modal.loading, [true, false]);
  assert.deepEqual(modal.notifications, [{ type: 'error', message: 'Invalid import file' }]);
});
