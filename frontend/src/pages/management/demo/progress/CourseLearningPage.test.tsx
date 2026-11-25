import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CourseLearningPage } from "./CourseLearningPage";
import { examApi, progressApi } from "@/api";
import { getExamPreparation, startOrResumeExam } from "@/api/exam.api";
vi.mock("@/api",()=>({examApi:{listByCourse:vi.fn()},progressApi:{getByEnrollment:vi.fn(),recordAccess:vi.fn(),addStudyTime:vi.fn()},certificateApi:{}}));
vi.mock("@/api/exam.api",()=>({getExamPreparation:vi.fn(),startOrResumeExam:vi.fn()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{email:"course@example.com"}})}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({hasPermission:()=>false})}));
vi.mock("@/hooks/useStudyTimeTracker",()=>({useStudyTimeTracker:()=>{}}));
vi.mock("@/pages/student/useAdminStudentPreview",()=>({useAdminStudentPreview:()=>false}));
vi.mock("@/components/layout/MainLayout",()=>({MainLayout:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("../lesson/components/LessonPreview",()=>({LessonPreview:()=> <p>Ordinary lesson content</p>}));
vi.mock("../lesson/components/LessonQnA",()=>({LessonQnA:()=>null}));
vi.mock("../lesson/components/LessonReportDialog",()=>({LessonReportDialog:()=>null}));
vi.mock("../course_review/components/CourseReviewPrompt",()=>({CourseReviewPrompt:()=>null}));
const progress={courseId:7,courseName:"Java course",assessmentStatus:"IN_PROGRESS",progressPercentage:0,totalLessons:2,completedLessons:0,lessons:[{lessonId:8,sectionId:1,title:"Read",contentType:"VIDEO"},{lessonId:9,sectionId:1,title:"Quiz lesson",contentType:"QUIZ"}]};
const exams=[{id:5,title:"Lesson quiz",lessonId:9,sectionId:1},{id:6,title:"Section assessment",sectionId:1},{id:7,title:"Final exam",category:"FINAL_TEST"}];
function Location() {const l=useLocation(); return <output aria-label="Current location">{l.pathname}{l.search}</output>;}
function mount(url="/enrollments/183/learn?lessonId=8") { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[url]}><Routes><Route path="/enrollments/:id/learn" element={<><CourseLearningPage/><Location/></>}/></Routes></MemoryRouter></QueryClientProvider>); }
beforeEach(()=>{vi.clearAllMocks(); vi.mocked(progressApi.getByEnrollment).mockResolvedValue(progress as never);vi.mocked(progressApi.recordAccess).mockResolvedValue(progress as never);vi.mocked(examApi.listByCourse).mockResolvedValue(exams as never);vi.mocked(getExamPreparation).mockImplementation(async id=>({exam:{id,title:`Overview ${id}`,durationMinutes:30,maxAttempts:2},questionCount:4,attemptsUsed:0,attemptsRemaining:2,canStart:true,attempts:[]}) as never);});
it.each([5,6,7])("deep links embed assessment %s with curriculum and no attempt creation",async id=>{
 mount(`/enrollments/183/learn?lessonId=9&assessmentId=${id}`);
 expect(await screen.findByRole("heading",{name:`Overview ${id}`})).toBeInTheDocument();
 expect(screen.getByText("Course progress")).toBeInTheDocument();expect(startOrResumeExam).not.toHaveBeenCalled();
 expect(screen.queryByText("Ordinary lesson content")).not.toBeInTheDocument();
});
it("selecting an assessment lesson opens its preparation directly",async()=>{
 const user=userEvent.setup();mount();await screen.findByText("Ordinary lesson content");
 await user.click(screen.getByRole("button",{name:/Quiz lesson/}));expect(await screen.findByRole("heading",{name:"Overview 5"})).toBeInTheDocument();
 expect(startOrResumeExam).not.toHaveBeenCalled();
});
it("selecting a section assessment writes durable selection and highlights its row",async()=>{
 const user=userEvent.setup();mount();await user.click(await screen.findByRole("button",{name:"Section assessment"}));
 await screen.findByRole("heading",{name:"Overview 6"});expect(screen.getByRole("button",{name:"Section assessment"})).toHaveAttribute("aria-current","page");
 await waitFor(()=>expect(screen.getByLabelText("Current location")).toHaveTextContent("assessmentId=6"));
});
it("next item follows the curriculum through the final exam",async()=>{
 vi.mocked(getExamPreparation).mockImplementation(async id=>({exam:{id,title:`Overview ${id}`,durationMinutes:30,maxAttempts:2},questionCount:4,attemptsUsed:1,attemptsRemaining:1,canStart:true,attempts:[{summary:{id:100+id,attemptNumber:1,status:"SUBMITTED",resultPublished:true,finalScore:8,passed:true},canReview:false}]}) as never);
 const user=userEvent.setup(); mount("/enrollments/183/learn?lessonId=9&assessmentId=6");
 await user.click(await screen.findByRole("button",{name:"Next item"}));
 expect(await screen.findByRole("heading",{name:"Overview 7"})).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Next item"})).toBeDisabled();
});

it("next lesson visits the section assessment before the next section video",async()=>{
 const lessonA={lessonId:8,sectionId:1,title:"Last lesson in section",contentType:"LINK"};
 const lessonB={lessonId:10,sectionId:2,title:"Next section video",contentType:"VIDEO"};
 const p={...progress,lessons:[lessonA,lessonB]};
 vi.mocked(progressApi.getByEnrollment).mockResolvedValue(p as never);vi.mocked(progressApi.recordAccess).mockResolvedValue(p as never);
 vi.mocked(examApi.listByCourse).mockResolvedValue([{id:6,title:"Section assessment",sectionId:1},{id:7,title:"Final exam",category:"FINAL_TEST"}] as never);
 const user=userEvent.setup();mount();await screen.findByText("Ordinary lesson content");
 await user.click(screen.getByRole("button",{name:"Next lesson"}));
 expect(await screen.findByRole("heading",{name:"Overview 6"})).toBeInTheDocument();expect(startOrResumeExam).not.toHaveBeenCalled();
 // Navigation is available before starting, including backwards to the preceding lesson.
 await user.click(screen.getByRole("button",{name:"Previous item"}));await screen.findByText("Ordinary lesson content");
 await user.click(screen.getByRole("button",{name:"Next lesson"}));await screen.findByRole("heading",{name:"Overview 6"});
 await user.click(screen.getByRole("button",{name:"Next item"}));await screen.findByText("Ordinary lesson content");
 expect(screen.getByLabelText("Current location")).toHaveTextContent("lessonId=10");
 // Previous lesson crosses the section boundary through the assessment too.
 await user.click(screen.getByRole("button",{name:"Previous lesson"}));
 expect(await screen.findByRole("heading",{name:"Overview 6"})).toBeInTheDocument();
});
it("next lesson visits a lesson-linked quiz without starting it",async()=>{
 vi.mocked(examApi.listByCourse).mockResolvedValue([{id:5,title:"Lesson quiz",lessonId:8,sectionId:1}] as never);
 const user=userEvent.setup();mount();await screen.findByText("Ordinary lesson content");
 await user.click(screen.getByRole("button",{name:"Next lesson"}));
 expect(await screen.findByRole("heading",{name:"Overview 5"})).toBeInTheDocument();expect(startOrResumeExam).not.toHaveBeenCalled();
});
it("the last ordinary lesson leads to the final exam",async()=>{
 vi.mocked(examApi.listByCourse).mockResolvedValue([{id:7,title:"Final exam",category:"FINAL_TEST"}] as never);
 const user=userEvent.setup();mount("/enrollments/183/learn?lessonId=9");
 await screen.findByText("No linked assessment is currently available.");await user.click(screen.getByRole("button",{name:"Next lesson"}));
 expect(await screen.findByRole("heading",{name:"Overview 7"})).toBeInTheDocument();
});
