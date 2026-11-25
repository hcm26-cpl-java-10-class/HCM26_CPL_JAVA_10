import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import ClassListPage from "../ClassListPage";
import { classStatisticsKey } from "@/hooks/useClassInsights";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));
const stats = { totalClasses: 120, inProgress: 45, upcomingClasses: 20, completedClasses: 55,
    asOf: "2026-11-07", upcomingThrough: "2026-12-07", timezone: "Asia/Ho_Chi_Minh" };
const rows = [
    { id: 1, code: "SMART_ACTIVE", name: "Java", status: "active", startDate: "2026-11-07" },
    { id: 2, code: "SMART_NEXT", name: "Java", status: "assigned", startDate: "2026-12-07" },
    { id: 3, code: "SMART_LATE", name: "Java", status: "planning", startDate: "2026-12-08" },
    { id: 4, code: "SMART_CLOSED", name: "React", status: "closed", startDate: "2026-01-01" },
];
beforeEach(() => { fakeHttp.reset(); fakeHttp.on("get", "/classes", rows); fakeHttp.on("get", "/classes/stats", stats); });

describe("Class KPI dashboard", () => {
    it("uses database statistics instead of counting the displayed classes and refetches after invalidation", async () => {
        const { client } = renderAt(<ClassListPage />, { route: "/classes" });
        expect(await within(screen.getByRole("button", { name: "Total Classes" })).findByText("120")).toBeInTheDocument();
        fakeHttp.on("get", "/classes/stats", { ...stats, totalClasses: 121 });
        await client.invalidateQueries({ queryKey: classStatisticsKey });
        expect(await screen.findByText("121")).toBeInTheDocument();
    });
    it("combines KPI filters with search, uses inclusive upcoming dates and restores all on Total", async () => {
        const { user } = renderAt(<ClassListPage />, { route: "/classes?q=Java" });
        await screen.findByText("120");
        await user.click(screen.getByRole("button", { name: "Upcoming Classes" }));
        expect(screen.getByRole("link", { name: "SMART_NEXT" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "SMART_LATE" })).not.toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("q=Java&kpi=upcoming");
        await user.click(screen.getByRole("button", { name: "Completed Classes" }));
        expect(screen.getByText("No classes match your search or filters.")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Total Classes" }));
        expect(screen.getByRole("link", { name: "SMART_ACTIVE" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "SMART_CLOSED" })).not.toBeInTheDocument();
    });
    it("shows a retryable statistics error without blocking the class list", async () => {
        fakeHttp.on("get", "/classes/stats", () => { throw httpError(403); });
        renderAt(<ClassListPage />, { route: "/classes" });
        expect(await screen.findByText(/Class statistics could not be loaded/)).toBeInTheDocument();
        expect(await screen.findByRole("table", { name: "Classes" })).toBeInTheDocument();
    });
});
