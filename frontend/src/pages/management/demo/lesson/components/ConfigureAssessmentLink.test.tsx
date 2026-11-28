import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ConfigureAssessmentLink } from "./ConfigureAssessmentLink";
const persona=vi.hoisted(()=>({role:"TEACHER",allowed:true}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({activeRole:persona.role,hasPermission:()=>persona.allowed})}));
beforeEach(()=>{persona.role="TEACHER";persona.allowed=true;});
it("links the exact saved lesson and section to course assessment configuration",()=>{
 render(<MemoryRouter initialEntries={["/curriculum?courseId=7"]}><ConfigureAssessmentLink lesson={{id:9,sectionId:3,contentType:"QUIZ"}}/></MemoryRouter>);
 expect(screen.getByRole("link",{name:"Configure assessment"})).toHaveAttribute("href","/courses/7?assessmentLessonId=9&assessmentSectionId=3#course-assessments");
});
it("explains unsaved lessons without a broken link",()=>{
 render(<MemoryRouter><ConfigureAssessmentLink lesson={{contentType:"EXAM"}}/></MemoryRouter>);expect(screen.getByText(/Save the lesson first/)).toBeInTheDocument();expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("hides management actions in Student view even with admin permissions",()=>{
 persona.role="STUDENT";render(<MemoryRouter><ConfigureAssessmentLink lesson={{id:9,courseId:7,contentType:"ASSIGNMENT"}}/></MemoryRouter>);expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("hides management actions without existing permissions",()=>{
 persona.allowed=false;render(<MemoryRouter><ConfigureAssessmentLink lesson={{id:9,courseId:7,contentType:"QUIZ"}}/></MemoryRouter>);expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
