import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import axios from 'axios';
import ts from 'typescript';

const jsx = (type, props, key) => ({type, props, key});
const settle = () => new Promise(resolve => setImmediate(resolve));
function load(relativePath, mocks) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!Object.hasOwn(mocks, name)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return [node.props?.children].flat(Infinity).map(text).join('');
}
const find = (tree, type) => nodes(tree).find(node => node.type === type);
const button = (tree, label) => nodes(tree).find(node => node.type === 'Button' && text(node) === label);
const stored = {id: 37, classId: 11, topicId: 22, trainerId: 33, teachingAssignmentId: null, roomId: 7,
  title: 'Stored session', status: 'SCHEDULED', note: 'Existing lesson note', startTime: '2026-11-02T08:00:00', endTime: '2026-11-02T10:00:00'};
function setup(options = {}) {
  const session = {...stored, ...options.session};
  const sessions = new Map([['37', session], ...Object.entries(options.sessions ?? {})]);
  const calls = {requests: [], success: [], error: [], cache: [], invalidations: []};
  let slots = [], currentId = '37', mountedKey;
  let cursor = 0;
  const mocks = {
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
    react: {
      useState(initial) {
        const index = cursor++;
        const owner = slots;
        if (!Object.hasOwn(owner, index)) owner[index] = initial;
        return [owner[index], value => {owner[index] = value;}];
      },
      useRef(initial) {
        const index = cursor++;
        if (!Object.hasOwn(slots, index)) slots[index] = {current: initial};
        return slots[index];
      },
    },
    '@tanstack/react-query': {
      useQuery: ({queryKey}) => ({data: sessions.get(queryKey[2]), isPending: false, isError: false}),
      useQueryClient: () => ({
        setQueryData(key, value) {calls.cache.push({key, value}); Object.assign(sessions.get(key[2]), value);},
        async invalidateQueries(query) {calls.invalidations.push(query); if (options.invalidate) return options.invalidate(query);},
      }),
      useMutation(configuration) {
        const index = cursor++;
        if (!Object.hasOwn(slots, index)) slots[index] = {isPending: false, isError: false, error: null};
        const state = slots[index];
        return {...state,
          reset() {state.isError = false; state.error = null;},
          mutate(variables) {
            state.isPending = true; state.isError = false; state.error = null;
            Promise.resolve().then(() => configuration.mutationFn(variables)).then(result => configuration.onSuccess?.(result, variables)).catch(error => {
              state.isError = true; state.error = error; configuration.onError?.(error);
            }).finally(() => {state.isPending = false; configuration.onSettled?.();});
          },
        };
      },
    },
    axios: {isAxiosError: value => value?.isAxiosError === true},
    'react-router-dom': {Link: 'Link', useParams: () => ({id: currentId})},
    'lucide-react': {ArrowLeft: 'ArrowLeft', CheckCheck: 'CheckCheck', LoaderCircle: 'LoaderCircle', PenSquare: 'PenSquare'},
    sonner: {toast: {success: message => calls.success.push(message), error: message => calls.error.push(message)}},
    '@/api/features/demo/session.api': {sessionApi: {
      getById: async id => sessions.get(id),
      completeSession: async (id, payload) => {
        calls.requests.push({id, payload: structuredClone(payload)});
        return options.complete ? options.complete(id, payload) : {...sessions.get(id), ...payload, status: 'COMPLETED'};
      },
    }},
    '@/hooks/usePermissions': {usePermissions: () => ({hasPermission: permission => permission === 'SESSION_UPDATE' && options.permission !== false})},
    '@/components/layout/MainLayout': {MainLayout: 'MainLayout'},
  };
  for (const [file, names] of Object.entries({alert: ['Alert', 'AlertDescription'], badge: ['Badge'], button: ['Button'],
    card: ['Card', 'CardContent', 'CardHeader', 'CardTitle'], dialog: ['Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle'],
    label: ['Label'], textarea: ['Textarea']})) mocks[`@/components/ui/${file}`] = Object.fromEntries(names.map(name => [name, name]));
  const {SessionDetailPage} = load('src/pages/management/demo/session/SessionDetailPage.tsx', mocks);
  function render() {
    const child = SessionDetailPage();
    if (child.key !== mountedKey) {slots = []; mountedKey = child.key;}
    cursor = 0;
    return child.type(child.props);
  }
  function open() {button(render(), 'Complete').props.onClick();}
  function edit(note) {find(render(), 'Textarea').props.onChange({target: {value: note}});}
  async function submit() {find(render(), 'form').props.onSubmit({preventDefault() {}}); await settle();}
  return {render, open, edit, submit, calls, session, setRoute: id => {currentId = id;}, getSession: id => sessions.get(id)};
}

test('only scheduled sessions with SESSION_UPDATE expose the Complete button', () => {
  assert.ok(button(setup().render(), 'Complete'));
  for (const status of ['CANCELLED', 'COMPLETED']) assert.equal(button(setup({session: {status}}).render(), 'Complete'), undefined);
  assert.equal(button(setup({permission: false}).render(), 'Complete'), undefined);
});

test('opening Complete preserves the existing note and Cancel closes without a request', () => {
  const screen = setup(); screen.open();
  assert.equal(find(screen.render(), 'Dialog').props.open, true);
  assert.equal(find(screen.render(), 'Textarea').props.value, stored.note);
  screen.edit('Unsubmitted draft'); button(screen.render(), 'Cancel').props.onClick();
  assert.equal(find(screen.render(), 'Dialog').props.open, false);
  assert.equal(screen.calls.requests.length, 0);
  screen.open(); assert.equal(find(screen.render(), 'Textarea').props.value, stored.note);
});

test('successful completion saves only the note, shows COMPLETED and refreshes list/detail queries', async () => {
  const screen = setup(); screen.open(); screen.edit('  Lesson completed\nFollow up next week.  '); await screen.submit();
  assert.deepEqual(screen.calls.requests, [{id: '37', payload: {note: '  Lesson completed\nFollow up next week.  '}}]);
  assert.equal(screen.calls.success.length, 1); assert.equal(screen.calls.error.length, 0);
  assert.equal(find(screen.render(), 'Dialog').props.open, false);
  assert.ok(text(screen.render()).includes('COMPLETED'));
  assert.ok(text(screen.render()).includes('Follow up next week.'));
  assert.equal(button(screen.render(), 'Complete'), undefined);
  assert.deepEqual(screen.calls.cache[0].key, ['session', 'detail', '37']);
  assert.deepEqual(screen.calls.invalidations, [{queryKey: ['session']}]);
  for (const field of ['classId', 'topicId', 'trainerId', 'teachingAssignmentId', 'roomId']) assert.equal(screen.session[field], stored[field]);
  assert.ok(text(setup({session: screen.session}).render()).includes('Follow up next week.'));
});

for (const status of [403, 404, 409]) test(`API ${status} retains the draft and never shows success`, async () => {
  const message = `Server rejected completion (${status})`;
  const screen = setup({complete: async () => {throw {isAxiosError: true, response: {status, data: {message}}};}});
  screen.open(); screen.edit('Keep my draft'); await screen.submit();
  assert.equal(screen.calls.success.length, 0); assert.deepEqual(screen.calls.error, [message]);
  assert.equal(screen.calls.cache.length, 0); assert.equal(screen.calls.invalidations.length, 0);
  assert.equal(find(screen.render(), 'Dialog').props.open, true);
  assert.equal(find(screen.render(), 'Textarea').props.value, 'Keep my draft');
  assert.ok(text(screen.render()).includes(message));
  assert.ok(text(screen.render()).includes('SCHEDULED'));
});

test('field validation and network failures show real errors without a success toast', async () => {
  for (const error of [{isAxiosError: true, response: {data: {message: 'Validation failed', errors: {note: ['Note rejected by server']}}}}, {isAxiosError: true}]) {
    const screen = setup({complete: async () => {throw error;}}); screen.open(); await screen.submit();
    assert.equal(screen.calls.success.length, 0); assert.equal(screen.calls.error.length, 1);
    assert.ok(text(screen.render()).includes(error.response ? 'Note rejected by server' : 'Unable to complete this session. Please try again.'));
  }
});

test('a pending completion blocks repeated submits, note edits and modal dismissal', async () => {
  let resolve;
  const screen = setup({complete: () => new Promise(done => {resolve = done;})}); screen.open();
  const beforeSubmit = screen.render();
  const submit = find(beforeSubmit, 'form').props.onSubmit;
  submit({preventDefault() {}}); submit({preventDefault() {}});
  button(beforeSubmit, 'Cancel').props.onClick();
  assert.equal(find(screen.render(), 'Dialog').props.open, true);
  await settle();
  assert.equal(screen.calls.requests.length, 1);
  const tree = screen.render();
  assert.equal(button(tree, 'Cancel').props.disabled, true); assert.equal(button(tree, 'Completing...').props.disabled, true);
  assert.equal(find(tree, 'Textarea').props.disabled, true);
  find(tree, 'Dialog').props.onOpenChange(false); assert.equal(find(screen.render(), 'Dialog').props.open, true);
  let prevented = false; find(tree, 'DialogContent').props.onEscapeKeyDown({preventDefault() {prevented = true;}}); assert.equal(prevented, true);
  resolve({...stored, status: 'COMPLETED'}); await settle();
  assert.equal(screen.calls.success.length, 1);
});

test('a refresh failure after a committed completion does not report the completion request as failed', async () => {
  const screen = setup({invalidate: async () => {throw new Error('Offline');}}); screen.open(); await screen.submit();
  assert.equal(screen.calls.success.length, 1);
  assert.ok(screen.calls.error[0].startsWith('Session completed, but refreshing'));
  assert.equal(find(screen.render(), 'Dialog').props.open, false);
  assert.ok(text(screen.render()).includes('COMPLETED'));
});

test('navigating to another session resets the open modal and never submits the previous session note', async () => {
  const screen = setup({sessions: {'38': {...stored, id: 38, title: 'Another session', note: 'Second session note'}}});
  screen.open(); screen.edit('Unsaved note for session 37');
  screen.setRoute('38');
  assert.equal(find(screen.render(), 'Dialog').props.open, false);
  assert.ok(text(screen.render()).includes('Another session'));
  screen.open(); assert.equal(find(screen.render(), 'Textarea').props.value, 'Second session note');
  await screen.submit();
  assert.deepEqual(screen.calls.requests, [{id: '38', payload: {note: 'Second session note'}}]);
  assert.equal(screen.getSession('37').status, 'SCHEDULED');
  assert.equal(screen.getSession('37').note, stored.note);
});

test('an earlier session completion resolving after navigation updates only its own cache and modal', async () => {
  let resolve;
  const screen = setup({sessions: {'38': {...stored, id: 38, title: 'Another session', note: 'Second session note'}},
    complete: () => new Promise(done => {resolve = done;})});
  screen.open(); screen.edit('Saved note for session 37'); await screen.submit();
  screen.setRoute('38'); screen.open(); screen.edit('Unsubmitted session 38 note');
  assert.equal(find(screen.render(), 'Dialog').props.open, true);
  resolve({...stored, status: 'COMPLETED', note: 'Saved note for session 37'}); await settle();
  assert.deepEqual(screen.calls.requests, [{id: '37', payload: {note: 'Saved note for session 37'}}]);
  assert.deepEqual(screen.calls.cache.map(entry => entry.key), [['session', 'detail', '37']]);
  assert.equal(screen.getSession('37').status, 'COMPLETED');
  assert.equal(screen.getSession('38').status, 'SCHEDULED');
  assert.equal(screen.getSession('38').note, 'Second session note');
  assert.equal(find(screen.render(), 'Dialog').props.open, true);
  assert.equal(find(screen.render(), 'Textarea').props.value, 'Unsubmitted session 38 note');
});

test('completeSession sends PATCH JSON and propagates rejected HTTP statuses', async context => {
  const received = [];
  let status = 200;
  const server = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    received.push({method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString('utf8')});
    response.writeHead(status, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(status === 200 ? {...stored, note: 'Saved note', status: 'COMPLETED'} : {message: 'Rejected'}));
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  context.after(() => new Promise(resolve => server.close(resolve)));
  const client = axios.create({baseURL: `http://127.0.0.1:${server.address().port}`, proxy: false, timeout: 5000});
  const {sessionApi} = load('src/api/features/demo/session.api.ts', {
    '@/api/base-service.api': {createBaseApiService: () => ({})}, '@/api/axios': {default: client},
  });
  const result = await sessionApi.completeSession(37, {note: 'Saved note'});
  assert.equal(result.status, 'COMPLETED'); assert.equal(result.note, 'Saved note');
  assert.equal(received[0].method, 'PATCH'); assert.equal(received[0].url, '/sessions/37/complete');
  assert.match(received[0].headers['content-type'], /^application\/json/);
  assert.deepEqual(JSON.parse(received[0].body), {note: 'Saved note'});
  for (status of [403, 404, 409]) await assert.rejects(sessionApi.completeSession(37, {note: ''}), error => error.response?.status === status);
});
