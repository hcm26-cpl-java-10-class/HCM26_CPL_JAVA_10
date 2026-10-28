import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const directory = '../src/pages/management/schedule-validation/';
const jsx = (type, props) => ({ type, props });
const axios = { isAxiosError: value => value?.isAxiosError === true };
function load(filename, mocks) {
  const source = readFileSync(new URL(directory + filename, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!Object.hasOwn(mocks, name)) throw new Error('Unexpected import: ' + name);
    return typeof mocks[name] === 'function' ? mocks[name]() : mocks[name];
  }, module, module.exports);
  return module.exports;
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
const button = (tree, label) => nodes(tree).find(node => node.type === 'Button' && text(node) === label);
const settle = () => new Promise(resolve => setImmediate(resolve));
const noSuccess = tree => {
  assert.equal(nodes(tree).some(node => node.type === 'ScheduleIssues' && node.props.result.valid), false,
    'an earlier successful schedule check must not imply a failed save succeeded');
  assert.equal(text(tree).includes('Session saved successfully.'), false);
};
const businessFailure = (errors = {teachingAssignmentId: ['The teaching assignment no longer exists.']}, message = 'Validation failed') => ({
  isAxiosError: true, message: 'Request failed with status code 400', response: {status: 400, data: {message, errors}},
});
const valid = {valid: true, timezone: 'Asia/Ho_Chi_Minh', issues: []};
const stored = {
  id: 37, classId: 1, topicId: 1, trainerId: 1, teachingAssignmentId: null,
  roomId: 1, location: 'A101', meetingUrl: null, title: 'Imported Session 37',
  startTime: '2026-11-02T08:00:00', endTime: '2026-11-02T10:00:00',
  isActive: false, status: 'SCHEDULED', note: 'Keep the imported note',
};
const resources = {
  references: {
    classes: [{id: 1, code: 'JAVA-01', name: 'Java 01', startDate: '2026-01-01', endDate: '2027-12-31', status: 'ACTIVE'}],
    trainers: [{id: 1, name: 'Instructor 1', status: 'ACTIVE'}],
    rooms: [{id: 1, name: 'A101'}],
    assignments: [{id: 1, classId: 1, topicId: 1, trainerId: 1, effectiveFrom: '2026-01-01', effectiveTo: '2027-12-31', status: 'ACTIVE'}],
    holidays: [],
  },
  rules: {timezone: 'Asia/Ho_Chi_Minh', openingTime: '07:00', closingTime: '22:00', workingDays: [1,2,3,4,5,6,7], maxBatchSize: 200},
};
function setup(options = {}) {
  const session = {...stored, ...options.session};
  const id = Object.hasOwn(options, 'id') ? options.id : '37';
  const calls = {checks: [], updates: [], creates: [], invalidations: []};
  const slots = [];
  let cursor = 0, dirty = false, effects = [];
  const queryCache = {invalidateQueries: async query => {calls.invalidations.push(query); if (options.invalidate) return options.invalidate(query);}};
  const mocks = {
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
    react: {
      useState: initial => {
        const index = cursor++;
        if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => {
          const next = typeof value === 'function' ? value(slots[index]) : value;
          if (!Object.is(next, slots[index])) {slots[index] = next; dirty = true;}
        }];
      },
      useEffect: (callback, deps) => {
        const index = cursor++, previous = slots[index];
        if (!previous || !deps || deps.some((value, n) => !Object.is(value, previous[n]))) {
          slots[index] = deps; effects.push(callback);
        }
      },
    },
    '@tanstack/react-query': {
      useQuery: ({queryKey}) => ({data: queryKey[0] === 'session' ? id ? session : undefined : resources, isPending: false, isError: false, refetch: async () => {}}),
      useQueryClient: () => queryCache,
    },
    'react-router-dom': {Link: 'Link', useParams: () => ({id})},
    axios,
    '@/components/layout/MainLayout': {MainLayout: 'MainLayout'},
    '@/components/ui/button': {Button: 'Button'},
    '@/hooks/usePermissions': {usePermissions: () => ({hasPermission: () => true})},
    '@/api/features/demo/session.api': {sessionApi: {
      getById: async () => session,
      update: async (target, payload) => {calls.updates.push({target, payload: structuredClone(payload)}); return options.update ? options.update(target, payload) : {...session, ...payload};},
      create: async payload => {calls.creates.push(structuredClone(payload)); return options.create ? options.create(payload) : {id: 38, ...payload};},
    }},
    '@/api/features/schedule-check.api': {scheduleValidationApi: {
      resources: async () => resources,
      validate: async candidates => {calls.checks.push(structuredClone(candidates)); return options.check ? options.check(candidates) : structuredClone(valid);},
    }},
    './ScheduleCandidateForm': {ScheduleCandidateForm: 'ScheduleCandidateForm'},
    './ScheduleIssues': {ScheduleIssues: 'ScheduleIssues'},
    './session-editor-errors': () => load('session-editor-errors.ts', {axios}),
  };
  const component = load('SessionScheduleEditor.tsx', mocks).SessionScheduleEditor;
  function render() {
    let tree;
    for (let pass = 0; pass < 10; pass++) {
      cursor = 0; effects = []; dirty = false; tree = component();
      effects.forEach(effect => effect());
      if (!dirty) return tree;
    }
    throw new Error('Editor did not settle after effects');
  }
  async function submit() {find(render(), 'form').props.onSubmit({preventDefault() {}}); await settle();}
  async function validate() {await button(render(), 'Validate').props.onClick(); await settle();}
  function realForm() {
    const props = find(render(), 'ScheduleCandidateForm').props;
    return load('ScheduleCandidateForm.tsx', {
      'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
      '@/components/ui/input': {Input: 'Input'},
    }).ScheduleCandidateForm(props);
  }
  return {render, submit, validate, calls, realForm};
}

test('editing a legacy Session preserves its null assignment instead of injecting a matching demo reference', () => {
  const screen = setup();
  const value = find(screen.render(), 'ScheduleCandidateForm').props.value;
  assert.equal(value.classId, 1); assert.equal(value.topicId, 1); assert.equal(value.trainerId, 1);
  assert.equal(value.teachingAssignmentId, null);
  const form = screen.realForm();
  const select = nodes(form).find(node => node.type === 'select' && node.props.id === 'session-assignment');
  assert.notEqual(select.props.value, '', 'the legacy session must remain submittable without selecting a fake assignment');
  assert.notEqual(select.props.value, 1);
  assert.ok(nodes(select).some(node => node.type === 'option' && node.props.value === select.props.value), 'the selected legacy value must have a visible option');
});

test('an unchanged update keeps the existing link, imported note, active flag and local ISO datetimes', async () => {
  const screen = setup(); await screen.submit();
  assert.equal(screen.calls.updates.length, 1);
  const {target, payload} = screen.calls.updates[0];
  assert.equal(target, '37'); assert.equal(screen.calls.checks[0][0].id, 37);
  assert.equal(Object.hasOwn(payload, 'id'), false, 'the update URL supplies identity; no conflicting body ID');
  assert.equal(payload.teachingAssignmentId, null); assert.equal(payload.note, stored.note);
  assert.equal(payload.isActive, false); assert.equal(payload.startTime, stored.startTime); assert.equal(payload.endTime, stored.endTime);
  assert.equal(Object.hasOwn(payload, 'revision'), false);
  for (const field of ['status','cancelReason','createdAt','updatedAt','createdBy','updatedBy']) assert.equal(Object.hasOwn(payload, field), false, field);
  assert.deepEqual(screen.calls.checks[0].map(row => row.teachingAssignmentId), [null]);
});

test('a saved explicit assignment absent from the demo catalogue is not silently cleared or replaced', async () => {
  const screen = setup({session: {teachingAssignmentId: 8726}});
  assert.equal(find(screen.render(), 'ScheduleCandidateForm').props.value.teachingAssignmentId, 8726);
  await screen.submit();
  assert.equal(screen.calls.updates[0].payload.teachingAssignmentId, 8726);
});

test('a valid schedule followed by a 400 save shows the field error without a green validation or save result', async () => {
  const screen = setup({update: async () => {throw businessFailure();}});
  await screen.submit(); const tree = screen.render();
  assert.ok(text(tree).includes('The teaching assignment no longer exists.'));
  assert.ok(nodes(tree).some(node => node.props?.role === 'alert'));
  noSuccess(tree);
  assert.equal(screen.calls.invalidations.length, 0);
});

test('a pending save does not display its preliminary successful schedule check as a final green result', async () => {
  let reject;
  const screen = setup({update: () => new Promise((resolve, fail) => {reject = fail;})});
  await screen.submit();
  assert.equal(typeof reject, 'function'); noSuccess(screen.render());
  reject(businessFailure()); await settle();
  noSuccess(screen.render());
  assert.ok(text(screen.render()).includes('The teaching assignment no longer exists.'));
});

test('all backend field-error messages and a specific backend summary survive a failed update', async () => {
  const errors = {title: ['Title is too long', 'Title cannot contain only spaces'], meetingUrl: ['Use an absolute HTTPS URL'], isActive: ['Active status is required']};
  const screen = setup({update: async () => {throw businessFailure(errors, 'The session could not be updated.');}});
  await screen.submit(); const tree = screen.render();
  for (const messages of Object.values(errors)) for (const message of messages) assert.ok(text(tree).includes(message), message);
  assert.ok(text(tree).includes('The session could not be updated.'));
  noSuccess(tree);
});

test('a network failure during save removes the preceding green validation and retains the user draft', async () => {
  const screen = setup({update: async () => {throw {isAxiosError: true, message: 'Network Error'};}});
  const draft = {...find(screen.render(), 'ScheduleCandidateForm').props.value, title: 'Keep this edit'};
  find(screen.render(), 'ScheduleCandidateForm').props.onChange(draft);
  await screen.submit(); const tree = screen.render();
  noSuccess(tree); assert.ok(nodes(tree).some(node => node.props?.role === 'alert'));
  assert.equal(find(tree, 'ScheduleCandidateForm').props.value.title, 'Keep this edit');
});

test('a scheduling conflict discovered at save displays the current invalid result and never an old valid result', async () => {
  const conflict = {valid: false, timezone: valid.timezone, issues: [{code: 'ROOM_CONFLICT', field: 'roomId', message: 'Room was booked after preview.', candidateIndex: 0, relatedCandidateIndex: null, relatedSessionId: 42, relatedTitle: 'Other session', relatedStart: stored.startTime, relatedEnd: stored.endTime}]};
  const screen = setup({update: async () => {throw {isAxiosError: true, response: {status: 409, data: conflict}};}});
  await screen.submit(); const tree = screen.render(); noSuccess(tree);
  assert.deepEqual(find(tree, 'ScheduleIssues').props.result.issues, conflict.issues);
  assert.equal(find(tree, 'ScheduleIssues').props.result.valid, false);
});

test('validate-only can show a successful check without calling save or claiming persistence', async () => {
  const screen = setup(); await screen.validate(); const tree = screen.render();
  assert.equal(find(tree, 'ScheduleIssues').props.result.valid, true);
  assert.equal(screen.calls.updates.length, 0); assert.equal(screen.calls.creates.length, 0);
  assert.equal(text(tree).includes('Session saved successfully.'), false);
});

test('an invalid schedule stops before the update endpoint is called', async () => {
  const invalid = {valid: false, timezone: valid.timezone, issues: [{code: 'WORKING_HOURS', field: 'startTime', message: 'Outside working hours', candidateIndex: 0, relatedCandidateIndex: null, relatedSessionId: null, relatedTitle: null, relatedStart: null, relatedEnd: null}]};
  const screen = setup({check: async () => invalid}); await screen.submit();
  assert.equal(screen.calls.updates.length, 0); assert.equal(screen.calls.creates.length, 0);
  assert.equal(find(screen.render(), 'ScheduleIssues').props.result.valid, false);
});

test('successful save is the only operation that shows the persisted-success message', async () => {
  const screen = setup(); await screen.submit(); const tree = screen.render();
  assert.ok(text(tree).includes('Session saved successfully.')); assert.equal(screen.calls.updates.length, 1);
  assert.equal(nodes(tree).some(node => node.props?.role === 'alert'), false);
  assert.equal(screen.calls.invalidations.length, 1);
});

test('editing clears stale validation and backend field errors while retaining the correction', async () => {
  const screen = setup({update: async () => {throw businessFailure();}});
  await screen.validate(); assert.equal(find(screen.render(), 'ScheduleIssues').props.result.valid, true);
  const first = find(screen.render(), 'ScheduleCandidateForm'); first.props.onChange({...first.props.value, title: 'First correction'});
  noSuccess(screen.render());
  await screen.submit(); assert.ok(text(screen.render()).includes('The teaching assignment no longer exists.'));
  const form = find(screen.render(), 'ScheduleCandidateForm'); form.props.onChange({...form.props.value, title: 'Second correction'});
  const tree = screen.render();
  assert.equal(text(tree).includes('The teaching assignment no longer exists.'), false);
  assert.equal(nodes(tree).some(node => node.props?.role === 'alert'), false);
  noSuccess(tree); assert.equal(find(tree, 'ScheduleCandidateForm').props.value.title, 'Second correction');
});

test('a new session does not get a legacy no-assignment option or a fabricated initial assignment', () => {
  const screen = setup({id: undefined});
  assert.equal(find(screen.render(), 'ScheduleCandidateForm').props.value.teachingAssignmentId == null, true);
  const select = nodes(screen.realForm()).find(node => node.type === 'select' && node.props.id === 'session-assignment');
  assert.equal(select.props.value, '');
});


test('choosing the existing unlinked session restores its original class, Topic and trainer without assigning a demo ID', () => {
  const screen = setup({session: {classId: 11, topicId: 22, trainerId: 33}});
  const initial = nodes(screen.realForm()).find(node => node.type === 'select' && node.props.id === 'session-assignment');
  const legacyValue = initial.props.value;
  assert.notEqual(legacyValue, '');
  initial.props.onChange({target: {value: '1'}});
  assert.equal(find(screen.render(), 'ScheduleCandidateForm').props.value.teachingAssignmentId, 1);
  const changed = nodes(screen.realForm()).find(node => node.type === 'select' && node.props.id === 'session-assignment');
  changed.props.onChange({target: {value: legacyValue}});
  const restored = find(screen.render(), 'ScheduleCandidateForm').props.value;
  assert.equal(restored.classId, 11); assert.equal(restored.topicId, 22); assert.equal(restored.trainerId, 33);
  assert.equal(restored.teachingAssignmentId, null);
});

test('an unavailable persisted assignment is represented in the select without clearing the saved identity', () => {
  const screen = setup({session: {teachingAssignmentId: 8726}});
  const select = nodes(screen.realForm()).find(node => node.type === 'select' && node.props.id === 'session-assignment');
  assert.equal(select.props.value, 8726);
  assert.ok(nodes(select).some(node => node.type === 'option' && node.props.value === 8726));
  select.props.onChange({target: {value: '8726'}});
  assert.equal(find(screen.render(), 'ScheduleCandidateForm').props.value.teachingAssignmentId, 8726);
});


test('a refresh failure after a committed save does not turn it into a false save-failed message', async () => {
  const screen = setup({invalidate: async () => {throw new Error('List refresh unavailable');}});
  await screen.submit(); await settle();
  const tree = screen.render();
  assert.ok(text(tree).includes('Session saved successfully.'));
  assert.equal(nodes(tree).some(node => node.props?.role === 'alert'), false);
  assert.equal(screen.calls.updates.length, 1);
});
