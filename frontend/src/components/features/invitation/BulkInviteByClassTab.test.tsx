import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderRoutes } from "@/test/render";
import type { ExternalClass, GroupInvitationRequest, InvitationDTO, Trainee } from "@/types";
import InvitationsPage from "@/pages/management/exam/invitation";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

const mockClasses: ExternalClass[] = [
    {
        id: 1,
        code: "LOCAL_JAVA_01",
        name: "Lớp Chuyên sâu Java Backend (K26)",
        status: "active",
        startDate: "2026-10-01",
        endDate: "2027-01-31",
        plannedSize: 25,
        enrolledTrainees: 25,
        program: "LOCAL_JAVA",
        classAdmin: "admin@example.com",
        masterTrainer: "Nguyễn Ngọc Tân (Trainer)",
        traineeSource: "internal",
    },
    {
        id: 2,
        code: "LOCAL_JAVA_02",
        name: "Lớp Lập trình Fullstack Java Web (K26)",
        status: "active",
        startDate: "2026-11-15",
        endDate: "2027-03-15",
        plannedSize: 30,
        enrolledTrainees: 0,
        program: "LOCAL_FULLSTACK",
        classAdmin: "admin@example.com",
        masterTrainer: "Nguyễn Mạnh Hoàng (Trainer)",
        traineeSource: "internal",
    },
];

const localJava01Trainees: Trainee[] = [
    {
        id: 1001,
        code: "AI237193",
        fptAccount: "AI237193",
        fullName: "Vũ Mai Trang",
        personalEmail: "trangvm185@gmail.com",
        email: "trangvm185@gmail.com",
        status: "Active",
    },
    {
        id: 1002,
        code: "IA506908",
        fptAccount: "IA506908",
        fullName: "Phan Phú Dũng",
        personalEmail: "dungpp714@gmail.com",
        email: "dungpp714@gmail.com",
        status: "Active",
    },
    {
        id: 1003,
        code: "SE408891",
        fptAccount: "SE408891",
        fullName: "Lý Mai Giang",
        personalEmail: "gianglm737@gmail.com",
        email: "gianglm737@gmail.com",
        status: "Active",
    },
    {
        id: 1004,
        code: "AI805571",
        fptAccount: "AI805571",
        fullName: "Bùi Phương Linh",
        personalEmail: "linhbp705@gmail.com",
        email: "linhbp705@gmail.com",
        status: "Inactive",
    },
];

describe("Exam Invitations — By Class synchronization with Class List & Trainee List", () => {
    let examInvitations: InvitationDTO[];

    beforeEach(() => {
        fakeHttp.reset();
        grant("INVITATION_READ", "INVITATION_CREATE", "CLASS_READ", "ENROLLMENT_READ");

        // Pre-seed 1 existing invitation for Phan Phú Dũng + an unrelated User ID=1001 collision check
        examInvitations = [
            {
                id: 50,
                examId: 10,
                userId: 1001, // Intentionally collides with Vũ Mai Trang's trainee.id!
                userFullName: "Existing Other Student",
                userEmail: "other-student@example.com",
                status: "SENT",
                sourceType: "MANUAL",
                anonymous: false,
            },
            {
                id: 51,
                examId: 10,
                userId: 777,
                userFullName: "Phan Phú Dũng",
                userEmail: "dungpp714@gmail.com",
                status: "SENT",
                sourceType: "MANUAL",
                anonymous: false,
            },
        ];

        fakeHttp.on("get", "/exams/10", {
            id: 10,
            title: "Java Core Mid-Term",
            durationMinutes: 60,
        });
        fakeHttp.on("get", "/classes", {
            content: mockClasses,
            totalElements: mockClasses.length,
            totalPages: 1,
            number: 0,
            size: 100,
            programs: ["LOCAL_JAVA", "LOCAL_FULLSTACK"],
        });
        fakeHttp.on("get", "/classes/1/trainees", localJava01Trainees);
        fakeHttp.on("get", "/classes/2/trainees", []);
        fakeHttp.on("get", "/exams/10/invitations", () => [...examInvitations]);
        fakeHttp.on("post", "/exams/10/invitations/by-course", (config: { data?: unknown }) => {
            const body = config.data as GroupInvitationRequest;
            const byId = new Map(localJava01Trainees.map((t) => [t.id, t]));
            const invited: InvitationDTO[] = (body.userIds ?? []).map((id, idx) => {
                const t = byId.get(id)!;
                const inv: InvitationDTO = {
                    id: 90 + idx,
                    examId: 10,
                    userId: 800 + idx,
                    userFullName: t.fullName,
                    userEmail: t.personalEmail,
                    status: "SENT",
                    sentAt: "2026-11-11T10:50:00Z",
                    anonymous: false,
                    sourceType: "COURSE",
                    sourceCourseId: body.courseId,
                    sourceClassCode: body.classCode ?? "LOCAL_JAVA_01",
                };
                examInvitations.push(inv);
                return inv;
            });
            return {
                examId: 10,
                totalRequested: invited.length,
                successCount: invited.length,
                skippedCount: 0,
                failureCount: 0,
                successfulInvitations: invited,
                items: invited.map((inv) => ({
                    userId: inv.userId,
                    userEmail: inv.userEmail,
                    userFullName: inv.userFullName,
                    invitationId: inv.id,
                    status: "SUCCESS",
                    reason: "Đã tạo lời mời và gửi email",
                })),
            };
        });
    });

    it("loads real Class List options, previews Trainee List members, handles empty class, and refreshes Invitations table with class code Source", async () => {
        const { user } = renderRoutes(
            [{ path: "/exams/:examId/invitations", element: <InvitationsPage /> }],
            { route: "/exams/10/invitations" },
        );

        await screen.findByText("Phan Phú Dũng");

        // Open Create Invitation modal -> switch to By Class tab
        await user.click(screen.getByRole("button", { name: /create invitation/i }));
        await user.click(await screen.findByRole("tab", { name: /theo lớp học \(by class\)/i }));

        // Class dropdown fetches from GET /classes (Class List), NOT /courses
        const trigger = await screen.findByRole("combobox", { name: "Class" });
        await user.click(trigger);

        expect(
            await screen.findByRole("option", {
                name: "LOCAL_JAVA_01 - Lớp Chuyên sâu Java Backend (K26) (25 trainees)",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("option", {
                name: "LOCAL_JAVA_02 - Lớp Lập trình Fullstack Java Web (K26) (0 trainees)",
            }),
        ).toBeInTheDocument();
        expect(fakeHttp.callsTo("get", "/courses")).toHaveLength(0);

        // Select LOCAL_JAVA_02 first -> displays empty state message
        await user.click(
            screen.getByRole("option", {
                name: "LOCAL_JAVA_02 - Lớp Lập trình Fullstack Java Web (K26) (0 trainees)",
            }),
        );
        expect(await screen.findByText("No active trainees enrolled in this class yet.")).toBeInTheDocument();

        // Switch to LOCAL_JAVA_01 -> fetches GET /classes/1/trainees
        await user.click(screen.getByRole("combobox", { name: "Class" }));
        await user.click(
            await screen.findByRole("option", {
                name: "LOCAL_JAVA_01 - Lớp Chuyên sâu Java Backend (K26) (25 trainees)",
            }),
        );

        const dialog = screen.getByRole("dialog");
        await within(dialog).findByText("Vũ Mai Trang");
        expect(within(dialog).getByText("AI237193")).toBeInTheDocument();
        expect(within(dialog).getByText("trangvm185@gmail.com")).toBeInTheDocument();

        // Vũ Mai Trang & Lý Mai Giang (Active, not yet invited) are pre-selected even with User.id=1001 collision
        const trangCheckbox = within(dialog).getByRole("checkbox", { name: "Select Vũ Mai Trang" });
        const dungCheckbox = within(dialog).getByRole("checkbox", { name: "Select Phan Phú Dũng" });
        const giangCheckbox = within(dialog).getByRole("checkbox", { name: "Select Lý Mai Giang" });
        const linhCheckbox = within(dialog).getByRole("checkbox", { name: "Select Bùi Phương Linh" });

        expect(trangCheckbox).toBeChecked();
        expect(trangCheckbox).toBeEnabled();
        expect(giangCheckbox).toBeChecked();
        expect(giangCheckbox).toBeEnabled();

        // Phan Phú Dũng already has an invitation -> disabled & labeled Already invited
        expect(dungCheckbox).not.toBeChecked();
        expect(dungCheckbox).toBeDisabled();
        expect(within(dialog).getByText("Already invited")).toBeInTheDocument();

        // Bùi Phương Linh is Inactive -> disabled & labeled Inactive
        expect(linhCheckbox).not.toBeChecked();
        expect(linhCheckbox).toBeDisabled();
        expect(within(dialog).getByText("Inactive")).toBeInTheDocument();

        // Confirm bulk invite for the 2 selected Active students
        const inviteBtn = within(dialog).getByRole("button", { name: /invite 2 student\(s\)/i });
        await user.click(inviteBtn);

        await waitFor(() => {
            expect(fakeHttp.callsTo("post", "/exams/10/invitations/by-course")).toHaveLength(1);
        });
        const postPayload = fakeHttp.callsTo("post", "/exams/10/invitations/by-course")[0]
            .data as GroupInvitationRequest;
        expect(postPayload.courseId).toBe(1);
        expect(postPayload.classCode).toBe("LOCAL_JAVA_01");
        expect(postPayload.userIds).toEqual([1001, 1003]);

        // Close modal (or verify background table already refreshed)
        fireEvent.keyDown(dialog, { key: "Escape" });

        // Invitations table on /exams/10/invitations displays the newly invited students with Source = LOCAL_JAVA_01
        await screen.findByText("Vũ Mai Trang");
        expect(screen.getByText("Lý Mai Giang")).toBeInTheDocument();
        expect(screen.getAllByText("LOCAL_JAVA_01").length).toBeGreaterThanOrEqual(2);
    }, 15000);
});

