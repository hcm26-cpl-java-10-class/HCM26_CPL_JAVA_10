import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load(relativePath, mocks = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    if (!Object.hasOwn(mocks, id)) throw new Error(`Unexpected runtime import: ${id}`);
    return mocks[id];
  }, module, module.exports);
  return module.exports;
}

const identity = load('src/utils/subject-identity.utils.ts');
const { normalizeSubjectIdentity } = identity;

test('normalizes the code, surrounding spaces and optional numeric version prefix', () => {
  for (const input of [{ code: 'java_core', version: 'v1.0' }, { code: ' JAVA_CORE ', version: ' V1.0 ' }]) {
    assert.deepEqual(normalizeSubjectIdentity(input), { code: 'JAVA_CORE', version: '1.0' });
  }
});

test('preserves distinct versions and does not invent identity fields for partial updates', () => {
  assert.deepEqual(normalizeSubjectIdentity({ code: 'java_core', version: 'v2.0' }), { code: 'JAVA_CORE', version: '2.0' });
  assert.deepEqual(normalizeSubjectIdentity({ name: 'New name' }), { name: 'New name' });
  assert.deepEqual(normalizeSubjectIdentity({ version: 'vnext' }), { version: 'vnext' });
});

test('does not mutate form data', () => {
  const input = Object.freeze({ code: ' java_core ', version: 'V1.0', durationHours: 40 });
  const result = normalizeSubjectIdentity(input);
  assert.equal(input.code, ' java_core ');
  assert.equal(result.code, 'JAVA_CORE');
  assert.equal(result.durationHours, 40);
});

test('both create and update send normalized identity to the actual API delegates', async () => {
  const calls = [];
  const { subjectApi } = load('src/api/features/subject.api.ts', {
    '@/api/base-service.api': { createBaseApiService: () => ({
      create: async data => calls.push(['create', data]),
      update: async (id, data) => calls.push(['update', id, data]),
    }) },
    '../axios': { default: {} },
    '@/utils/subject-identity.utils': identity,
  });
  const data = { code: 'java_core', version: 'v1.0' };
  await subjectApi.create(data);
  await subjectApi.update('8', data);
  assert.deepEqual(calls, [
    ['create', { code: 'JAVA_CORE', version: '1.0' }],
    ['update', '8', { code: 'JAVA_CORE', version: '1.0' }],
  ]);
});
