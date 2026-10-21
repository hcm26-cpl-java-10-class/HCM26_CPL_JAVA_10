import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
function load(path, mocks) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => mocks[id], module, module.exports);
  return module.exports;
}
test('StudySession forwards combined filters, search, pagination and sorting; reset removes dates', () => {
  const calls = [];
  const { studySessionApi } = load('src/api/features/academic/study_session.api.ts', {
    '@/api/base-service.api': { createBaseApiService: () => ({ getPage: (...args) => calls.push(args) }) },
    '@/api/axios': { default: {} },
  });
  const pagination = { page: 2, size: 10, sort: ['title,desc', 'id,asc'] };
  const filter = { subjectId: 7, status: 'SCHEDULED', type: 'LAB', lecturer: 'Nguyen', room: 'A', title: 'Java', sessionDate: { from: '2026-10-01', to: '2026-10-31' } };
  studySessionApi.getPage(pagination, 'Java', filter);
  assert.deepEqual(calls[0], [pagination, 'Java', { subjectId: 7, status: 'SCHEDULED', type: 'LAB', lecturer: 'Nguyen', room: 'A', title: 'Java', sessionDateFrom: '2026-10-01', sessionDateTo: '2026-10-31' }]);
  assert.equal(filter.sessionDate.from, '2026-10-01');
  studySessionApi.getPage({ page: 0, size: 10 }, '', {});
  assert.deepEqual(calls[1][2], { sessionDateFrom: undefined, sessionDateTo: undefined });
  studySessionApi.getPage(pagination, '', { sessionDateFrom: '2026-10-01', sessionDateTo: '2026-10-31' });
  assert.deepEqual(calls.at(-1)[2], { sessionDateFrom: '2026-10-01', sessionDateTo: '2026-10-31' });
  for (const type of ['LAB', 'LECTURE']) {
    studySessionApi.getPage(pagination, '', { type });
    assert.equal(calls.at(-1)[2].type, type);
  }
});
test('StudySession filter and status schema preserves lifecycle restrictions', () => {
  const { entityConfig } = load('src/pages/management/academic/study_session/index.tsx', {
    '@/api': {}, './StudySessionDetailPage': {}, './StudySessionStatisticsPanel': {}, './validation': {}, '@/types': { auditableFieldsSchema: [] },
  });
  const fields = entityConfig.schema.fields;
  for (const name of ['subjectId', 'title', 'sessionDate', 'lecturer', 'room', 'status', 'type']) {
    assert.equal(fields.find(field => field.name === name).filterable, true);
  }
  const status = fields.find(field => field.name === 'status');
  assert.equal(status.editable, false);
  assert.deepEqual(status.options.map(option => option.value), ['SCHEDULED', 'COMPLETED', 'CANCELLED']);
});
