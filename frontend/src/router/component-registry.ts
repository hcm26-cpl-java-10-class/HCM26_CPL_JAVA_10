import CourseResourcesPage from "@/pages/management/demo/enrollment/CourseResourcesPage";
import { Logout } from "@/components/auth/Logout";
import { OAuth2RedirectHandler } from "@/components/auth/OAuth2RedirectHandler";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import { Login } from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFoundPage from "@/pages/error/NotFoundPage";
import { Unauthorized } from "@/pages/error/Unauthorized";
import WeeklyCalendarPage from "@/pages/management/calendar/WeeklyCalendarPage";
import ClassSetupPage from "@/pages/management/class-setup";
import TeachingAssignmentPage from "@/pages/management/teaching-assignment";
import StudySessionPage from "@/pages/management/study-session";
import BulkScheduleGenerationPage from "@/pages/management/schedule-generation";
import { Dashboard } from "@/pages/management/dashboard";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import ExamManagementPage from "@/pages/management/exam";
import { ModuleGroupModulePage } from "@/pages/management/fams/ModuleGroupModulePage";
import InvitationManagementPage from "@/pages/management/invitation";
import ScheduleValidationPage from "@/pages/management/schedule-validation";
import TrainingProgramDetailPage from "@/pages/management/program/TrainingProgramDetail";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import { ModuleGroupsPage } from "@/pages/management/fams/ModuleGroupsPage";
import { ModulesPage } from "@/pages/management/fams/ModulesPage";
import { PersonalProfilePage } from "@/pages/management/profile";
import { MyLearningPage } from "@/pages/management/learning";
import LearningCoursesEntry from "@/pages/management/learning/LearningCoursesEntry";
import CourseDetailPage from "@/pages/management/demo/course/CourseDetailPage";
import CourseEnrollmentsPage from "@/pages/management/demo/enrollment/CourseEnrollmentsPage";
import ScheduleVersionListPage from "@/pages/management/demo/schedule_version";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";
import { LocationPage } from "@/pages/management/rbac/location";
import AuditLogPage from "@/pages/management/audit-log";

export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  requiredPermission?: string;
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const routes: RouteConfig[] = [
  ...["certificates", "unanswered-questions", "lesson-reports", "enrollment-logs"].map((path) => ({
    path: `/${path}`,
    component: CourseResourcesPage,
    requiredPermission: "ADMIN_ACCESS",
  })),
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

  // Compatibility & Module Group routes
  { path: "/menu-groups", component: ModuleGroupsPage, requiredPermission: "MENU_READ" },
  { path: "/menus", component: ModulesPage, requiredPermission: "MENU_READ" },
  { path: "/fams/module-group-module", component: ModuleGroupModulePage, requiredPermission: "MENU_READ" },
  { path: "/module-group-module", component: ModuleGroupModulePage, requiredPermission: "MENU_READ" },
  { path: "/module-groups", component: ModuleGroupsPage, requiredPermission: "MENU_READ" },
  { path: "/modules", component: ModulesPage, requiredPermission: "MENU_READ" },

  // Management, Study Sessions & Scheduling routes
  { path: "/study-sessions", component: StudySessionPage, requiredPermission: "STUDY_SESSION_READ", isModuleDriven: true },
  {
    path: "/teaching-assignments",
    component: TeachingAssignmentPage,
    requiredPermission: "ASSIGNMENT_READ",
    isModuleDriven: true,
  },
  {
    path: "/programs/:id/detail",
    component: TrainingProgramDetailPage,
    requiredPermission: "PROGRAM_READ",
  },
  {
    path: "/class-setup",
    component: ClassSetupPage,
    isModuleDriven: true,
  },
  {
    path: "/schedule-generation",
    component: BulkScheduleGenerationPage,
    isModuleDriven: true,
  },
  {
    path: "/class-schedule/generation",
    component: BulkScheduleGenerationPage,
  },
  {
    path: "/calendar/preview",
    component: WeeklyCalendarPage,
    requiredPermission: "SESSION_READ",
  },
  {
    path: "/schedule-versions",
    component: ScheduleVersionListPage,
    requiredPermission: "SESSION_READ",
    isModuleDriven: true,
  },
  {
    path: "/calendar/adjust",
    component: ScheduleVersionListPage,
    requiredPermission: "SESSION_READ",
  },
  {
    path: "/dashboard",
    component: Dashboard,
    isModuleDriven: true,
  },
  {
    path: "/exams",
    component: ExamManagementPage,
    isModuleDriven: true,
  },
  {
    path: "/locations",
    component: LocationPage,
    isPublic: true,
  },
  {
    path: "/management/rbac/locations",
    component: LocationPage,
    isPublic: true,
  },
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
  {
    path: "/schedule-validation",
    component: ScheduleValidationPage,
  },
  { path: "/student", component: StudentLandingPage, requiredPermission: "LEARNER_ACCESS" },
  { path: "/student/exams", component: StudentExamList, requiredPermission: "EXAM_READ", isModuleDriven: true },
  { path: "/teacher", component: TeacherLandingPage, requiredPermission: "ADMIN_ACCESS" },

  ...buildEntityRoutes(),

  // System & Public Error routes
  { path: "/not-found-page", component: NotFoundPage, isPublic: true },
  { path: "/login", component: Login, isPublic: true },
  { path: "/logout", component: Logout, isPublic: true },
  { path: "/register", component: RegisterPage, isPublic: true },
  { path: "/forgot-password", component: ForgotPasswordPage, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true },
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
  { path: "/admin/audit-log", component: AuditLogPage, isModuleDriven: true },
];