import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError, pageOf } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import TrainerManagementPage from "./TrainerManagementPage";
import { TrainerImportModal } from "./TrainerImportModal";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then(m => m.permissionsModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));
const trainer = { id: 12, trainerCode: "TR_12", fullName: "Trainer Twelve", email: "trainer12@example.test", specialization: "Java", status: "ACTIVE", source: "INTERNAL", teachingTopics: [] };
beforeEach(() => {
    fakeHttp.reset(); grant("TRAINER_READ", "TRAINER_CREATE", "TRAINER_UPDATE", "TRAINER_DELETE");
    fakeHttp.on("get", "/trainers", pageOf([trainer]));
    fakeHttp.on("get", "/trainers/12", trainer);
    fakeHttp.on("get", "/trainers/teaching-topics", [{ id: 5, code: "JAVA", name: "Java", version: "1", active: true }]);
});

it("lists, searches and filters trainers on the server", async () => {
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("Trainer Twelve");
    await user.type(screen.getByLabelText("Search Trainers"), "Java");
    await user.selectOptions(screen.getByLabelText("Filter Trainer Status"), "ACTIVE");
    await waitFor(() => expect(fakeHttp.callsTo("get", "/trainers").at(-1)?.params).toEqual({ search: "Java", status: "ACTIVE", page: 0, size: 20 }));
});

it("creates a trainer with existing teaching topic IDs", async () => {
    fakeHttp.on("post", "/trainers", trainer);
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(screen.getByRole("button", { name: "Add Trainer" }));
    await screen.findByRole("option", { name: /JAVA@1/ });
    await user.type(screen.getByLabelText("Trainer ID *"), "TR_NEW");
    await user.type(screen.getByLabelText("Full Name *"), "New Trainer");
    await user.type(screen.getByLabelText("Work Email *"), "new@example.test");
    await user.selectOptions(screen.getByLabelText("Teaching Topics"), "5");
    await user.click(screen.getByRole("button", { name: "Save Trainer" }));
    await screen.findByText("Trainer saved.");
    expect(fakeHttp.callsTo("post", "/trainers")[0].data).toMatchObject({ trainerCode: "TR_NEW", fullName: "New Trainer", email: "new@example.test", teachingTopicIds: [5], status: "ACTIVE" });
});

it("edits, views and changes status without changing the identity", async () => {
    fakeHttp.on("put", "/trainers/12", trainer); fakeHttp.on("patch", "/trainers/12/status", trainer);
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(await screen.findByRole("button", { name: "Actions for TR_12" }));
    await user.click(screen.getByRole("menuitem", { name: "View TR_12" }));
    await screen.findByRole("dialog", { name: /Trainer Details/ }); await user.click(screen.getByRole("button", { name: "Close Details" }));
    await user.click(screen.getByRole("button", { name: "Actions for TR_12" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit TR_12" }));
    await screen.findByRole("option", { name: /JAVA@1/ });
    await user.clear(screen.getByLabelText("Full Name *")); await user.type(screen.getByLabelText("Full Name *"), "Updated Name");
    await user.click(screen.getByRole("button", { name: "Save Trainer" })); await screen.findByText("Trainer saved.");
    expect(fakeHttp.callsTo("put", "/trainers/12")[0].data).toMatchObject({ fullName: "Updated Name" });
    await user.click(screen.getByRole("button", { name: "Actions for TR_12" }));
    await user.click(screen.getByRole("menuitem", { name: "Deactivate TR_12" })); await screen.findByText("Trainer status updated.");
    expect(fakeHttp.callsTo("patch", "/trainers/12/status")[0].data).toEqual({ status: "INACTIVE" });
});

it("keeps a referenced trainer when the server refuses archive", async () => {
    fakeHttp.on("delete", "/trainers/12", () => { throw httpError(409, { message: "Trainer is referenced. Set INACTIVE instead." }); });
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(await screen.findByRole("button", { name: "Actions for TR_12" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive TR_12" }));
    await user.click(screen.getByRole("button", { name: "Confirm Archive" }));
    await waitFor(() => expect(screen.getAllByRole("alert").some(a => a.textContent?.includes("Set INACTIVE"))).toBe(true));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("hides write actions for read-only users and avoids requests without read permission", async () => {
    grant("TRAINER_READ");
    const view = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("Trainer Twelve");
    expect(screen.queryByRole("button", { name: "Add Trainer" })).not.toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Actions for TR_12" }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "View TR_12" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Edit|Activate|Deactivate|Archive/ })).not.toBeInTheDocument();
    view.unmount(); fakeHttp.reset(); grant();
    renderAt(<TrainerManagementPage />, { route: "/trainers" });
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied"); expect(fakeHttp.calls).toHaveLength(0);
});

it("supports keyboard navigation, portaled menus and focus restoration", async () => {
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    const trigger = await screen.findByRole("button", { name: "Actions for TR_12" });
    trigger.focus(); await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);
    expect(screen.getByRole("table", { hidden: true })).not.toContainElement(menu);
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "View TR_12" })).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "Edit TR_12" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it.each([
    ["TRAINER_UPDATE", ["View TR_12", "Edit TR_12", "Deactivate TR_12"]],
    ["TRAINER_DELETE", ["View TR_12", "Archive TR_12"]],
])("checks each action permission independently (%s)", async (permission, labels) => {
    grant("TRAINER_READ", permission as "TRAINER_UPDATE" | "TRAINER_DELETE");
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(await screen.findByRole("button", { name: "Actions for TR_12" }));
    expect(screen.getAllByRole("menuitem").map(item => item.getAttribute("aria-label"))).toEqual(labels);
});

it("activates an inactive trainer and invalidates Master Trainer options", async () => {
    fakeHttp.on("get", "/trainers", pageOf([{ ...trainer, status: "INACTIVE" }]));
    fakeHttp.on("patch", "/trainers/12/status", trainer);
    const { user, client } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await user.click(await screen.findByRole("button", { name: "Actions for TR_12" }));
    await user.click(screen.getByRole("menuitem", { name: "Activate TR_12" }));
    await screen.findByText("Trainer status updated.");
    expect(fakeHttp.callsTo("patch", "/trainers/12/status")[0].data).toEqual({ status: "ACTIVE" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["class-setup", "verified-trainers"] });
});

it("archives after confirmation and retains pagination and full emails", async () => {
    const email = "a.very.long.trainer.email.address@example.test";
    fakeHttp.on("get", "/trainers", { content: [{ ...trainer, email }], totalElements: 21, totalPages: 2 });
    fakeHttp.on("delete", "/trainers/12", undefined);
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    expect(await screen.findByText(email)).toHaveAttribute("title", email);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fakeHttp.callsTo("get", "/trainers").at(-1)?.params).toMatchObject({ page: 1 }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(fakeHttp.callsTo("get", "/trainers").at(-1)?.params).toMatchObject({ page: 0 }));
    await user.click(screen.getByRole("button", { name: "Actions for TR_12" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive TR_12" }));
    expect(fakeHttp.callsTo("delete", "/trainers/12")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Confirm Archive" }));
    await screen.findByText("Trainer archived.");
    expect(fakeHttp.callsTo("delete", "/trainers/12")).toHaveLength(1);
});

it.each([401, 403, 404, 500])("reports HTTP %s instead of pretending the trainer list is empty", async status => {
    fakeHttp.on("get", "/trainers", () => { throw httpError(status); });
    renderAt(<TrainerManagementPage />, { route: "/trainers" });
    expect(await screen.findByRole("alert")).toHaveTextContent(`HTTP ${status}`);
    expect(screen.queryByText("No trainers match the current filters.")).not.toBeInTheDocument();
});

it.each([false, true])("previews the Trainer Excel and commits only a fully valid file (%s)", async valid => {
    fakeHttp.on("post", "/trainers/import/preview", { totalRows: 1, validRows: valid ? 1 : 0, canImport: valid,
        rows: [{ rowNumber: 2, cells: ["TR_X", "Excel Trainer", "excel@example.test", "", "", "ACTIVE"], valid, errors: valid ? [] : ["Duplicate Work Email"] }] });
    fakeHttp.on("post", "/trainers/import", { imported: 1 });
    const saved = vi.fn(async () => {}); const close = vi.fn();
    const { user } = renderAt(<TrainerImportModal saved={saved} close={close} />, { route: "/trainers" });
    await user.upload(screen.getByLabelText("Upload Trainer Excel"), new File(["test fixture"], "trainers.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    await screen.findByText("Excel Trainer");
    const commit = screen.getByRole("button", { name: "Import All Trainers" });
    if (!valid) { expect(commit).toBeDisabled(); expect(screen.getByText("Duplicate Work Email")).toBeInTheDocument(); }
    else { await user.click(commit); await waitFor(() => expect(saved).toHaveBeenCalled()); expect(close).toHaveBeenCalled(); }
    expect(fakeHttp.callsTo("post", "/trainers/import")).toHaveLength(valid ? 1 : 0);
    expect(fakeHttp.calls.some(c => c.url.includes("trainee"))).toBe(false);
});
