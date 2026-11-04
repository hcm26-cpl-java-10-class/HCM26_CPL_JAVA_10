import { screen, within, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import type { ClassCalendarVersion } from "@/types/features/external";
import { CalendarAdjustView } from "./CalendarAdjustView";

vi.mock("@/api/axios", () => import("@/test/mocks").then(module => module.axiosModule()));
const source: ClassCalendarVersion = {
    id: 2, classId: 1, name: "Calendar", version: "1.2", historyChange: "Plan", status: "active", lastModifiedDate: "2026-05-01", lastModifiedBy: "Admin",
    classStartDate: "2026-05-23", actualLearningStartDate: "2026-05-25",
    overviewItems: [
        { id: "java", label: "JAVA", name: "Java", startDate: "2026-05-25", endDate: "2026-05-25", lessons: [] },
        { id: "react", label: "REACT", name: "React", startDate: "2026-05-25", endDate: "2026-05-25", lessons: [] },
    ],
};
beforeEach(() => fakeHttp.reset());

it("adds, deletes and reorders topics before creating a new version", async () => {
    fakeHttp.on("post", "/external/classes/1/calendars/2/versions", { ...source, id: 3 });
    const back = vi.fn();
    const { user } = renderAt(<CalendarAdjustView calendar={source} classItem={{ id: 1 }} onBack={back} />, { route: "/" });
    await user.click(screen.getByRole("button", { name: "Add New Topic & Activities" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "Topic Code" }), "NEW");
    await user.type(within(dialog).getByRole("textbox", { name: "Topic / Activity Name" }), "New activity");
    await user.click(within(dialog).getByRole("button", { name: /^Add$/ }));
    await user.click(screen.getByRole("button", { name: "Delete JAVA" }));
    await user.click(screen.getByRole("button", { name: /NEW New activity/ }));
    await user.click(screen.getByRole("button", { name: "Move up" }));
    await user.click(screen.getByRole("button", { name: "Save as New Version" }));
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
    const data = fakeHttp.callsTo("post", "/external/classes/1/calendars/2/versions")[0].data as { overviewItems: Array<{ label: string }> };
    expect(data.overviewItems.map(item => item.label)).toEqual(["NEW", "REACT"]);
    expect(source.overviewItems?.map(item => item.label)).toEqual(["JAVA", "REACT"]);
});

it("keeps adjustments available after a save failure", async () => {
    fakeHttp.on("post", "/external/classes/1/calendars/2/versions", () => { throw httpError(503); });
    const back = vi.fn();
    const { user } = renderAt(<CalendarAdjustView calendar={source} classItem={{ id: 1 }} onBack={back} />, { route: "/" });
    await user.click(screen.getByRole("button", { name: "Delete JAVA" }));
    await user.click(screen.getByRole("button", { name: "Save as New Version" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your adjustments are kept");
    expect(back).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Delete JAVA" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save as New Version" })).toBeEnabled();
});
