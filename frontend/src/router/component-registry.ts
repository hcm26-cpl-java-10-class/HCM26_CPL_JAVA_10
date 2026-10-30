
import { Logout } from "@/components/auth/Logout";
import { OAuth2RedirectHandler } from "@/components/auth/OAuth2RedirectHandler";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import { Login } from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { Unauthorized } from "@/pages/error/Unauthorized";
import { Dashboard } from "@/pages/management/dashboard";
import CurriculumManagementPage from "@/pages/management/demo/curriculum";
import RolePermissionMatrixPage from "@/pages/management/rbac/permission/RolePermissionMatrixPage";
import ExamManagementPage from "@/pages/management/exam";
import InvitationManagementPage from "@/pages/management/invitation";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";

import SyllabusesPage from "@/pages/management/demo/syllabus";
import SyllabusDetailPage from "@/pages/management/demo/syllabus/detail";

import StudentSyllabusListPage from "@/pages/student/StudentSyllabusListPage";
import StudentSyllabusPage from "@/pages/student/StudentSyllabusPage";

import CourseReportPage from "@/pages/management/demo/report";
import UnansweredQuestionsPage from "@/pages/management/demo/unanswered-questions";
import CertificateDetailPage from "@/pages/management/demo/certificate/pages/CertificateDetailPage";
import VerifyCertificatePage from "@/pages/student/VerifyCertificatePage";
import EnrollmentLogPage from "@/pages/management/demo/enrollment/EnrollmentLogPage.tsx";

export interface RouteConfig {
  path: string;
  component: ComponentType;
  requiredPermission?: string;
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const ROLE_HOME_PATHS = [
  "/dashboard",
  "/student",
  "/teacher",
] as const;

export const routes: RouteConfig[] = [
  // ROLE HOME
  {
    path: "/dashboard",
    component: Dashboard,
  },
  {
    path: "/student",
    component: StudentLandingPage,
  },
  {
    path: "/teacher",
    component: TeacherLandingPage,
  },

  // DASHBOARD
  {
    path: "/dashboard",
    component: Dashboard,
    isModuleDriven: true,
  },

  // RBAC
  {
    path: "/role-permissions",
    component: RolePermissionMatrixPage,
    requiredPermission: "ROLE_UPDATE",
  },

  // EXAMS
  {
    path: "/exams",
    component: ExamManagementPage,
    isModuleDriven: true,
  },

  // INVITATIONS
  {
    path: "/invitations",
    component: InvitationManagementPage,
    requiredPermission: "INVITATION_READ",
    isModuleDriven: true,
  },

  // TOPIC MARKS
  {
    path: "/topic-marks/gradebook-demo",
    component: TopicMarkGradebookDemoPage,
    requiredPermission: "STUDENT_SCORE_READ",
    isModuleDriven: true,
  },

  // M3 ADMIN / TEACHER
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

  // M3 STUDENT VIEW
  {
    path: "/student/syllabuses",
    component: StudentSyllabusListPage,
    requiredPermission: "COURSE_READ",
    isModuleDriven: false,
  },
  {
    path: "/student/syllabuses/:id",
    component: StudentSyllabusPage,
    requiredPermission: "COURSE_READ",
    isModuleDriven: false,
  },

  // CERTIFICATES
  {
    path: "/my-certificates/:verificationToken",
    component: CertificateDetailPage,
    isModuleDriven: false,
  },
  {
    path: "/verify-certificate/:verificationToken",
    component: VerifyCertificatePage,
    isPublic: true,
    isModuleDriven: false,
  },

  // STUDENT
  {
    path: "/student",
    component: StudentLandingPage,
    requiredPermission: "BOOK_READ",
  },
  {
    path: "/student/exams",
    component: StudentExamList,
    requiredPermission: "EXAM_READ",
    isModuleDriven: true,
  },

  // TEACHER
  {
    path: "/teacher",
    component: TeacherLandingPage,
    requiredPermission: "BOOK_UPDATE",
  },

  // DYNAMIC ENTITY ROUTES
  ...buildEntityRoutes(),

  // AUTHENTICATION
  {
    path: "/not-found-page",
    component: NotFoundPage,
    isPublic: true,
  },
  {
    path: "/login",
    component: Login,
    isPublic: true,
  },
  {
    path: "/logout",
    component: Logout,
    isPublic: true,
  },
  {
    path: "/register",
    component: RegisterPage,
    isPublic: true,
  },
  {
    path: "/forgot-password",
    component: ForgotPasswordPage,
    isPublic: true,
  },
  {
    path: "/oauth2/redirect",
    component: OAuth2RedirectHandler,
    isPublic: true,
  },
  {
    path: "/unauthorized",
    component: Unauthorized,
    isPublic: true,
  },

  // CURRICULUM
  {
    path: "/curriculum",
    component: CurriculumManagementPage,
    requiredPermission: "SECTION_READ",
    isModuleDriven: true,
  },

  // COURSE REPORT
  {
    path: "/course-report",
    component: CourseReportPage,
    requiredPermission: "COURSE_REPORT_READ",
    isModuleDriven: true,
  },

  // Q&A
  {
    path: "/unanswered-questions",
    component: UnansweredQuestionsPage,
    requiredPermission: "LESSON_ANSWER_CREATE",
    isModuleDriven: true,
  },

  // ENROLLMENT LOGS
  {
    path: "/enrollment-logs",
    component: EnrollmentLogPage,
    isModuleDriven: true,
  },
];
