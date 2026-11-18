import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { getExamPreparation, startOrResumeExam } from "@/api/exam.api";
import StudentExamPreparationPage from "./StudentExamPreparationPage";
vi.mock("@/api/exam.api",()=>({getExamPreparation:vi.fn(),startOrResumeExam:vi.fn()}));
vi.mock("@/components/layout/MainLayout",()=>({MainLayout:({children}:{children:ReactNode})=><main>{children}</main>}));
const data={exam:{id:5,title:"Java Final",durationMinutes:60,maxAttempts:2,maxScore:10},questionCount:10,passScore:6,attemptsUsed:0,attemptsRemaining:2,canStart:true,canResume:false,unavailableReason:null,antiCheatEnabled:false,requireFullscreen:false,cameraProctoring:false,attempts:[]};
function Destination(){const l=useLocation();return <p>Destination {l.pathname}{l.search}</p>;}
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/student/exams/5/prepare?returnTo=%2Fenrollments%2F183%2Flearn%3FlessonId%3D8"]}><Routes><Route path="/student/exams/:examId/prepare" element={<StudentExamPreparationPage/>}/><Route path="*" element={<Destination/>}/></Routes></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getExamPreparation).mockResolvedValue(data as never);vi.mocked(startOrResumeExam).mockResolvedValue({id:9,examId:5,status:"IN_PROGRESS"} as never);});
it("opening overview consumes nothing; only explicit start enters taking with course context",async()=>{
 const user=userEvent.setup();mount();expect(await screen.findByRole("heading",{name:"Java Final"})).toBeInTheDocument();expect(startOrResumeExam).not.toHaveBeenCalled();
 expect(screen.getByText("10 questions")).toBeInTheDocument();await user.click(screen.getByRole("button",{name:"Start assessment"}));
 await waitFor(()=>expect(startOrResumeExam).toHaveBeenCalledTimes(1));expect(await screen.findByText(/Destination \/student\/exams\/5\/take/)).toHaveTextContent("returnTo=%2Fenrollments%2F183%2Flearn%3FlessonId%3D8");
});
it("exhausted attempts cannot start and a course return remains available",async()=>{
 vi.mocked(getExamPreparation).mockResolvedValue({...data,canStart:false,attemptsUsed:2,attemptsRemaining:0,unavailableReason:"No attempts left"} as never);
 const user=userEvent.setup();mount();expect(await screen.findByText("No attempts left")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Try again"})).toBeDisabled();
 await user.click(screen.getByRole("button",{name:"Back to course"}));expect(await screen.findByText(/Destination \/enrollments\/183\/learn/)).toHaveTextContent("?lessonId=8");expect(startOrResumeExam).not.toHaveBeenCalled();
});
it("resume is explicit and does not require a password for an active attempt",async()=>{
 vi.mocked(getExamPreparation).mockResolvedValue({...data,exam:{...data.exam,hasPassword:true},canStart:false,canResume:true,attemptsUsed:1,attemptsRemaining:1} as never);
 const user=userEvent.setup();mount();expect(await screen.findByRole("button",{name:"Resume assessment"})).toBeEnabled();expect(screen.queryByLabelText("Assessment password")).not.toBeInTheDocument();expect(startOrResumeExam).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button",{name:"Resume assessment"}));await waitFor(()=>expect(startOrResumeExam).toHaveBeenCalledTimes(1));
});

it("unpublished attempts show publication state and preserve course context into permitted submission review",async()=>{
 vi.mocked(getExamPreparation).mockResolvedValue({...data,attemptsUsed:1,attempts:[{summary:{id:9,attemptNumber:1,status:"SUBMITTED",resultPublished:false,finalScore:null},canReview:true}]} as never);
 const user=userEvent.setup();mount();expect(await screen.findByText("Result awaiting publication")).toBeInTheDocument();expect(screen.queryByText(/^Score:/)).not.toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"View my submission"}));expect(await screen.findByText(/Destination \/student\/exams\/attempts\/9\/review/)).toHaveTextContent("returnTo=%2Fenrollments%2F183%2Flearn%3FlessonId%3D8");
});
