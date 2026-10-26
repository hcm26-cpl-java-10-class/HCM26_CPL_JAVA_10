import { Logout } from "@/components/auth/Logout";
import { OAuth2RedirectHandler } from "@/components/auth/OAuth2RedirectHandler";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import { Login } from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { Unauthorized } from "@/pages/error/Unauthorized";
import { Dashboard } from "@/pages/management/dashboard";
import CurriculumManagementPage from "@/pages/management/demo/curriculum";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";
import SyllabusesPage from "@/pages/management/demo/syllabus";
import SyllabusDetailPage from "@/pages/management/demo/syllabus/detail";

import StudentSyllabusPage from "@/pages/student/StudentSyllabusPage";
import CourseReportPage from "@/pages/management/demo/report";

import MyCertificatesPage from "@/pages/student/MyCertificatesPage";
import VerifyCertificatePage from "@/pages/student/VerifyCertificatePage";

export interface RouteConfig {
  path: string;
  component: ComponentType;
  requiredPermission?: string;
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const ROLE_HOME_PATHS = ["/dashboard", "/student", "/teacher"] as const;

export const routes: RouteConfig[] = [
  { path: "/dashboard", component: Dashboard },
  { path: "/student", component: StudentLandingPage },
  { path: "/teacher", component: TeacherLandingPage },
  {
    path: "/topic-marks/gradebook-demo",
    component: TopicMarkGradebookDemoPage,
    requiredPermission: "STUDENT_SCORE_READ",
    isModuleDriven: true,
  },

  {
    path: "/syllabuses",
    component: SyllabusesPage,
    requiredPermission: "SYLLABUS_READ",
    isModuleDriven: true,
  },
  {
    path: "/syllabuses/:id",
    component: SyllabusDetailPage,
    requiredPermission: "SYLLABUS_READ",
    isModuleDriven: false,
  },
  {
    path: "/syllabuses/:id/preview",
    component: StudentSyllabusPage,
    requiredPermission: "SYLLABUS_READ",
    isModuleDriven: false,
  },
  {
    path: "/my-certificates",
    component: MyCertificatesPage,
    isModuleDriven: false,
  },
  {
    path: "/verify-certificate/:verificationToken",
    component: VerifyCertificatePage,
    isPublic: true,
    isModuleDriven: false,
  },

  ...buildEntityRoutes(),
  { path: "/not-found-page", component: NotFoundPage, isPublic: true },
  { path: "/login", component: Login, isPublic: true },
  { path: "/logout", component: Logout, isPublic: true },
  { path: "/register", component: RegisterPage, isPublic: true },
  { path: "/forgot-password", component: ForgotPasswordPage, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true },
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
  {
    path: "/curriculum",
    component: CurriculumManagementPage,
    requiredPermission: "SECTION_READ",
    isModuleDriven: true,
  },
  {
    path: "/course-report",
    component: CourseReportPage,
    requiredPermission: "COURSE_REPORT_READ",
    isModuleDriven: true,
  },
];
