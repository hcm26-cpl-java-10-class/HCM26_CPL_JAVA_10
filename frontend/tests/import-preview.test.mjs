import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function setup(report, failure, editing = {}) {
  const state = [];
  let cursor = 0;
  const imports = [], previews = [], closes = [];
  const jsx = (type, props) => ({ type, props });
  const ui = names => Object.fromEntries(names.map(name => [name, name]));
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: initial => {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    } },
    axios: { isAxiosError: error => error?.isAxiosError === true },
    'lucide-react': ui(['ArrowLeft', 'CheckCircle2', 'ChevronLeft', 'ChevronRight', 'FileSpreadsheet', 'Loader2', 'RefreshCw', 'Upload', 'XCircle']),
    '@/components/ui/badge': ui(['Badge']),
    '@/components/ui/button': ui(['Button']),
    '@/components/ui/input': ui(['Input']),
    '@/components/ui/dialog': ui(['Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle']),
    '@/components/ui/tabs': ui(['Tabs']),
    './ImportTab': ui(['ImportTab']),
  };
  const source = readFileSync(new URL('../src/components/datatable/dataio/ImportPreviewDialog.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!Object.hasOwn(mocks, name)) throw new Error('Unexpected import ' + name);
    return mocks[name];
  }, module, module.exports);
  const render = () => {
    cursor = 0;
    return module.exports.ImportPreviewDialog({
      title: 'Import Session', entityName: 'session', loading: false,
      onOpenChange: open => closes.push(open),
      onImport: async file => { imports.push(file); },
      onPreview: async file => { previews.push(file); if (failure) throw failure; return report; },
      ...editing,
    });
  };
  return { render, imports, previews, closes };
}
function nodes(node) {
  if (node == null || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return [node.props?.children].flat(Infinity).map(text).join('');
}
const find = (tree, type) => nodes(tree).find(node => node.type === type);
const button = (tree, label) => nodes(tree).find(node => node.type === 'Button' && text(node).includes(label));
const valid = {
  totalRows: 1, validRows: 1, invalidRows: 0, canImport: true, columns: ['Class ID'],
  rows: [{ rowNumber: 2, values: { 'Class ID': '1' }, valid: true, errors: [] }],
};

test('preview reads the selected file without importing; confirmation imports that same file', async () => {
  const screen = setup(valid);
  const file = new File(['data'], 'sessions.csv');
  let tree = screen.render();
  assert.equal(find(tree, 'ImportTab').props.previewRequired, true);
  find(tree, 'ImportTab').props.onFileChange(file);
  await find(tree, 'ImportTab').props.onPreview(file);
  tree = screen.render();
  assert.deepEqual(screen.previews, [file]);
  assert.deepEqual(screen.imports, []);
  assert.ok(text(tree).includes('Nothing has been saved yet.'));
  const confirm = button(tree, 'Import 1 session');
  assert.equal(confirm.props.disabled, false);
  await confirm.props.onClick();
  assert.deepEqual(screen.imports, [file]);
});

test('invalid preview identifies original row and prevents confirmation', async () => {
  const screen = setup({ ...valid, validRows: 0, invalidRows: 1, canImport: false,
    rows: [{ rowNumber: 4, values: { 'Class ID': '1.5' }, valid: false, errors: ['Class ID: Expected a whole number'] }] });
  await find(screen.render(), 'ImportTab').props.onPreview(new File(['bad'], 'bad.csv'));
  const tree = screen.render();
  assert.ok(text(tree).includes('#4'));
  assert.ok(text(tree).includes('Class ID: Expected a whole number'));
  assert.equal(button(tree, 'Import 1 session').props.disabled, true);
  await button(tree, 'Import 1 session').props.onClick();
  assert.deepEqual(screen.imports, []);
});

test('changing the source file discards an earlier valid preview', async () => {
  const screen = setup(valid);
  await find(screen.render(), 'ImportTab').props.onPreview(new File(['old'], 'old.csv'));
  button(screen.render(), 'Back to import').props.onClick();
  find(screen.render(), 'ImportTab').props.onFileChange(new File(['new'], 'new.csv'));
  assert.equal(button(screen.render(), 'Import 1 session'), undefined);
  assert.deepEqual(screen.imports, []);
});

test('preview request failure shows the server message and keeps the dialog open', async () => {
  const screen = setup(valid, { isAxiosError: true, response: { data: { message: 'Reference service unavailable' } } });
  await assert.rejects(find(screen.render(), 'ImportTab').props.onPreview(new File(['data'], 'sessions.csv')), {message: 'Reference service unavailable'});
  assert.equal(nodes(screen.render()).filter(node => node.props?.role === 'alert').length, 0, 'Upload tab displays the normalized error once');
  assert.deepEqual(screen.imports, []);
  assert.deepEqual(screen.closes, []);
});
const cell = (tree, column, rowNumber) => nodes(tree).find(node => node.type === 'Input' && node.props['aria-label'] === `${column}, row ${rowNumber}`);
const click = async node => { await node.props.onClick(); await new Promise(resolve => setImmediate(resolve)); };
const missingTopic = { ...valid, validRows: 0, invalidRows: 1, canImport: false, columns: ['Class ID', 'Topic ID'],
  rows: [{rowNumber: 4, values: {'Class ID': '1', 'Topic ID': ''}, valid: false, errors: ['Missing: Topic ID']}] };

test('corrected cells are rechecked as JSON and only the checked values are imported', async () => {
  const checks = [], saved = [];
  const screen = setup(missingTopic, undefined, {
    onPreviewRows: async rows => {
      checks.push(structuredClone(rows));
      return {...missingTopic, validRows: 1, invalidRows: 0, canImport: true,
        rows: rows.map(row => ({...row, values: {...row.values, 'Topic ID': '1'}, valid: true, errors: []}))};
    },
    onImportRows: async rows => {saved.push(structuredClone(rows)); return {successCount: 1, failureCount: 0, errors: []};},
  });
  await find(screen.render(), 'ImportTab').props.onPreview(new File(['data'], 'sessions.csv'));
  cell(screen.render(), 'Topic ID', 4).props.onChange({target: {value: '1.0'}});
  let tree = screen.render();
  assert.ok(text(tree).includes('recheck required'));
  assert.equal(button(tree, 'Import 1 session').props.disabled, true);
  await click(button(tree, 'Import 1 session'));
  assert.deepEqual(saved, []);
  await click(button(screen.render(), 'Recheck'));
  assert.equal(checks[0][0].rowNumber, 4);
  assert.equal(checks[0][0].values['Topic ID'], '1.0');
  tree = screen.render();
  assert.equal(cell(tree, 'Topic ID', 4).props.value, '1');
  assert.equal(button(tree, 'Import 1 session').props.disabled, false);
  await click(button(tree, 'Import 1 session'));
  assert.equal(saved[0][0].values['Topic ID'], '1');
  assert.equal(saved[0][0].rowNumber, 4);
  assert.deepEqual(screen.imports, []);
});

test('editing a previously valid row disables import until the new value is checked', async () => {
  const saved = [];
  const screen = setup(valid, undefined, {onPreviewRows: async () => valid,
    onImportRows: async rows => {saved.push(rows); return {successCount: 1, failureCount: 0, errors: []};}});
  await find(screen.render(), 'ImportTab').props.onPreview(new File(['data'], 'sessions.csv'));
  cell(screen.render(), 'Class ID', 2).props.onChange({target: {value: '0'}});
  assert.equal(button(screen.render(), 'Import 1 session').props.disabled, true);
  await click(button(screen.render(), 'Import 1 session'));
  assert.deepEqual(saved, []);
});

test('recheck failure retains typed cells and prevents saving stale validation', async () => {
  const screen = setup(valid, undefined, {onPreviewRows: async () => {throw new Error('Server unavailable');},
    onImportRows: async () => ({successCount: 1, failureCount: 0, errors: []})});
  await find(screen.render(), 'ImportTab').props.onPreview(new File(['data'], 'sessions.csv'));
  cell(screen.render(), 'Class ID', 2).props.onChange({target: {value: '2'}});
  await click(button(screen.render(), 'Recheck'));
  assert.equal(cell(screen.render(), 'Class ID', 2).props.value, '2');
  assert.ok(text(screen.render()).includes('Server unavailable'));
  assert.equal(button(screen.render(), 'Import 1 session').props.disabled, true);
});

test('back to upload and preview preserves edits instead of rereading the original file', async () => {
  const screen = setup(valid, undefined, {onPreviewRows: async () => valid,
    onImportRows: async () => ({successCount: 1, failureCount: 0, errors: []})});
  const file = new File(['original'], 'sessions.csv');
  await find(screen.render(), 'ImportTab').props.onPreview(file);
  cell(screen.render(), 'Class ID', 2).props.onChange({target: {value: '2'}});
  await click(button(screen.render(), 'Back to import'));
  await find(screen.render(), 'ImportTab').props.onPreview(file);
  assert.equal(cell(screen.render(), 'Class ID', 2).props.value, '2');
  assert.equal(screen.previews.length, 1);
  assert.equal(button(screen.render(), 'Import 1 session').props.disabled, true);
});

test('a conflict at final save keeps the edited preview and shows new row errors', async () => {
  const screen = setup(valid, undefined, {
    onPreviewRows: async rows => ({...valid, validRows: 0, invalidRows: 1, canImport: false,
      rows: rows.map(row => ({...row, valid: false, errors: ['Class is already booked']}))}),
    onImportRows: async () => ({successCount: 0, failureCount: 1, errors: [{rowNumber: 2, message: 'Class is already booked'}]}),
  });
  await find(screen.render(), 'ImportTab').props.onPreview(new File(['data'], 'sessions.csv'));
  await click(button(screen.render(), 'Import 1 session'));
  assert.ok(text(screen.render()).includes('Class is already booked'));
  assert.equal(cell(screen.render(), 'Class ID', 2).props.value, '1');
  assert.equal(button(screen.render(), 'Import 1 session').props.disabled, true);
  assert.deepEqual(screen.closes, []);
});
