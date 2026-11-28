import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { lessonApi } from "@/api";
import type { CourseExam } from "@/types";
import { SectionLessons } from "./SectionLessons";
vi.mock("@/api",()=>({lessonApi:{getBySection:vi.fn()}}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({activeRole:"ADMIN",hasPermission:()=>true})}));
vi.mock("./LessonFormModal",()=>({LessonFormModal:()=>null}));
vi.mock("./LessonQnA",()=>({LessonQnA:()=>null}));
vi.mock("./LessonPreview",()=>({LessonPreview:()=>null,formatDuration:(n:number)=>`${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`}));
const sectionOnly={id:11,title:"123",sectionId:3,courseId:7,lessonId:null,category:"QUIZ",durationMinutes:60,courseWeight:20} as CourseExam;
function mount(exams:CourseExam[]) {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><SectionLessons sectionId={3} assessments={exams} assessmentsReady canManageAssessments/></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{vi.mocked(lessonApi.getBySection).mockResolvedValue([{id:1,title:"Video",sectionId:3,contentType:"VIDEO",duration:600,orderIndex:0}]);});
it("shows a pre-existing section-only assessment once with distinct counts and units",async()=>{
 mount([sectionOnly,sectionOnly,{...sectionOnly,id:99,title:"Other section",sectionId:4}]);
 expect(await screen.findByText("123")).toBeInTheDocument();expect(screen.queryByText("Other section")).not.toBeInTheDocument();
 expect(screen.getByText(/1 lesson · 1 assessments/)).toBeInTheDocument();expect(screen.getByText("10:00")).toBeInTheDocument();
 expect(screen.getByText(/60 min/)).toBeInTheDocument();
 const links=screen.getAllByRole("link",{name:"Configure assessment"});expect(links).toHaveLength(1);
 expect(links[0]).toHaveAttribute("href","/courses/7#course-assessments");
 expect(screen.queryByRole("link",{name:"Course grading"})).not.toBeInTheDocument();
});
it("keeps a real assessment lesson in its ordered row without a second assessment row",async()=>{
 vi.mocked(lessonApi.getBySection).mockResolvedValue([{id:9,title:"Quiz lesson",sectionId:3,courseId:7,contentType:"QUIZ",duration:0,orderIndex:1}]);
 mount([{...sectionOnly,lessonId:9}]);await screen.findByText("Quiz lesson");
 expect(screen.getAllByRole("row")).toHaveLength(2);expect(screen.getAllByRole("link",{name:"Configure assessment"})).toHaveLength(1);
 expect(within(screen.getAllByRole("row")[1]).getByText("60 min")).toBeInTheDocument();
});
it("shows assessments even when there are no ordinary lessons",async()=>{
 vi.mocked(lessonApi.getBySection).mockResolvedValue([]);mount([sectionOnly]);await screen.findByText("123");expect(screen.queryByText("No lessons yet")).not.toBeInTheDocument();
});
it("shows and allows retry of lesson request failures",async()=>{
 vi.mocked(lessonApi.getBySection).mockRejectedValue(new Error("offline"));mount([sectionOnly]);expect(await screen.findByRole("alert")).toHaveTextContent("Could not load lessons");
});

it("keeps distinct assessment IDs even when titles match",async()=>{
 mount([sectionOnly,{...sectionOnly,id:12}]);await screen.findAllByText("123");
 expect(screen.getAllByRole("link",{name:"Configure assessment"})).toHaveLength(2);
 expect(screen.queryByRole("link",{name:"Manage assessment"})).not.toBeInTheDocument();
});

it("still opens preview for an explicit Q&A notification deep link",async()=>{
 const consumed=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><SectionLessons sectionId={3} deepLink={{lessonId:1,questionId:2}} onDeepLinkConsumed={consumed}/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByRole("dialog")).toHaveTextContent("Lesson preview");expect(consumed).toHaveBeenCalledTimes(1);
});
