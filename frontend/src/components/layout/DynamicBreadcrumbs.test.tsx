import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import DynamicBreadcrumbs from "./DynamicBreadcrumbs";
vi.mock("@/hooks/useSidebarMenus.ts",()=>({useActiveModuleGroups:()=>({data:[]})}));
it.each(["/student/exams/5/prepare", "/student/exams/5/take", "/student/exams/attempts/9/review"])("keeps full student assessment links at %s", path=>{
 render(<MemoryRouter initialEntries={[path]}><DynamicBreadcrumbs variant="student" ignorePaths={["attempts"]}/></MemoryRouter>);
 expect(screen.getByRole("link",{name:"Exams"})).toHaveAttribute("href","/student/exams");expect(screen.getByRole("link",{name:"Student Home"})).toHaveAttribute("href","/student");
});
it("retains hidden prefixes on other student routes",()=>{
 render(<MemoryRouter initialEntries={["/student/projects/detail/4"]}><DynamicBreadcrumbs variant="student" ignorePaths={["detail"]}/></MemoryRouter>);
 expect(screen.getByRole("link",{name:"Projects"})).toHaveAttribute("href","/student/projects");
});
