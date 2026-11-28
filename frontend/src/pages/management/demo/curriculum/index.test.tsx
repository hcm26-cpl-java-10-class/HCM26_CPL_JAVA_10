import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { examApi } from "@/api";
import { courseApi } from "@/api/features/demo/course.api";
import { sectionApi } from "@/api/features/demo/section.api";
import Page from "./index";
const role=vi.hoisted(()=>({value:"ADMIN"}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({activeRole:role.value,hasPermission:()=>true})}));
vi.mock("@/api",()=>({examApi:{listByCourse:vi.fn()}}));
vi.mock("@/api/features/demo/course.api",()=>({courseApi:{getPage:vi.fn(),getById:vi.fn()}}));
vi.mock("@/api/features/demo/section.api",()=>({sectionApi:{getByCourse:vi.fn()}}));
vi.mock("@/components/layout/MainLayout",()=>({MainLayout:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock("./CourseOutlineQuickEditor",()=>({default:()=>null}));
vi.mock("@/pages/management/demo/lesson/components/SectionLessons",()=>({SectionLessons:({assessments,deepLink}:{assessments:{id:number;title:string}[];deepLink?:unknown})=><div><output data-testid="lesson-deep-link">{deepLink ? JSON.stringify(deepLink) : "none"}</output>{assessments.map(e=><p key={e.id}>{e.title}</p>)}</div>}));
function mount(path="/curriculum?courseId=7"){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[path]}><Page/></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{vi.clearAllMocks();role.value="ADMIN";vi.mocked(courseApi.getPage).mockResolvedValue({content:[{id:7,name:"Java"}]} as never);vi.mocked(sectionApi.getByCourse).mockResolvedValue({content:[{id:3,title:"Basics",orderIndex:0},{id:4,title:"Advanced",orderIndex:1}]} as never);vi.mocked(examApi.listByCourse).mockResolvedValue([{id:11,title:"123",sectionId:3,lessonId:null,courseId:7},{id:12,title:"Course final",sectionId:null,lessonId:null,courseId:7,durationMinutes:30}] as never);});
it("reads existing assessments, assigns their real section and separates course-level assessments",async()=>{
 mount();await screen.findByText("Course final");
 expect(within(screen.getByRole("region",{name:"Curriculum assessments"})).queryByText("123")).not.toBeInTheDocument();
 await userEvent.click(screen.getAllByRole("button",{name:/View Lessons/})[0]);
 expect(await screen.findByText("123")).toBeInTheDocument();
 expect(examApi.listByCourse).toHaveBeenCalledWith(7);
});
it("reports assessment read failures and retries them",async()=>{
 vi.mocked(examApi.listByCourse).mockRejectedValueOnce(new Error("offline"));mount();
 expect(await screen.findByText(/Could not load assessments/)).toBeInTheDocument();
 await userEvent.click(screen.getByRole("button",{name:"Retry assessments"}));await screen.findByText("Course final");
});
it("does not fetch management assessment data in Student view",async()=>{
 role.value="STUDENT";mount();await screen.findByText("Basics");expect(examApi.listByCourse).not.toHaveBeenCalled();expect(screen.queryByRole("region",{name:"Curriculum assessments"})).not.toBeInTheDocument();
});

it("returns to the requested section without opening lesson preview or Q&A",async()=>{
 mount("/curriculum?courseId=7&sectionId=3");
 expect(await screen.findByTestId("lesson-deep-link")).toHaveTextContent("none");
 expect(screen.getByRole("button",{name:/Hide Lessons/})).toBeInTheDocument();
});
it("preserves question notification deep links",async()=>{
 mount("/curriculum?courseId=7&sectionId=3&lessonId=9&questionId=5");
 expect(await screen.findByTestId("lesson-deep-link")).toHaveTextContent('"lessonId":9');
 expect(screen.getByTestId("lesson-deep-link")).toHaveTextContent('"questionId":5');
});
