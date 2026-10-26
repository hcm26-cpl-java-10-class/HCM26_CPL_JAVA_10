import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load(path, mocks) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => mocks[id], module, module.exports);
  return module.exports;
}

test('export forwards selected format, filters, search and sorting without mutating date range', async () => {
  const calls = [];
  const { studySessionApi } = load('src/api/features/academic/study_session.api.ts', {
    '@/api/base-service.api': { createBaseApiService: () => ({}) },
    '@/api/axios': { default: { get: (...args) => { calls.push(args); return Promise.resolve({}); } } },
  });
  const filter = { subjectId: 7, status: 'SCHEDULED', sessionDate: { from: '2026-10-01', to: '2026-10-31' } };
  for (const format of ['EXCEL', 'CSV', 'PDF']) {
    await studySessionApi.export(format, 'Java', filter, ['sessionDate,asc']);
    const [path, options] = calls.at(-1);
    assert.equal(path, '/study-sessions/export');
    assert.deepEqual(options.params, { format, search: 'Java', subjectId: 7, status: 'SCHEDULED',
      sessionDateFrom: '2026-10-01', sessionDateTo: '2026-10-31', sort: ['sessionDate,asc'] });
    assert.equal(options.responseType, 'blob');
  }
  assert.equal(filter.sessionDate.from, '2026-10-01');
});

test('StudySession declares all supported export formats', () => {
  const { entityConfig } = load('src/pages/management/academic/study_session/index.tsx', {
    '@/api': {}, './StudySessionDetailPage': {}, './StudySessionStatisticsPanel': {},
    './validation': {}, '@/types': { auditableFieldsSchema: [] },
  });
  assert.deepEqual(entityConfig.schema.exportFormats, ['EXCEL', 'CSV', 'PDF']);
});
