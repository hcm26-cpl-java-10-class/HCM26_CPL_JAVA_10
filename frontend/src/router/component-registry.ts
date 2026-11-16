import CourseResourcesPage from "@/pages/management/demo/enrollment/CourseResourcesPage";
import { Logout } from "@/components/auth/Logout";
import { OAuth2RedirectHandler } from "@/components/auth/OAuth2RedirectHandler";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import { Login } from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { Unauthorized } from "@/pages/error/Unauthorized";
import ProjectBoardPage from "@/pages/project/ProjectBoardPage";
import BacklogPage from "@/pages/management/backlog";
import { Dashboard } from "@/pages/management/dashboard";
import CurriculumManagementPage from "@/pages/management/demo/curriculum";
import RolePermissionMatrixPage from "@/pages/management/rbac/permission/RolePermissionMatrixPage";
import ExamManagementPage from "@/pages/management/exam";
import ExamDetailPage from "@/pages/management/exam/ExamDetailPage";
import ExamTemplatesPage from "@/pages/management/exam/templates";
import EssayAttemptDetailPage from "@/pages/management/exam/grading/EssayAttemptDetailPage";
import ExamSimilarityPage from "@/pages/management/exam/similarity/ExamSimilarityPage";
import ScoreAppealsPage from "@/pages/management/exam/appeals";
import UnifiedInvitationsPage, {
  StudentInvitationsRedirect,
} from "@/pages/invitations/InvitationsPage";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import TeamAllocationPage from "@/pages/management/team-allocation";
import TeamAllocationSetupPage from "@/pages/management/team-allocation/setup";
import TeamAllocationClassListPage from "@/pages/management/team-allocation/class-list";
import ProjectAssignmentPage from "@/pages/management/team-allocation/ProjectAssignmentPage";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentExamTakingPage from "@/pages/student/StudentExamTakingPage";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import ExploreProjectsPage from "@/pages/student/projects/explore";
import StudentProjectDetailPage from "@/pages/student/projects/detail";
import StudentDraftTeamPage from "@/pages/student/draft-team";
import ProjectTemplateVersionPage from "@/pages/management/project-template-version";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import { ModuleGroupsPage } from "@/pages/management/fams/ModuleGroupsPage";
import { ModulesPage } from "@/pages/management/fams/ModulesPage";
import { PersonalProfilePage } from "@/pages/management/profile";
import { MyLearningPage } from "@/pages/management/learning";
import LearningCoursesEntry from "@/pages/management/learning/LearningCoursesEntry";
import CourseDetailPage from "@/pages/management/demo/course/CourseDetailPage";
import CourseEnrollmentsPage from "@/pages/management/demo/enrollment/CourseEnrollmentsPage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";
import AuditLogPage from "@/pages/management/audit-log";

import SyllabusesPage from "@/pages/management/demo/syllabus";
import SyllabusDetailPage from "@/pages/management/demo/syllabus/detail";
import CreateCourseFromSyllabusPage from "@/pages/management/demo/syllabus/CreateCourseFromSyllabusPage";
import SyllabusCourseWorkspacePage from "@/pages/management/demo/syllabus/SyllabusCourseWorkspacePage";
import CourseUsagePage from "@/pages/management/demo/syllabus/CourseUsagePage";
import SyllabusTemplatesPage from "@/pages/management/demo/syllabus/SyllabusTemplatesPage";

import StudentSyllabusListPage from "@/pages/student/StudentSyllabusListPage";
import StudentSyllabusPage from "@/pages/student/StudentSyllabusPage";

import CourseReportPage from "@/pages/management/demo/report";
import StudentAnalyticsPage from "@/pages/management/analytics/StudentAnalyticsPage";
import CourseAnalyticsPage from "@/pages/management/demo/analytics";
import { CourseEnrollmentDetailPage } from "@/pages/management/demo/course/pages/CourseEnrollmentDetailPage";
import UnansweredQuestionsPage from "@/pages/management/demo/unanswered-questions";
import LessonReportsPage from "@/pages/management/demo/lesson-reports";
import CertificateDetailPage from "@/pages/management/demo/certificate/pages/CertificateDetailPage";
import VerifyCertificatePage from "@/pages/student/VerifyCertificatePage";
import EnrollmentLogPage from "@/pages/management/demo/enrollment/EnrollmentLogPage.tsx";
import DepartmentManagementPage from "@/pages/management/demo/department";
import LocationPage from "@/pages/management/rbac/location";
import CourseGradeDetailPage from "@/pages/student/CourseGradeDetailPage";

export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  requiredPermission?: string;
  requiredPermissions?: string[];
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const ROLE_HOME_PATHS = [
  "/dashboard",
  "/student",
  "/teacher",
] as const;

export const routes: RouteConfig[] = [
  ...["certificates","unanswered-questions","lesson-reports","enrollment-logs"].map(path=>({path:`/${path}`,component:CourseResourcesPage,requiredPermission:"ADMIN_ACCESS"})),
  { path: "/fams/ho-so-ca-nhan-oi-mat-khau", component: PersonalProfilePage },
  { path: "/fams/ho-so-ca-nhan-doi-mat-khau", component: PersonalProfilePage },
  { path: "/fams/profile", component: PersonalProfilePage },
  { path: "/profile", component: PersonalProfilePage },

  // Courses & Enrollments routes
  { path: "/courses", component: LearningCoursesEntry },
  { path: "/courses/:id", component: CourseDetailPage },
  { path: "/course-enrollments", component: CourseEnrollmentsPage },
  { path: "/enrollments", component: CourseEnrollmentsPage },

  // My Learning routes
  { path: "/my-learning", component: MyLearningPage },
  { path: "/fams/my-learning", component: MyLearningPage },
  { path: "/learning", component: MyLearningPage },

  // Compatibility routes for old combined page
  { path: "/menu-groups", component: ModuleGroupsPage, requiredPermission: "MENU_READ" },
  { path: "/menus", component: ModulesPage, requiredPermission: "MENU_READ" },
  { path: "/fams/module-group-module", component: ModuleGroupsPage, requiredPermission: "MENU_READ" },
  { path: "/module-group-module", component: ModuleGroupsPage, requiredPermission: "MENU_READ" },

  // Independent Module Groups & Modules routes
  { path: "/module-groups", component: ModuleGroupsPage, requiredPermission: "MENU_READ" },
  { path: "/modules", component: ModulesPage, requiredPermission: "MENU_READ" },

  { path: "/dashboard", component: Dashboard, isModuleDriven: true },
  { path: "/exams", component: ExamManagementPage, isModuleDriven: true },
 {
    path: "/locations",
    component: LocationPage,  
    requiredPermission: "LOCATION_READ",
  },
  {
    path: "/management/rbac/locations",
    component: LocationPage,
    requiredPermission: "LOCATION_READ",

  },
  {
    path: "/invitations",
    component: UnifiedInvitationsPage,
    requiredPermission: "INVITATION_READ",
  },

  // One page per exam with 5 tabs: Edit, Questions, Grading, Invitations, Statistics.
  {
    path: "/exams/:examId",
    component: ExamDetailPage,
    requiredPermission: "EXAM_UPDATE",
  },
  {
    path: "/exams/:examId/questions",
    component: ExamDetailPage,
    requiredPermission: "EXAM_UPDATE",
  },
  {
    path: "/exams/:examId/edit",
    component: ExamDetailPage,
    requiredPermission: "EXAM_UPDATE",
  },
  {
    path: "/exams/:examId/grading",
    component: ExamDetailPage,
    requiredPermission: "EXAM_UPDATE",
  },
  {
    path: "/exams/:examId/invitations",
    component: ExamDetailPage,
    requiredPermission: "INVITATION_READ",
  },
  {
    path: "/exams/:examId/result-statistics",
    component: ExamDetailPage,
    requiredPermission: "EXAM_UPDATE",
  },

  {
    path: "/exams/:examId/similarity",
    component: ExamSimilarityPage,
    requiredPermission: "EXAM_UPDATE",
  },
  {
    path: "/exams/:examId/grading/similarity",
    component: ExamSimilarityPage,
    requiredPermission: "EXAM_UPDATE",
  },

  {
    path: "/exams/:examId/grading/:attemptId",
    component: EssayAttemptDetailPage,
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
    // Student backlog view (also served at /sprints for non-admin roles).
    path: "/backlogs",
    component: BacklogPage,
    requiredPermission: "SPRINT_READ",
    isModuleDriven: false,
  },
  {
    path: "/topic-marks/gradebook-demo",
    component: TopicMarkGradebookDemoPage,
    requiredPermission: "STUDENT_SCORE_READ",
    isModuleDriven: true,
  },
  { path: "/student", component: StudentLandingPage, requiredPermission: "LEARNER_ACCESS" },
  { path: "/student/exams", component: StudentExamList,requiredPermission: "EXAM_READ", isModuleDriven: true },
  { path: "/teacher", component: TeacherLandingPage, requiredPermission: "ADMIN_ACCESS" },
  ...buildEntityRoutes(),

  { path: "/not-found-page", component: NotFoundPage, isPublic: true },
  { path: "/login", component: Login, isPublic: true },
  { path: "/logout", component: Logout, isPublic: true },
  { path: "/register", component: RegisterPage, isPublic: true },
  { path: "/forgot-password", component: ForgotPasswordPage, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true },
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
  {path: "/admin/audit-log", component: AuditLogPage, isModuleDriven: true },
];
