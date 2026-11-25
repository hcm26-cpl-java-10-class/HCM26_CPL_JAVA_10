import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { it, expect, vi } from "vitest";
import RecommendedCoursesPage from "./RecommendedCoursesPage";
import userEvent from "@testing-library/user-event";
import type { RecommendationFilters } from "@/pages/management/demo/course/components/recommendation-filters";
vi.mock("@/components/layout/MainLayout",()=>({MainLayout:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/pages/management/demo/course/components/CourseRecommendations",()=>({CourseRecommendations:({search,filters,onFiltersChange,onPageChange}:{search:string;filters:RecommendationFilters;onFiltersChange:(value:RecommendationFilters)=>void;onPageChange:(page:number)=>void})=><><output>{search}</output><button onClick={()=>{onFiltersChange({...filters,levels:["BEGINNER"]});onPageChange(1);}}>Choose beginner</button><span data-testid="selected-level">{filters.levels.join(",")}</span></>}));
it("shows English-only destination labels and its independent search context",()=>{
 render(<MemoryRouter initialEntries={["/student/recommendations?q=Java"]}><RecommendedCoursesPage/></MemoryRouter>);
 expect(screen.getByRole("heading",{name:"For you"})).toBeInTheDocument();expect(screen.getByRole("link",{name:"Browse all courses"})).toHaveAttribute("href","/courses");
 expect(screen.getByRole("textbox",{name:"Search recommendations"})).toHaveValue("Java");expect(screen.getByRole("status")).toHaveTextContent("Java");
});
it("retains a changed filter when resetting a later URL page in the same event",async()=>{
 render(<MemoryRouter initialEntries={["/student/recommendations?q=Java&page=2"]}><RecommendedCoursesPage/></MemoryRouter>);
 await userEvent.setup().click(screen.getByRole("button",{name:"Choose beginner"}));
 expect(screen.getByTestId("selected-level")).toHaveTextContent("BEGINNER");
 expect(screen.getByRole("textbox",{name:"Search recommendations"})).toHaveValue("Java");
});
