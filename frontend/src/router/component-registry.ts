import { Logout } from "@/components/auth/Logout";
import { OAuth2RedirectHandler } from "@/components/auth/OAuth2RedirectHandler";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import { Login } from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { Unauthorized } from "@/pages/error/Unauthorized";
import { Dashboard } from "@/pages/management/dashboard";
import ExamManagementPage from "@/pages/management/exam";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentExamTakingPage from "@/pages/student/StudentExamTakingPage";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import MyScoresPage from "@/pages/student/MyScoresPage";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";


export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  requiredPermission?: string;
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const routes: RouteConfig[] = [
  { path: "/dashboard", component: Dashboard, isModuleDriven: true },
  { path: "/exams", component: ExamManagementPage, isModuleDriven: true },

  {
    path: "/topic-marks/gradebook-demo",
    component: TopicMarkGradebookDemoPage,
    requiredPermission: "STUDENT_SCORE_READ",
    isModuleDriven: true,
  },
  { path: "/student", component: StudentLandingPage, requiredPermission: "BOOK_READ" },
  { path: "/student/exams", component: StudentExamList, requiredPermission: "EXAM_READ", isModuleDriven: true },
  { path: "/student/exams/:examId/take", component: StudentExamTakingPage, requiredPermission: "EXAM_TAKE" },
  { path: "/my-scores", component: MyScoresPage, requiredPermission: "STUDENT_SCORE_VIEW_OWN", isModuleDriven: true },
  { path: "/teacher", component: TeacherLandingPage, requiredPermission: "BOOK_UPDATE" },
  ...buildEntityRoutes(),

  { path: "/not-found-page", component: NotFoundPage, isPublic: true },
  { path: "/login", component: Login, isPublic: true },
  { path: "/logout", component: Logout, isPublic: true },
  { path: "/register", component: RegisterPage, isPublic: true },
  { path: "/forgot-password", component: ForgotPasswordPage, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true,},
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
];
