import { Logout } from "@/components/auth/Logout";
import { OAuth2RedirectHandler } from "@/components/auth/OAuth2RedirectHandler";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import { Login } from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { Unauthorized } from "@/pages/error/Unauthorized";
import { Dashboard } from "@/pages/management/dashboard";
import ExamManagementPage from "@/pages/management/exam";
import InvitationManagementPage from "@/pages/management/invitation";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";
import AuditPage from "@/pages/management/training/audit";
import TraineePage from "@/pages/management/training/trainee";
import LogWorkPage from "@/pages/management/training/log-work";
import ContentPage from "@/pages/management/training/content";
import ReportsPage from "@/pages/management/training/reports";
import ClassListPage from "@/pages/management/training/class/ClassListPage";
import ClassDetailPage from "@/pages/management/training/class/ClassDetailPage";
import SessionDetailPage from "@/pages/management/demo/session/SessionDetailPage";


export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  requiredPermission?: string;
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const routes: RouteConfig[] = [
  { path: "/training/audit", component: AuditPage },
  { path: "/training/trainee", component: TraineePage },
  { path: "/training/log-work", component: LogWorkPage },
  { path: "/training/content", component: ContentPage },
  { path: "/training/reports", component: ReportsPage },
  // Class List is a sidebar module (registered by the backend as /classes); the detail pages are reached from it
  { path: "/classes", component: ClassListPage, requiredPermission: "SESSION_READ", isModuleDriven: true },
  { path: "/classes/:classId", component: ClassDetailPage, requiredPermission: "SESSION_READ" },
  { path: "/sessions/:sessionId", component: SessionDetailPage, requiredPermission: "SESSION_READ" },
  { path: "/dashboard", component: Dashboard, isModuleDriven: true },
  { path: "/exams", component: ExamManagementPage, isModuleDriven: true },
  {
    path: "/invitations",
    component: InvitationManagementPage,
    requiredPermission: "INVITATION_READ",
    isModuleDriven: true,
  },
  {
    path: "/topic-marks/gradebook-demo",
    component: TopicMarkGradebookDemoPage,
    requiredPermission: "STUDENT_SCORE_READ",
    isModuleDriven: true,
  },
  { path: "/student", component: StudentLandingPage, requiredPermission: "BOOK_READ" },
  { path: "/student/exams", component: StudentExamList,requiredPermission: "EXAM_READ", isModuleDriven: true },
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
