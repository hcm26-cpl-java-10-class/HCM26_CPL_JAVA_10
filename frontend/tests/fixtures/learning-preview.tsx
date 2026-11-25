// Browser QA fixture only. Every API request is intercepted; no real backend is contacted.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider, useSelector } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import axios, { AxiosError } from "axios";
import instance from "../../src/api/axios";
import { store, type RootState } from "../../src/store/store";
import { setLogin, setLogout } from "../../src/store/slices/auth/authSlice";
import { isolateQuerySession } from "../../src/lib/query-session";
import { AuthProvider } from "../../src/contexts/AuthContext";
import { RoleSwitchProvider } from "../../src/contexts/RoleSwitchContext";
import { CourseProvider } from "../../src/contexts/CourseContext";
import Catalog from "../../src/pages/management/demo/enrollment/CourseEnrollmentsPage";
import MyLearning from "../../src/pages/management/learning";
import { LearningOverviewCard } from "../../src/pages/management/profile/components/LearningOverviewCard";
import { MainLayout } from "../../src/components/layout/MainLayout";
import type { Enrollment } from "../../src/types";
import "../../src/index.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
isolateQuerySession(client, store);
const seed = [
  ["Java Fundamentals", "Introduction to Java, OOP, and basic programming concepts.", "iCYoaTvE9vo"],
  ["Spring Boot for Beginners", "Learn backend APIs, Spring Boot architecture, and database integration.", "efCONw5rdA4"],
  ["Java Spring Boot", "Khóa học Java và phát triển backend với Spring Boot", "RksqUNilQwc"],
  ["Database Design", "ER diagrams, SQL, and relational design fundamentals.", "LuVEozf3wnU"],
].map(([name, description, video], i) => ({ id: i + 1, name, description, instructor: "Teacher User", thumbnailUrl: `https://img.youtube.com/vi/${video}/hqdefault.jpg`, isActive: true }));
const learner = ["LEARNER_ACCESS", "LEARNING_SELF_READ", "ENROLLMENT_CREATE", "COURSE_READ", "LESSON_READ"];
function login(name: string) {
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const permissions = name === "Admin" ? ["ADMIN_ACCESS", "COURSE_READ"] : name === "Dual" ? [...learner, "ADMIN_ACCESS"] : learner;
  store.dispatch(setLogin({ token: "isolated-fixture-only", email: `${name.toLowerCase()}@example.test`, firstName: name, lastName: "Fixture", role: name === "Admin" || name === "Dual" ? "ADMIN" : "STUDENT", roles: ["STUDENT"], permissions }));
}
login(sessionStorage.getItem("learning-fixture-user") || "Alice");
let failEnrollment = false;
let postCount = 0;
let notifyPost = (_count: number) => {};
const adapter: NonNullable<typeof instance.defaults.adapter> = async config => {
  const email = store.getState().auth.email;
  const key = `learning-fixture-records:${email}`;
  const records: Enrollment[] = JSON.parse(sessionStorage.getItem(key) || "[]");
  let data: unknown;
  const params = config.params || {};
  if (config.url === "/courses") {
    const search = String(params.search || "").toLowerCase();
    const list = seed.filter(c => `${c.name} ${c.description} ${c.instructor}`.toLowerCase().includes(search));
    const sort = String(params.sort || "id,desc");
    list.sort((a, b) => (sort.startsWith("name") ? a.name.localeCompare(b.name) : a.id - b.id) * (sort.endsWith("desc") ? -1 : 1));
    data = { content: list.slice(params.page * params.size, (params.page + 1) * params.size), totalElements: list.length, totalPages: Math.ceil(list.length / params.size) };
  } else if (config.url === "/enrollments" && config.method === "post") {
    notifyPost(++postCount);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (failEnrollment) throw new AxiosError("Fixture enrollment failure", "ERR_BAD_RESPONSE", config, undefined, { status: 500, statusText: "Fixture failure", data: {}, headers: {}, config });
    const { courseId } = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const course = seed.find(c => c.id === courseId)!;
    const record = records.find(e => e.courseId === courseId) || { id: records.length + 1, courseId, courseName: course.name, courseDescription: course.description, instructor: course.instructor, thumbnailUrl: course.thumbnailUrl, enrolledAt: new Date().toISOString() };
    if (!records.some(e => e.courseId === courseId)) records.push(record);
    sessionStorage.setItem(key, JSON.stringify(records)); data = record;
  } else if (config.url === "/enrollments/my-courses") data = records;
  else if (config.url === "/learning/me") data = { enrolledCourses: records, inProgressCourses: null, completedCourses: null, overallProgress: null, certificates: null, learningActivity: null };
  else if (config.url === "/lessons") data = { content: [], totalPages: 0, totalElements: 0 };
  else if (config.url === "/module-groups" || config.url === "/modules") data = { content: [], totalPages: 0, totalElements: 0 };
  else if (config.url === "/auth/logout") data = {};
  else throw new Error(`Fixture blocked unexpected API request: ${config.method} ${config.url}`);
  return { status: config.method === "post" ? 201 : 200, statusText: "Fixture", headers: {}, config, data };
};
instance.defaults.adapter = adapter;
axios.defaults.adapter = adapter;

function Preview() {
  const { isAuthenticated, email } = useSelector((state: RootState) => state.auth);
  const [posts, setPosts] = useState(postCount);
  notifyPost = setPosts;
  return <>
    <div style={{ padding: 8, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 14, borderBottom: "1px solid #999" }}>
      <strong>Isolated test fixture</strong>
      <select aria-label="Fixture account" value={email.split("@")[0] || "alice"} onChange={e => { const name = e.target.value; sessionStorage.setItem("learning-fixture-user", name); login(name); }}>
        {["Alice", "Bob", "Admin", "Dual"].map(name => <option key={name} value={name.toLowerCase()}>{name}</option>)}
      </select>
      <button onClick={() => store.dispatch(setLogout())}>Fixture logout</button>
      <button onClick={() => login("Alice")}>Fixture login Alice</button>
      <label><input type="checkbox" onChange={e => { failEnrollment = e.target.checked; }} /> Fail enrollment</label>
      <span>Enrollment POSTs: {posts}</span>
    </div>
    {isAuthenticated ? <AuthProvider><RoleSwitchProvider><CourseProvider><Routes>
      <Route path="/my-learning" element={<MyLearning />} />
      <Route path="/profile" element={<MainLayout><LearningOverviewCard /></MainLayout>} />
      <Route path="*" element={<Catalog />} />
    </Routes></CourseProvider></RoleSwitchProvider></AuthProvider> : <p>Fixture logged out.</p>}
    <Toaster position="top-right" richColors duration={5000} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Provider store={store}><QueryClientProvider client={client}><MemoryRouter><Preview /></MemoryRouter></QueryClientProvider></Provider>);
