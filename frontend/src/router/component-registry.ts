import WeeklyCalendarPage from "@/pages/management/calendar/WeeklyCalendarPage";
import ScheduleVersionListPage from "@/pages/management/demo/schedule_version";
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
import TopicManagementPage from "@/pages/management/training/topic/TopicManagementPage";
import ProgramManagementPage from "@/pages/management/training/program/ProgramManagementPage";
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
  { path: "/training/audit", component: AuditPage, isModuleDriven: true },
  { path: "/training/trainee", component: TraineePage, isModuleDriven: true },
  { path: "/training/log-work", component: LogWorkPage, isModuleDriven: true },
  { path: "/training/content", component: TopicManagementPage, isModuleDriven: true },
  { path: "/subjects", component: TopicManagementPage, requiredPermission: "SUBJECT_READ", isModuleDriven: true },
  { path: "/topics", component: TopicManagementPage, requiredPermission: "SUBJECT_READ" },
  { path: "/training/topics", component: TopicManagementPage, requiredPermission: "SUBJECT_READ" },
  { path: "/programs", component: ProgramManagementPage, requiredPermission: "PROGRAM_READ", isModuleDriven: true },
  { path: "/training/programs", component: ProgramManagementPage, requiredPermission: "PROGRAM_READ" },
  { path: "/class-setup", component: ContentPage, requiredPermission: "CLASS_READ", isModuleDriven: true },
  { path: "/training/reports", component: ReportsPage, isModuleDriven: true },
  // Class List is a sidebar module (registered by the backend as /classes); the detail pages are reached from it
  { path: "/classes", component: ClassListPage, requiredPermission: "SESSION_READ", isModuleDriven: true },
  { path: "/classes/:classId", component: ClassDetailPage, requiredPermission: "SESSION_READ" },
  { path: "/training-operations/class-details/:classCode", component: ClassDetailPage, requiredPermission: "SESSION_READ" },
  { path: "/class-details/:classId", component: ClassDetailPage, requiredPermission: "SESSION_READ" },
  { path: "/sessions/:sessionId", component: SessionDetailPage, requiredPermission: "SESSION_READ" },
  { path: "/calendar/preview", component: WeeklyCalendarPage, requiredPermission: "SESSION_READ", isModuleDriven: true },
  { path: "/schedule-versions", component: ScheduleVersionListPage, requiredPermission: "SESSION_READ", isModuleDriven: true },
  { path: "/calendar/adjust", component: ScheduleVersionListPage, requiredPermission: "SESSION_READ", isModuleDriven: true },
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
  { path: "/topic-marks", component: TopicMarkGradebookDemoPage, requiredPermission: "STUDENT_SCORE_READ", isModuleDriven: true },
  { path: "/student", component: StudentLandingPage, requiredPermission: "BOOK_READ", isModuleDriven: true },
  { path: "/student/exams", component: StudentExamList, requiredPermission: "EXAM_READ", isModuleDriven: true },
  { path: "/teacher", component: TeacherLandingPage, requiredPermission: "BOOK_UPDATE", isModuleDriven: true },
  ...buildEntityRoutes(),

  { path: "/not-found-page", component: NotFoundPage, isPublic: true },
  { path: "/login", component: Login, isPublic: true },
  { path: "/logout", component: Logout, isPublic: true },
  { path: "/register", component: RegisterPage, isPublic: true },
  { path: "/forgot-password", component: ForgotPasswordPage, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true },
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
];
