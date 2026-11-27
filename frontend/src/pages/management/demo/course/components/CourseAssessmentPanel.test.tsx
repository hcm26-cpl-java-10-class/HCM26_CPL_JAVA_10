import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/api/axios";
import { examApi } from "@/api";
import { CourseAssessmentPanel } from "./CourseAssessmentPanel";
const persona = vi.hoisted(() => ({ role: "ADMIN" }));
vi.mock("@/hooks/usePermissions", () => ({usePermissions: () => ({activeRole:persona.role,hasPermission:()=>true})}));
vi.mock("@/api/axios", () => ({default:{get:vi.fn(),put:vi.fn()}}));
vi.mock("@/api", () => ({examApi:{listByCourse:vi.fn()}}));
function mount() { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><CourseAssessmentPanel courseId={7}/></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); persona.role="ADMIN"; vi.mocked(api.get).mockResolvedValue({data:{totalWeight:100,ready:true,issues:[]}}); vi.mocked(examApi.listByCourse).mockResolvedValue([{id:1,title:"Quiz",courseWeight:70},{id:2,title:"Final",courseWeight:30}] as never); });
it("retains failed drafts, sends only changed weights and supports cancel", async () => {
 const user=userEvent.setup(); mount(); await user.click(await screen.findByRole("button",{name:"Edit weights"}));
 const quiz=screen.getByRole("textbox",{name:"Weight (%) for Quiz"}); await user.clear(quiz); await user.type(quiz,"60.25");
 vi.mocked(api.put).mockRejectedValueOnce(new Error("offline")); await user.click(screen.getByRole("button",{name:"Save weights"}));
 expect(await screen.findByText(/Could not save weights/)).toBeInTheDocument(); expect(quiz).toHaveValue("60.25");
 expect(api.put).toHaveBeenCalledWith("/courses/7/exam-weights",[{examId:1,weight:60.25}]);
 await user.click(screen.getByRole("button",{name:"Cancel"})); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("rejects invalid precision, blank changed values and over allocation before saving", async () => {
 const user=userEvent.setup(); mount(); await user.click(await screen.findByRole("button",{name:"Edit weights"}));
 const quiz=screen.getByRole("textbox",{name:"Weight (%) for Quiz"});
 for(const value of ["80","10.001",""]) { await user.clear(quiz); if(value) await user.type(quiz,value); expect(screen.getByRole("button",{name:"Save weights"})).toBeDisabled(); }
 expect(api.put).not.toHaveBeenCalled();
});
it("refreshes the plan and exits editing after successful save", async () => {
 const user=userEvent.setup(); mount(); await user.click(await screen.findByRole("button",{name:"Edit weights"}));
 const quiz=screen.getByRole("textbox",{name:"Weight (%) for Quiz"}); await user.clear(quiz); await user.type(quiz,"0");
 vi.mocked(api.put).mockResolvedValueOnce({}); await user.click(screen.getByRole("button",{name:"Save weights"}));
 expect(await screen.findByText("Assessment weights saved.")).toBeInTheDocument(); await waitFor(()=>expect(examApi.listByCourse).toHaveBeenCalledTimes(2));
});
it("keeps Admin Student View learner-facing even with permissive authentication", () => {
 persona.role="STUDENT"; mount(); expect(screen.queryByText("Assessments and course grading")).not.toBeInTheDocument(); expect(examApi.listByCourse).not.toHaveBeenCalled();
});

it("passes the source course and section anchor to curriculum mapping",async()=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/courses/7?tab=details"]}><CourseAssessmentPanel courseId={7}/></MemoryRouter></QueryClientProvider>);
 const link=await screen.findByRole("link",{name:"Manage assessment links"});
 const url=new URL(link.getAttribute("href")!,"https://app.invalid");
 expect(url.searchParams.get("courseId")).toBe("7");expect(url.searchParams.get("returnTo")).toBe("/courses/7?tab=details#course-assessments");
});
it("does not render the recursive manage link inside mapping",()=>{
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CourseAssessmentPanel courseId={7} showManageLinks={false}/></MemoryRouter></QueryClientProvider>);
 expect(screen.queryByRole("link",{name:"Manage assessment links"})).not.toBeInTheDocument();
});

it("focuses the assessment linked to the requested lesson and retains a precise Curriculum return path",async()=>{
 vi.mocked(examApi.listByCourse).mockResolvedValue([{id:1,title:"Other",courseWeight:70,lessonId:8},{id:2,title:"Target",courseWeight:30,lessonId:9}] as never);
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/courses/7?assessmentLessonId=9&assessmentSectionId=3#course-assessments"]}><CourseAssessmentPanel courseId={7}/></MemoryRouter></QueryClientProvider>);
 const target=await screen.findByLabelText("Configure Target");await waitFor(()=>expect(target).toHaveFocus());
 expect(screen.getByRole("link",{name:"Back to Curriculum"})).toHaveAttribute("href","/curriculum?courseId=7&sectionId=3&lessonId=9");
 await userEvent.click(screen.getByRole("button",{name:"Edit assessment weight"}));
 expect(screen.getByRole("textbox",{name:"Weight (%) for Target"})).toHaveFocus();
 expect(api.put).not.toHaveBeenCalled();
});
it("routes an unlinked assessment lesson to the existing mapping workflow without creating records",async()=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/courses/7?assessmentLessonId=999#course-assessments"]}><CourseAssessmentPanel courseId={7}/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByText(/This lesson has no linked assessment yet/)).toBeInTheDocument();expect(screen.getByRole("link",{name:"Configure its assessment link"})).toHaveAttribute("href",expect.stringContaining("/exams/curriculum?courseId=7"));expect(api.put).not.toHaveBeenCalled();
});
