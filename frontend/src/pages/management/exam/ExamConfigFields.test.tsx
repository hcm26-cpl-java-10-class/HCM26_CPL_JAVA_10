import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { ExamConfigFields } from "./ExamConfigFields";
import { DEFAULT_CONFIG, buildExamRequest, validateConfig } from "./examConfig";
it("retains shared field labels, errors, defaults and passing-score validation",async()=>{
 function Form(){const[cfg,setCfg]=useState({...DEFAULT_CONFIG});return <ExamConfigFields title="Quiz" setTitle={()=>{}} duration="60" setDuration={()=>{}} cfg={cfg} setCfg={setCfg} showErrors showCourseLink={false}/>;}
 render(<Form/>);expect(screen.getByRole("combobox",{name:"Exam type"})).toHaveAttribute("aria-invalid","true");
 expect(screen.getByText("Max Score")).toBeInTheDocument();expect(screen.getByText("Passing Score")).toBeInTheDocument();
 const passing=screen.getByRole("spinbutton",{name:/Passing Score/});await userEvent.type(passing,"6");expect(passing).toHaveValue(6);
 const cfg={...DEFAULT_CONFIG,examType:"MULTIPLE_CHOICE" as const,category:"QUIZ" as const,maxAttempts:"1"};
 const request=buildExamRequest("Quiz","60",cfg,true);expect(request.maxScore).toBeUndefined();expect(request.passScore).toBe(5);
 expect(validateConfig(60,{...cfg,maxScore:"10",passScore:"11"})).toBeTruthy();
});
