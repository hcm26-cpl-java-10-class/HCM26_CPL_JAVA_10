import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { ClassModal } from "./ClassModal";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
beforeEach(() => fakeHttp.reset());

const item = { id: 42, code: "CLASS_42", name: "Training class", status: "planning", program: "ACTIVE_PROGRAM",
    startDate: "2030-06-01", endDate: "2030-09-01", plannedSize: 20, site: "HCM", classAdmin: "Admin",
    masterTrainer: "Trainer", deliveryType: "Class", formatType: "Offline", location: "" };

it("saves user-entered delivery, blended format and exact room name to the internal class endpoint", async () => {
    fakeHttp.on("put", "/classes/42", item);
    const done = vi.fn();
    const { user } = renderAt(<ClassModal open onOpenChange={done} classItem={item} />, { route: "/classes/42" });
    expect(document.querySelector<HTMLInputElement>("#class-location")?.value).toBe("");
    fireEvent.change(screen.getByLabelText("Delivery Type"), { target: { value: "Instructor led" } });
    await user.selectOptions(document.querySelector<HTMLSelectElement>("#class-format-type")!, "Blended");
    fireEvent.change(document.querySelector<HTMLInputElement>("#class-location")!, { target: { value: "  Room from directory  " } });
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(done).toHaveBeenCalledWith(false));
    expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({
        program: "ACTIVE_PROGRAM", deliveryType: "Instructor led", formatType: "Blended", location: "Room from directory",
    });
    expect(fakeHttp.calls.some(call => call.url.includes("/external/classes"))).toBe(false);
});
