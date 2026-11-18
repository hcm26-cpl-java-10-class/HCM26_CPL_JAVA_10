import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { LessonProgressSidebar } from "./LessonProgressSidebar";
import type { CourseExam, EnrollmentProgress } from "@/types";
const exam={id:5,title:"Assessment A",lessonId:10,sectionId:1,locked:false} as CourseExam;
const progress={progressPercentage:100,completedLessons:1,totalLessons:1,lessons:[{lessonId:10,sectionId:1,title:"Quiz lesson",sectionTitle:"Section",contentType:"QUIZ",completed:true}]} as EnrollmentProgress;
it.each(["PASSED","FAILED","AWAITING_RESULTS","COMPLETED","IN_PROGRESS"] as const)("shows %s on assessment lesson and linked exam, independently of completion flag",state=>{
 render(<LessonProgressSidebar onLessonSelect={()=>{}} progress={{...progress,assessmentOutcomes:{5:state}}} exams={[exam]}/>);
 const label={PASSED:"Passed",FAILED:"Failed",AWAITING_RESULTS:"Awaiting results",COMPLETED:"Completed (no pass requirement)",IN_PROGRESS:"In progress"}[state];
 expect(screen.getAllByRole("img",{name:label})).toHaveLength(2);
 if(state!=="PASSED") expect(screen.queryByRole("img",{name:"Passed"})).not.toBeInTheDocument();
});
it("does not use legacy lesson completion to fabricate a passing result",()=>{
 render(<LessonProgressSidebar onLessonSelect={()=>{}} progress={progress} exams={[exam]}/>);
 expect(screen.queryByRole("img",{name:"Passed"})).not.toBeInTheDocument();
});
it("shows results for section and final exams too",()=>{
 const exams=[{...exam,id:6,lessonId:null,title:"Section exam"},{...exam,id:7,lessonId:null,sectionId:null,category:"FINAL_TEST",title:"Final"}] as CourseExam[];
 render(<LessonProgressSidebar onLessonSelect={()=>{}} progress={{...progress,assessmentOutcomes:{6:"FAILED",7:"PASSED"}}} exams={exams}/>);
 expect(screen.getByRole("img",{name:"Failed"})).toBeInTheDocument();expect(screen.getByRole("img",{name:"Passed"})).toBeInTheDocument();
});
