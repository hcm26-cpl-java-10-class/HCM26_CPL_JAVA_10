import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";
vi.mock("react-redux",()=>({useSelector:()=>({isAuthenticated:true})}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({activeRole:"STUDENT",hasPermission:()=>true,hasAllPermissions:()=>true,hasAnyPermission:()=>true})}));
it.each(["/exams", "/exams/5/edit", "/exams/5/questions", "/management/exam/templates"])("student view blocks management at %s even with read/manage grants",path=>{
 render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/student/exams" element={<p>Learner assessments</p>}/><Route path="*" element={<ProtectedRoute><p>Management controls</p></ProtectedRoute>}/></Routes></MemoryRouter>);
 expect(screen.getByText("Learner assessments")).toBeInTheDocument();expect(screen.queryByText("Management controls")).not.toBeInTheDocument();
});
