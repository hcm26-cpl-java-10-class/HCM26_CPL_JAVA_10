import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

// Render the real pages with controlled API/query/router boundaries. No HTTP requests.
const server = await createServer({
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ["@tanstack/react-query", "react-router-dom"] },
    plugins: [{
        name: "course-metadata-test-boundaries",
        enforce: "pre",
        resolveId(id) {
            const normalized = id.replaceAll("\\", "/").replace(/\.(tsx?|jsx?)$/, "");
            if (/\/src\/api(?:\/index)?$/.test(normalized)) return "\0course-test:@/api";
            if (normalized.endsWith("/src/components/layout/MainLayout")) return "\0course-test:@/components/layout/MainLayout";
            if (["@/api", "@tanstack/react-query", "react-router-dom", "@/components/layout/MainLayout"].includes(id)) {
                return `\0course-test:${id}`;
            }
        },
        load(id) {
            if (!id.startsWith("\0course-test:")) return;
            if (id.endsWith("@/api")) return "export const enrollmentApi = {}; export const courseApi = {};";
            if (id.endsWith("@tanstack/react-query")) return "export const useQuery = () => globalThis.__courseMetadataQuery;";
            if (id.endsWith("react-router-dom")) return `
                import { createElement } from 'react';
                export const useParams = () => globalThis.__courseMetadataParams;
                export const Link = ({to, children, ...props}) => createElement('a', {...props, href: to}, children);
            `;
            return "import { createElement } from 'react'; export const MainLayout = ({children}) => createElement('main', null, children);";
        },
    }],
});
after(async () => { await server.close(); delete globalThis.__courseMetadataQuery; delete globalThis.__courseMetadataParams; });
const { default: Learning } = await server.ssrLoadModule("/src/pages/management/demo/enrollment/index.tsx");
const { default: Detail } = await server.ssrLoadModule("/src/pages/management/demo/course/CourseDetailPage.tsx");
function render(component, query, params = { id: "12" }) {
    globalThis.__courseMetadataQuery = { isLoading: false, isError: false, refetch() {}, ...query };
    globalThis.__courseMetadataParams = params;
    return renderToStaticMarkup(createElement(component));
}
test("My Learning shows persisted metadata, enrollment and details link without progress", () => {
    const html = render(Learning, { data: [{ id: 3, courseId: 12, courseName: "Java 21 Fundamentals", courseDescription: "Original description", instructor: "Teacher User", thumbnailUrl: null, enrolledAt: "2026-10-30T10:00:00" }] });
    for (const text of ["Java 21 Fundamentals", "Original description", "Teacher User", "Enrolled", "View Course Details", 'href="/courses/12"']) assert.ok(html.includes(text), text);
    assert.ok(!html.includes("<img"));
    assert.doesNotMatch(html, /\d+%|completed lessons|progress/i);
});
test("My Learning retains empty, loading and retry states", () => {
    assert.match(render(Learning, { data: [] }), /Your classroom is waiting/);
    assert.match(render(Learning, { isLoading: true }), /Loading enrollments/);
    assert.match(render(Learning, { isError: true, error: new Error("Unavailable") }), /Try again/);
});
test("My Learning handles missing metadata and available thumbnails", () => {
    const html = render(Learning, { data: [{ id: 3, courseId: 12, courseName: "Course", courseDescription: null, thumbnailUrl: "https://example.com/course.png" }] });
    assert.match(html, /No description available/);
    assert.match(html, /src="https:\/\/example.com\/course.png"/);
});
test("Course detail renders metadata and optional-field fallbacks", () => {
    const html = render(Detail, { data: { name: "Course", description: "Full description", instructor: "Teacher User" } });
    assert.match(html, /Full description/);
    assert.match(html, /Instructor: Teacher User/);
    assert.match(html, /Back to My Learning/);
    assert.doesNotMatch(html, /lesson count|\d+%|progress/i);
    const missing = render(Detail, { data: { name: "Course" } });
    assert.match(missing, /No description available/);
    assert.match(missing, /Not provided/);
});
test("Course detail handles invalid IDs, loading and failed retrieval", () => {
    assert.match(render(Detail, {}, { id: "invalid" }), /Invalid course ID/);
    assert.match(render(Detail, { isLoading: true }), /Loading course details/);
    assert.match(render(Detail, { isError: true }), /Try again/);
});
