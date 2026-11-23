import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { it, expect, vi } from "vitest";
import ExamCurriculumPage from "./ExamCurriculumPage";
vi.mock("@/components/layout/MainLayout",()=>({MainLayout:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/pages/management/demo/course/components/CourseAssessmentPanel",()=>({CourseAssessmentPanel:()=>null}));
vi.mock("@/api/features/demo/course.api",()=>({courseApi:{getPage:async()=>({content:[]})}}));
vi.mock("@/api/features/demo/section.api",()=>({sectionApi:{getByCourse:async()=>[]}}));
vi.mock("@/api/features/exam.api",()=>({examApi:{listByCourse:async()=>[]}}));
vi.mock("./components/LinkExamModal",()=>({LinkExamModal:()=>null}));
function mount(query:string) {return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[`/exams/curriculum${query}`]}><ExamCurriculumPage/></MemoryRouter></QueryClientProvider>);}
it("has an explicit reload-safe return button above the mapping content",async()=>{
 mount("?courseId=7&returnTo=%2Fcourse-enrollments%2F7%3Fpage%3D2%23course-assessments");
 expect(await screen.findByRole("link",{name:"Back to course"})).toHaveAttribute("href","/course-enrollments/7?page=2#course-assessments");
});
it("direct mapping links fall back to the selected course",async()=>{
 mount("?courseId=9");expect(await screen.findByRole("link",{name:"Back to course"})).toHaveAttribute("href","/courses/9#course-assessments");
});
