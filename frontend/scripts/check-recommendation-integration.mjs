import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Server-render real providers and the enrollment hook; no computer/browser control.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".recommendation-check.mjs");
const storage = new Map();
const memoryStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) };
globalThis.localStorage = memoryStorage;
globalThis.sessionStorage = {};
try {
  const compiled = await build({
    stdin: { contents: `
      export { createElement } from 'react';
      export { renderToString } from 'react-dom/server';
      export { Provider } from 'react-redux';
      export { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      export { AuthProvider } from '@/contexts/AuthContext';
      export { RoleSwitchProvider } from '@/contexts/RoleSwitchContext';
      export { usePermissions } from '@/hooks/usePermissions';
      export { useCourseEnrollment } from '@/pages/management/demo/course/hooks/useCourseEnrollment';
      export { CourseRecommendations } from '@/pages/management/demo/course/components/CourseRecommendations';
      export { MemoryRouter } from 'react-router-dom';
      export { recommendationsApi } from '@/api/features/recommendations.api';
      export { store } from '@/store/store';
      export { setLogin, setLogout } from '@/store/slices/auth/authSlice';
      export { default as api } from '@/api/axios';
    `, resolveDir: root, loader: "tsx" },
    bundle: true, platform: "node", format: "esm", write: false, jsx: "automatic",
    alias: { "@": path.join(root,"src") },
    define: { "import.meta.env.VITE_API_URL": '"http://test.invalid/api"' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  await writeFile(output, compiled.outputFiles[0].text);
  const m = await import(pathToFileURL(output).href);
  const requests = [];
  m.api.defaults.adapter = async config => { requests.push(config); return { data: { id: 12, courseId: 123 }, status: 200, statusText: "OK", headers: {}, config }; };
  const permissions = ["COURSE_READ","ENROLLMENT_CREATE","ENROLLMENT_READ","ENROLLMENT_DELETE"];
  let captured, effective;
  const client = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Probe() { captured = m.useCourseEnrollment(); effective = m.usePermissions(); return null; }
  function render() { m.renderToString(m.createElement(m.Provider,{store:m.store},m.createElement(m.AuthProvider,null,m.createElement(m.RoleSwitchProvider,null,m.createElement(m.QueryClientProvider,{client},m.createElement(Probe)))))); }
  function renderRecommendations(search = "") { return m.renderToString(m.createElement(m.Provider,{store:m.store},m.createElement(m.AuthProvider,null,m.createElement(m.RoleSwitchProvider,null,m.createElement(m.QueryClientProvider,{client},m.createElement(m.MemoryRouter,null,m.createElement(m.CourseRecommendations,{search}))))))); }
  m.store.dispatch(m.setLogin({ token:"test-token", email:"student@example.com", role:"STUDENT", roles:["STUDENT"], permissions, rolePermissions:{STUDENT:permissions} }));
  render(); assert.equal(captured.canEnroll,true); assert.equal(effective.activeRole,"STUDENT");
  for (const key of [["my-enrollments","student@example.com"],["course-catalog","student@example.com"],["course-detail",123],["course-recommendations","student@example.com"]]) client.setQueryData(key,[]);
  await captured.enrollMutation.mutateAsync(123);
  assert.equal(requests[0].url,"/enrollments");assert.deepEqual(JSON.parse(requests[0].data),{courseId:123});
  assert.equal(client.getQueryState(["course-recommendations","student@example.com"]).isInvalidated,true);
  assert.equal(client.getQueryState(["course-catalog","student@example.com"]).isInvalidated,true);
  const controller = new AbortController();
  await m.recommendationsApi.ask("shorter courses",[{role:"user",content:"Java beginner"}],"en",controller.signal);
  const chat = requests.at(-1);const body = JSON.parse(chat.data);
  assert.equal(body.message,"shorter courses");assert.equal(body.history.length,1);assert.equal(chat.timeout,30000);assert.equal(chat.signal,controller.signal);
  await m.recommendationsApi.save({goals:"Learn Java",interests:["Java"]},controller.signal);
  assert.equal(requests.at(-1).url,"/course-recommendations/preferences");assert.equal(requests.at(-1).method,"put");
  await m.recommendationsApi.reset(controller.signal);assert.equal(requests.at(-1).method,"delete");
  await m.recommendationsApi.dismiss(123,controller.signal);assert.equal(requests.at(-1).url,"/course-recommendations/dismiss/123");
  const fixture = { recommendations:[{course:{id:123,name:"<script>untrusted</script>",description:"Backend programming",instructor:"Alex Teacher",categoryName:"Java",level:"BEGINNER",lessonCount:3,totalDuration:300,isFree:true,enrolled:false,averageRating:4,totalReviews:10},reason:"An introductory option to explore."}], preferences:{goals:"",interests:[]}, state:"READY" };
  client.setQueryData(["course-recommendations","student@example.com"],fixture);
  const markup=renderRecommendations();
  assert.ok(markup.includes("Recommended for you"));assert.ok(markup.includes("Ask AI to help me choose"));
  assert.ok(markup.includes('href="/courses/123"'));assert.ok(markup.includes("&lt;script&gt;"));assert.ok(!markup.includes("<script>"));
  for (const keyword of ["UNTRUSTED", " backend ", "Alex"]) assert.ok(renderRecommendations(keyword).includes('href="/courses/123"'));
  const unrelated = renderRecommendations("cooking");
  assert.ok(!unrelated.includes('href="/courses/123"'));
  assert.ok(unrelated.includes("No recommended courses match your search"));
  assert.ok(renderRecommendations("").includes('href="/courses/123"'));
  for (const [state,expected] of [["EMPTY_CATALOG","No active published courses"],["NO_MORE_ELIGIBLE","No more eligible courses"]]) {
    client.setQueryData(["course-recommendations","student@example.com"],{...fixture,recommendations:[],state});
    assert.ok(renderRecommendations().includes(expected));
  }
  localStorage.setItem("viewRole","STUDENT");
  m.store.dispatch(m.setLogin({token:"admin-token",email:"admin@example.com",role:"ADMIN",roles:["ADMIN"],permissions,rolePermissions:{ADMIN:permissions,STUDENT:permissions}}));
  render(); assert.equal(effective.activeRole,"STUDENT");assert.equal(effective.user.email,"admin@example.com");assert.equal(captured.canEnroll,true);
  client.setQueryData(["course-recommendations","admin@example.com"],fixture);assert.ok(renderRecommendations().includes("Recommended for you"));
  await captured.enrollMutation.mutateAsync(124);assert.equal(requests.at(-1).headers.Authorization,"Bearer admin-token");
  sessionStorage["course_recommendation_chat:old"]="old";
  sessionStorage.removeItem = key => { delete sessionStorage[key]; };
  m.store.dispatch(m.setLogout());assert.equal(sessionStorage["course_recommendation_chat:old"],undefined);
  client.clear();
  console.log("Enrollment workflow, recommendation refresh, chat payload, save/reset/dismiss, logout cleanup and Admin Student View identity checks passed.");
} finally { await unlink(output).catch(()=>{}); }
