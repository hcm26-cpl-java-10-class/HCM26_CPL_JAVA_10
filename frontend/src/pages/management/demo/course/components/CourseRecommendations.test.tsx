import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { CourseRecommendations } from "./CourseRecommendations";
import { recommendationsApi } from "@/api/features/recommendations.api";
import { recommendationHistoryKey } from "@/utils/recommendation-session";

const state=vi.hoisted(() => ({enrolled:new Map<number, unknown>()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{email:"learner@example.com"}})}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({activeRole:"STUDENT",hasPermission:()=>true})}));
vi.mock("../hooks/useCourseEnrollment",()=>({useCourseEnrollment:()=>({canEnroll:true,enrollmentByCourseId:state.enrolled,enrollMutation:{isPending:false,mutate:(id:number, options:{onSuccess:()=>void})=>{state.enrolled.set(id,{});options.onSuccess();}}})}));
vi.mock("./CourseCard",()=>({CourseCard:({course,onEnroll}:{course:{id:number,name:string},onEnroll:(id:number)=>void})=><div data-testid="course-card">{course.name}<button onClick={()=>onEnroll(course.id)}>Enroll {course.id}</button></div>,CourseCardSkeleton:()=>null}));
vi.mock("@/api/features/recommendations.api",()=>({recommendationsApi:{get:vi.fn(),ask:vi.fn(),save:vi.fn(),dismiss:vi.fn(),reset:vi.fn()}}));
const items=Array.from({length:13},(_,i)=>({course:{id:i+1,name:`Course ${i+1}`,description:"Java",instructor:"Teacher",categoryName:i%2===0?"Development":"Data",level:i%2===0?"BEGINNER":"ADVANCED",totalDuration:(i+1)*3600,averageRating:4+(i%5)/10,totalReviews:i+1,lessonCount:1,isFree:true,enrolled:false},reason:"Matches your goals"}));
const result={recommendations:items,preferences:{goals:"Java",interests:["Java"]},state:"READY"};
function mount(search="") {const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><CourseRecommendations search={search}/></QueryClientProvider>);}
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();state.enrolled.clear();vi.mocked(recommendationsApi.get).mockResolvedValue(result as never);});
it("shows six cards per page and resets after dismissal and enrollment",async()=>{
 const user=userEvent.setup();mount();expect(await screen.findAllByTestId("course-card")).toHaveLength(6);
 await user.click(screen.getByRole("button",{name:"Next"}));expect(screen.getByText("Page 2 / 3")).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Next"}));expect(screen.getAllByTestId("course-card")).toHaveLength(1);
 vi.mocked(recommendationsApi.get).mockResolvedValue({...result,recommendations:items.slice(0,12)} as never);
 await user.click(screen.getByRole("button",{name:"Dismiss Course 13"}));await waitFor(()=>expect(screen.getByText("Page 1 / 2")).toBeInTheDocument());
 await user.click(screen.getByRole("button",{name:"Next"}));await user.click(screen.getByRole("button",{name:"Enroll 12"}));
 await waitFor(()=>expect(screen.getByText("Page 1 / 2")).toBeInTheDocument());expect(screen.getAllByTestId("course-card")).toHaveLength(6);
});
it("cleans saved IDs, submits with Enter, and paginates AI-selected results",async()=>{
 sessionStorage.setItem(recommendationHistoryKey("learner@example.com"),JSON.stringify([{role:"assistant",content:"Java (ID 42)"}]));
 vi.mocked(recommendationsApi.ask).mockResolvedValue({...result,reply:"Try Java (ID 42)",aiStatus:"AVAILABLE"} as never);
 const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"Ask AI to help me choose"}));
 expect(screen.queryByText(/ID 42/)).not.toBeInTheDocument();
 await user.type(screen.getByRole("textbox",{name:"Your course question"}),"Java{Enter}");
 await waitFor(()=>expect(recommendationsApi.ask).toHaveBeenCalledTimes(1));await waitFor(()=>expect(screen.queryByText("Choosing courses…")).not.toBeInTheDocument());
 expect(screen.queryByText(/ID 42/)).not.toBeInTheDocument();expect(screen.getAllByTestId("course-card")).toHaveLength(6);
 await user.click(screen.getByRole("button",{name:"Next"}));expect(screen.getByText("Page 2 / 3")).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Clear chat"}));expect(screen.queryByText("Java",{exact:true})).not.toBeInTheDocument();
});
it("search changes reset to the first page and empty searches show a state",async()=>{
 const user=userEvent.setup();const view=mount();await screen.findAllByTestId("course-card");await user.click(screen.getByRole("button",{name:"Next"}));
 // A fresh render of the same account receives the catalog search from its parent.
 const client=new QueryClient();view.rerender(<QueryClientProvider client={client}><CourseRecommendations search="missing"/></QueryClientProvider>);
 await waitFor(()=>expect(screen.queryAllByTestId("course-card")).toHaveLength(0));expect(await screen.findByText(/No recommended courses match your search/)).toBeInTheDocument();
});
it("shows accurate filter counts and resets pagination when filters change",async()=>{
 const user=userEvent.setup();mount();await screen.findAllByTestId("course-card");await user.click(screen.getByRole("button",{name:"Next"}));
 expect(screen.getAllByLabelText("Beginner (7)")).toHaveLength(2);
 await user.click(screen.getAllByLabelText("Beginner (7)")[0]);
 await waitFor(()=>expect(screen.getByText("Page 1 / 2")).toBeInTheDocument());
 expect(screen.getAllByTestId("course-card")).toHaveLength(6);
});

it("saving preferences resets recommendation pages and applies the refreshed matches",async()=>{
 const user=userEvent.setup();mount();await screen.findAllByTestId("course-card");await user.click(screen.getByRole("button",{name:"Next"}));
 await user.click(screen.getByRole("button",{name:"Learning preferences"}));
 await user.clear(screen.getByRole("textbox",{name:"Learning goals"}));await user.type(screen.getByRole("textbox",{name:"Learning goals"}),"Java beginner");
 vi.mocked(recommendationsApi.get).mockResolvedValue({...result,recommendations:items.slice(0,7)} as never);
 await user.click(screen.getByRole("button",{name:"Save preferences"}));
 await waitFor(()=>expect(screen.getByText("Page 1 / 2")).toBeInTheDocument());expect(screen.getAllByTestId("course-card")).toHaveLength(6);
 expect(recommendationsApi.save).toHaveBeenCalledTimes(1);
});
it("clear chat discards a provider response that arrives after cancellation",async()=>{
 let finish!: (value: never)=>void;
 vi.mocked(recommendationsApi.ask).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"Ask AI to help me choose"}));
 await user.type(screen.getByRole("textbox",{name:"Your course question"}),"Java{Enter}");await waitFor(()=>expect(recommendationsApi.ask).toHaveBeenCalledTimes(1));
 await user.click(screen.getByRole("button",{name:"Clear chat"}));
 await act(async()=>finish({...result,reply:"STALE PROVIDER RESPONSE",aiStatus:"AVAILABLE"} as never));
 expect(screen.queryByText(/STALE PROVIDER RESPONSE/)).not.toBeInTheDocument();
});

it("retries a failed question once without duplicating it in provider history",async()=>{
 vi.mocked(recommendationsApi.ask).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({...result,reply:"A useful reply",aiStatus:"AVAILABLE"} as never);
 const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"Ask AI to help me choose"}));
 await user.type(screen.getByRole("textbox",{name:"Your course question"}),"Learn Java{Enter}");
 await user.click(await screen.findByRole("button",{name:"Retry message"}));
 expect(await screen.findByText("A useful reply")).toBeInTheDocument();
 expect(vi.mocked(recommendationsApi.ask).mock.calls[1][1]).toEqual([]);
 expect(screen.getAllByText("Learn Java",{exact:true})).toHaveLength(1);
 expect(screen.getByRole("log")).not.toHaveTextContent("Course 13");
});
it("Stop restores the draft and ignores a late response",async()=>{
 let finish!: (value:never)=>void;vi.mocked(recommendationsApi.ask).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"Ask AI to help me choose"}));
 await user.type(screen.getByRole("textbox",{name:"Your course question"}),"Java{Enter}");await user.click(await screen.findByRole("button",{name:"Stop"}));
 expect(screen.getByRole("textbox",{name:"Your course question"})).toHaveValue("Java");
 await act(async()=>finish({...result,reply:"CANCELLED REPLY",aiStatus:"AVAILABLE"} as never));expect(screen.queryByText("CANCELLED REPLY")).not.toBeInTheDocument();
});
it("keeps Shift+Enter as a newline and starter prompts as editable drafts",async()=>{
 const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"Ask AI to help me choose"}));
 await user.click(screen.getByRole("button",{name:"Help me choose a beginner course"}));
 const input=screen.getByRole("textbox",{name:"Your course question"});expect(input).toHaveFocus();expect(input).toHaveValue("Help me choose a beginner course");
 await user.type(input,"{Shift>}{Enter}{/Shift}More details");expect(input).toHaveValue("Help me choose a beginner course\nMore details");expect(recommendationsApi.ask).not.toHaveBeenCalled();
});
