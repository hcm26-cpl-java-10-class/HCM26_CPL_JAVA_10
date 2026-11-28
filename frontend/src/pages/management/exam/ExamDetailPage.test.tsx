import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { examApi } from "@/api";
import ExamDetailPage from "./ExamDetailPage";
const editState = vi.hoisted(() => ({dirty:false}));
vi.mock("@/api", () => ({ examApi: {getById: vi.fn()}, examTemplateApi: {} }));
vi.mock("@/components/layout/HeaderRight", () => ({default: () => null}));
vi.mock("./ExamQuestionsPanel", () => ({ExamQuestionsPanel: () => <p>Question content</p>}));
vi.mock("./ExamEditPanel", async () => {
 const {useEffect}=await import("react");
 return {ExamEditPanel:({onDirtyChange}:{onDirtyChange?:(dirty:boolean)=>void})=>{
  useEffect(()=>{onDirtyChange?.(editState.dirty);return ()=>onDirtyChange?.(false);},[onDirtyChange]);
  return <p>Edit content</p>;
 }};
});
vi.mock("./ResultStatisticsPage", () => ({default: () => <p>Results content</p>}));
vi.mock("./invitation", () => ({default: () => <p>Invitation content</p>}));
function Location() { const l=useLocation(); return <output aria-label="Location">{l.pathname+l.search+l.hash}</output>; }
function mount(path: string) {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[path]}><Location/><Routes><Route path="/exams/:examId/*" element={<ExamDetailPage/>}/><Route path="*" element={<p>Destination</p>}/></Routes></MemoryRouter></QueryClientProvider>);}
beforeEach(() => {editState.dirty=false;vi.mocked(examApi.getById).mockResolvedValue({id:8,title:"Quiz",courseId:7,courseName:"Java",status:"PUBLISHED"} as never);});
it("keeps the exact course return context across all five tabs and returns there", async () => {
 const target="/courses/7?tab=details#course-assessments";mount(`/exams/8/questions?returnTo=${encodeURIComponent(target)}`);
 await screen.findByText("Quiz");
 for (const name of ["Grading","Invitations","Statistics","Edit","Questions"]) {
  await userEvent.click(screen.getByRole("tab",{name:new RegExp(name)}));
  expect(new URL(screen.getByLabelText("Location").textContent!,"https://app.invalid").searchParams.get("returnTo")).toBe(target);
 }
 expect(screen.getByRole("button",{name:"Close"})).toBeInTheDocument();
 await userEvent.click(screen.getByRole("button",{name:"Back to course detail"}));
 expect(screen.getByLabelText("Location")).toHaveTextContent(target);
});
it.each(["", "?returnTo=https%3A%2F%2Fevil.test"]) ("resolves direct or invalid-context entry from the saved course %s", async query => {
 mount(`/exams/8/edit${query}`);await screen.findByText("Quiz");
 await userEvent.click(screen.getByRole("button",{name:"Back to course detail"}));
 expect(screen.getByLabelText("Location")).toHaveTextContent("/courses/7#course-assessments");
});
it("provides a safe fallback for an unlinked assessment", async () => {
 vi.mocked(examApi.getById).mockResolvedValue({id:8,title:"Standalone",status:"PUBLISHED"} as never);
 mount("/exams/8/questions");await screen.findByText("Standalone");
 await userEvent.click(screen.getByRole("button",{name:"Back to assessments"}));
 await waitFor(()=>expect(screen.getByLabelText("Location").textContent).toBe("/exams"));
});

it("asks before leaving a dirty edit and retains it when the user cancels",async()=>{
 editState.dirty=true;const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 mount("/exams/8/edit?returnTo=%2Fcourses%2F7%23course-assessments");await screen.findByText("Edit content");
 await userEvent.click(screen.getByRole("button",{name:"Back to course detail"}));
 expect(confirm).toHaveBeenCalledWith("Discard unsaved assessment changes?");
 expect(screen.getByLabelText("Location").textContent).toContain("/exams/8/edit");
 confirm.mockReturnValue(true);await userEvent.click(screen.getByRole("button",{name:"Back to course detail"}));
 expect(screen.getByLabelText("Location")).toHaveTextContent("/courses/7#course-assessments");
});
