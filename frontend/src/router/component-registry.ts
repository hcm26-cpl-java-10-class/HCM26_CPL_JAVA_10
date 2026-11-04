
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
import ExamTemplatesPage from "@/pages/management/exam/templates";
import ResultStatisticsPage from "@/pages/management/exam/ResultStatisticsPage";
import EssayAttemptListPage from "@/pages/management/exam/grading/EssayAttemptListPage";
import EssayAttemptDetailPage from "@/pages/management/exam/grading/EssayAttemptDetailPage";
import ExamSimilarityPage from "@/pages/management/exam/similarity/ExamSimilarityPage";
import ScoreAppealsPage from "@/pages/management/exam/appeals";
import InvitationsPage from "@/pages/management/exam/invitation";
import UnifiedInvitationsPage, {
  StudentInvitationsRedirect,
} from "@/pages/invitations/InvitationsPage";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentExamTakingPage from "@/pages/student/StudentExamTakingPage";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import MyScoresPage from "@/pages/student/MyScoresPage";
import MyAppealsPage from "@/pages/student/MyAppealsPage";
import ExamReviewPage from "@/pages/student/ExamReviewPage";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import AnonymousAccessPage from "@/pages/exam/AnonymousAccessPage";
import AnonymousExamTakingPage from "@/pages/exam/AnonymousExamTakingPage";
import { ModuleGroupModulePage } from "@/pages/management/fams/ModuleGroupModulePage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";

import SyllabusesPage from "@/pages/management/demo/syllabus";
import SyllabusDetailPage from "@/pages/management/demo/syllabus/detail";
import CourseUsagePage from "@/pages/management/demo/syllabus/CourseUsagePage";
import SyllabusTemplatesPage from "@/pages/management/demo/syllabus/SyllabusTemplatesPage";

import StudentSyllabusListPage from "@/pages/student/StudentSyllabusListPage";
import StudentSyllabusPage from "@/pages/student/StudentSyllabusPage";

import CourseReportPage from "@/pages/management/demo/report";
import UnansweredQuestionsPage from "@/pages/management/demo/unanswered-questions";
import LessonReportsPage from "@/pages/management/demo/lesson-reports";
import CertificateDetailPage from "@/pages/management/demo/certificate/pages/CertificateDetailPage";
import VerifyCertificatePage from "@/pages/student/VerifyCertificatePage";
import EnrollmentLogPage from "@/pages/management/demo/enrollment/EnrollmentLogPage.tsx";

export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
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
  // FAMS MODULE GROUP MODULE
  {
    path: "/fams/module-group-module",
    component: ModuleGroupModulePage,
    isPublic: true,
  },
  {
    path: "/module-group-module",
    component: ModuleGroupModulePage,
    isPublic: true,
  },

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

  {
    path: "/management/exam/templates",
    component: ExamTemplatesPage,
    requiredPermission: "EXAM_UPDATE",
  },

  // INVITATIONS
  {
    path: "/invitations",
    component: UnifiedInvitationsPage,
    requiredPermission: "INVITATION_READ",
  },

  {
    path: "/exams/:examId/invitations",
    component: InvitationsPage,
    requiredPermission: "INVITATION_READ",
  },

  // EXAM GRADING / SIMILARITY / STATISTICS
  {
    path: "/exams/:examId/grading",
    component: EssayAttemptListPage,
    requiredPermission: "EXAM_UPDATE",
  },

  {
    path: "/exams/:examId/grading/similarity",
    component: ExamSimilarityPage,
    requiredPermission: "EXAM_UPDATE",
  },

  {
    path: "/exams/:examId/similarity",
    component: ExamSimilarityPage,
    requiredPermission: "EXAM_UPDATE",
  },

  {
    path: "/exams/:examId/grading/:attemptId",
    component: EssayAttemptDetailPage,
    requiredPermission: "EXAM_UPDATE",
  },

  {
    path: "/exams/:examId/result-statistics",
    component: ResultStatisticsPage,
    requiredPermission: "EXAM_UPDATE",
  },

  // SCORE APPEALS
  {
    path: "/exams/appeals",
    component: ScoreAppealsPage,
    requiredPermission: "SCORE_APPEAL_READ",
  },

  // ANONYMOUS EXAM ACCESS
  {
    path: "/anonymous-exam",
    component: AnonymousAccessPage,
    isPublic: true,
  },
  {
    path: "/anonymous-exam/take",
    component: AnonymousExamTakingPage,
    isPublic: true,
  },

  // STUDENT INVITATIONS
  {
    path: "/student/invitations",
    component: StudentInvitationsRedirect,
    requiredPermission: "INVITATION_READ",
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
    path: "/syllabuses/course-usage",
    component: CourseUsagePage,
    requiredPermission: "SYLLABUS_READ",
    isModuleDriven: true,
  },
  {
    path: "/syllabuses/templates",
    component: SyllabusTemplatesPage,
    requiredPermission: "SYLLABUS_CREATE",
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

  {
    path: "/student/exams/:examId/take",
    component: StudentExamTakingPage,
    requiredPermission: "EXAM_TAKE",
  },

  {
    path: "/student/exams/attempts/:attemptId/review",
    component: ExamReviewPage,
    requiredPermission: "EXAM_TAKE",
  },

  // MY SCORES / MY APPEALS
  {
    path: "/my-scores",
    component: MyScoresPage,
    requiredPermission: "STUDENT_SCORE_VIEW_OWN",
    isModuleDriven: true,
  },

  {
    path: "/my-appeals",
    component: MyAppealsPage,
    requiredPermission: "SCORE_APPEAL_VIEW_OWN",
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
    path: "/course-enrollments",
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

  // LESSON REPORTS
  {
    path: "/lesson-reports",
    component: LessonReportsPage,
    requiredPermission: "LESSON_REPORT_READ",
    isModuleDriven: true,
  },

  // ENROLLMENT LOGS
  {
    path: "/enrollment-logs",
    component: EnrollmentLogPage,
    isModuleDriven: true,
  },
];
