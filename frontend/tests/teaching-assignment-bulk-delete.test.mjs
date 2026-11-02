import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteSelectedAssignments } from '../src/pages/management/teaching-assignment/assignment-bulk-delete.ts';

const row = (id, revision) => ({ id, revision, classCode: `CLASS_${id}`, subjectCode: 'JAVA' });

test('deletes only selected assignments with their own revisions and waits for each request', async () => {
  const calls = [], progress = [];
  let active = 0;
  const result = await deleteSelectedAssignments([row(2, 4), row(8, 9)], async (id, revision) => {
    active++;
    assert.equal(active, 1);
    await Promise.resolve();
    calls.push([id, revision]);
    active--;
  }, (completed) => progress.push(completed));
  assert.deepEqual(calls, [[2, 4], [8, 9]]);
  assert.deepEqual(result, { deletedIds: [2, 8], failures: [] });
  assert.deepEqual(progress, [1, 2]);
});

test('keeps rejected or stale assignments as failures while continuing with the rest', async () => {
  const usedBySession = new Error('This assignment has session history.');
  const result = await deleteSelectedAssignments([row(1, 0), row(2, 3), row(3, 1)], async (id) => {
    if (id === 2) throw usedBySession;
  });
  assert.deepEqual(result.deletedIds, [1, 3]);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].assignment.id, 2);
  assert.equal(result.failures[0].error, usedBySession);
});

test('does not send invalid revision values or unselected rows for deletion', async () => {
  const calls = [];
  const result = await deleteSelectedAssignments([row(1, undefined), row(2, -1), row(3, 0)], async (id) => calls.push(id));
  assert.deepEqual(calls, [3]);
  assert.deepEqual(result.deletedIds, [3]);
  assert.equal(result.failures.length, 2);
  assert.deepEqual(await deleteSelectedAssignments([], async () => assert.fail('Unexpected request')), { deletedIds: [], failures: [] });
});
