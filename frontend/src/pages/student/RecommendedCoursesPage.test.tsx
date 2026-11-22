import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { it, expect, vi } from "vitest";
import RecommendedCoursesPage from "./RecommendedCoursesPage";
vi.mock("@/components/layout/MainLayout",()=>({MainLayout:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/pages/management/demo/course/components/CourseRecommendations",()=>({CourseRecommendations:({search}:{search:string})=><output>{search}</output>}));
it("shows English-only destination labels and its independent search context",()=>{
 render(<MemoryRouter initialEntries={["/student/recommendations?q=Java"]}><RecommendedCoursesPage/></MemoryRouter>);
 expect(screen.getByRole("heading",{name:"For you"})).toBeInTheDocument();expect(screen.getByRole("link",{name:"Browse all courses"})).toHaveAttribute("href","/courses");
 expect(screen.getByRole("textbox",{name:"Search recommendations"})).toHaveValue("Java");expect(screen.getByRole("status")).toHaveTextContent("Java");
});
