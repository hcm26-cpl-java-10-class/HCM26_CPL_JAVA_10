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
import { ModuleGroupsPage } from "@/pages/management/fams/ModuleGroupsPage";
import { ModulesPage } from "@/pages/management/fams/ModulesPage";
import { PersonalProfilePage } from "@/pages/management/profile";
import { MyLearningPage } from "@/pages/management/learning";
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
  { path: "/fams/ho-so-ca-nhan-oi-mat-khau", component: PersonalProfilePage, isPublic: true },
  { path: "/fams/ho-so-ca-nhan-doi-mat-khau", component: PersonalProfilePage, isPublic: true },
  { path: "/fams/profile", component: PersonalProfilePage, isPublic: true },
  { path: "/profile", component: PersonalProfilePage, isPublic: true },
  // My Learning routes
  { path: "/my-learning", component: MyLearningPage, isPublic: true },
  { path: "/fams/my-learning", component: MyLearningPage, isPublic: true },
  { path: "/learning", component: MyLearningPage, isPublic: true },
  { path: "/enrollments", component: MyLearningPage, isModuleDriven: true },

  // Compatibility routes for old combined page
  { path: "/menu-groups", component: ModuleGroupsPage, isPublic: true },
  { path: "/menus", component: ModulesPage, isPublic: true },
  { path: "/fams/module-group-module", component: ModuleGroupsPage, isPublic: true },
  { path: "/module-group-module", component: ModuleGroupsPage, isPublic: true },

  // Independent Module Groups & Modules routes
  { path: "/module-groups", component: ModuleGroupsPage, isPublic: true },
  { path: "/modules", component: ModulesPage, isPublic: true },

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
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
];
