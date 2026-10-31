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
import ExamManagementPage from "@/pages/management/exam";
import InvitationManagementPage from "@/pages/management/invitation";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";
import TeamAllocationPage from "@/pages/management/team-allocation";
import TeamAllocationClassListPage from "@/pages/management/team-allocation/class-list";
import StudentExamList from "@/pages/student/StudentExamList";
import StudentLandingPage from "@/pages/student/StudentLandingPage";
import ExploreProjectsPage from "@/pages/student/projects/explore";
import StudentProjectDetailPage from "@/pages/student/projects/detail";
import StudentDraftTeamPage from "@/pages/student/draft-team";
import ProjectTemplateVersionPage from "@/pages/management/project-template-version";
import TeacherLandingPage from "@/pages/teacher/TeacherLandingPage";
import { MilestoneCreatePage } from "@/pages/management/project/milestone/pages/MilestoneCreatePage";
import { MilestoneDetailPage } from "@/pages/management/project/milestone/pages/MilestoneDetailPage";
import { MilestoneListPage } from "@/pages/management/project/milestone/pages/MilestoneListPage";
import { MilestoneEntryPage } from "@/pages/management/project/milestone/pages/MilestoneEntryPage";
import { TeamMilestoneDetailPage } from "@/pages/management/project/milestone/pages/TeamMilestoneDetailPage";
import TeamArtifactSubmissionPage from "@/pages/student/TeamArtifactSubmissionPage";
import TeamMilestoneSubmissionsPage from "@/pages/management/project/milestone/pages/TeamMilestoneSubmissionsPage";
import { RubricListPage } from "@/pages/management/project/rubric/pages/RubricListPage";
import { RubricCreatePage } from "@/pages/management/project/rubric/pages/RubricCreatePage";
import { RubricDetailPage } from "@/pages/management/project/rubric/pages/RubricDetailPage";
import { RubricEditPage } from "@/pages/management/project/rubric/pages/RubricEditPage";
import { SubmissionListPage } from "@/pages/management/project/milestone-submission/pages/SubmissionListPage";
import { SubmissionReviewPage } from "@/pages/management/project/milestone-submission/pages/SubmissionReviewPage";
import { StudentSubmissionPage } from "@/pages/student/milestone-submission/StudentSubmissionPage";
import { StudentSubmissionListPage } from "@/pages/student/milestone-submission/StudentSubmissionListPage";
import WorkspaceCandidatePage from "@/pages/management/workspace/WorkspaceCandidatePage";
import WorkspaceDetailPage from "@/pages/management/workspace/WorkspaceDetailPage";
import { createElement} from "react";
import { Navigate } from "react-router-dom";
import TaskManagementPage from "@/pages/management/task";
import ProjectAlertsPage from "@/pages/management/alerts";
import ProjectTemplateListPage from "@/pages/management/project-template";
import { ProjectTemplateFormPage } from "@/pages/management/project-template/pages/ProjectTemplateFormPage";
import { ProjectTemplateDetailPage } from "@/pages/management/project-template/pages/ProjectTemplateDetailPage";
import ArtifactDraftPage from "@/pages/student/ArtifactDraftPage";
import StudentTeamMilestoneSubmissionsPage from "@/pages/student/StudentTeamMilestoneSubmissionsPage";
import type { ComponentType } from "react";
import { buildEntityRoutes } from "./build-router";


export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  requiredPermission?: string;
  requiredPermissions?: string[];
  isPublic?: boolean;
  isModuleDriven?: boolean;
}

export const routes: RouteConfig[] = [
  // Dashboard is the default landing page for administrators. Keep this route
  // available while the backend-driven sidebar is still loading; otherwise a
  // successful login can temporarily fall through to the blank 404 redirect.
  { path: "/dashboard", component: Dashboard, requiredPermission: "USER_READ" },
  { path: "/exams", component: ExamManagementPage, isModuleDriven: true },
  { path: "/tasks", component: TaskManagementPage, requiredPermission: "TASK_READ" },
  { path: "/management/alerts", component: ProjectAlertsPage, requiredPermission: "PROJECT_ALERT_READ" },
  { path: "/tasks/create", component: TaskManagementPage, requiredPermission: "TASK_CREATE" },
  { path: "/tasks/:id/edit", component: TaskManagementPage, requiredPermission: "TASK_UPDATE" },
  { path: "/tasks/:id/detail", component: TaskManagementPage, requiredPermission: "TASK_READ" },
  { path: "/project-templates", component: ProjectTemplateListPage, requiredPermission: "PROJECT_TEMPLATE_READ" },
  { path: "/project-template-versions", component: ProjectTemplateVersionPage, requiredPermission: "PROJECT_TEMPLATE_READ" },
  { path: "/project-templates/create", component: ProjectTemplateFormPage, requiredPermission: "PROJECT_TEMPLATE_CREATE" },
  { path: "/project-templates/:id/edit", component: ProjectTemplateFormPage, requiredPermission: "PROJECT_TEMPLATE_UPDATE" },
  { path: "/project-templates/:id/detail", component: ProjectTemplateDetailPage, requiredPermission: "PROJECT_TEMPLATE_READ" },
  {
    path: "/invitations",
    component: InvitationManagementPage,
    requiredPermission: "INVITATION_READ",
    isModuleDriven: true,
  },
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
  {
    path: "/team-allocation",
    component: TeamAllocationClassListPage,
    requiredPermission: "PEO_TEAM_ALLOCATE",
    isModuleDriven: true,
  },
  {
    path: "/team-allocation/classes/:classId",
    component: TeamAllocationPage,
    requiredPermissions: ["PEO_TEAM_ALLOCATE", "PRJ_WORKSPACE_MANAGE"],
  },
  { path: "/student", component: StudentLandingPage, requiredPermission: "BOOK_READ" },
  { path: "/student/exams", component: StudentExamList,requiredPermission: "EXAM_READ", isModuleDriven: true },
  {
    // US-09: mock Project Template catalogue (Project Management tab).
    // Module-driven: `useSidebarMenus` injects the matching student module
    // entry, and `App` resolves it through the module-driven component map.
    // Without `isModuleDriven`, the injected module route would shadow this
    // route with a "missing component" redirect (page not found).
    // No permission string because the Project Template module is not seeded
    // yet; access is limited to authenticated users, and the data scope is
    // mocked in `mocks/project-templates.mock.ts`.
    path: "/student/projects/explore",
    component: ExploreProjectsPage,
    isModuleDriven: true,
  },
  {
    // US-09 / AC02: full project brief on its own page (no modal).
    // Reached from a catalogue card on `/student/projects/explore`.
    path: "/student/projects/detail/:projectId",
    component: StudentProjectDetailPage,
  },
  {
    // US-10: the student (team leader) screen that assigns a project template
    // to the DRAFT teams they lead. Authenticated users only; the backend
    // enforces ownership (team role PM) and the capacity window.
    path: "/student/draft-team",
    component: StudentDraftTeamPage,
    isModuleDriven: true,
  },
  { path: "/teacher", component: TeacherLandingPage, requiredPermission: "BOOK_UPDATE" },
  { path: "/project-board", component: ProjectBoardPage },
  { path: "/workspaces/candidates", component: WorkspaceCandidatePage, requiredPermission: "WORKSPACE_READ" },
  { path: "/management/workspaces", component: WorkspaceCandidatePage, requiredPermission: "WORKSPACE_READ" },
  { path: "/management/workspaces/candidates", component: WorkspaceCandidatePage, requiredPermission: "WORKSPACE_READ" },
  { path: "/management/workspaces/:id", component: WorkspaceDetailPage, requiredPermission: "WORKSPACE_READ" },
  { path: "/management/project-teams", component: () => createElement(Navigate, { to: "/management/workspaces/candidates", replace: true }), requiredPermission: "WORKSPACE_READ" },
  { path: "/milestones", component: MilestoneListPage, requiredPermission: "MILESTONE_READ" },
  { path: "/milestones/teams", component: MilestoneEntryPage, requiredPermission: "MILESTONE_READ" },
  { path: "/projects/:projectId/milestones", component: MilestoneListPage, requiredPermission: "MILESTONE_READ" },
  { path: "/teams/:teamId/milestones/new", component: MilestoneCreatePage, requiredPermission: "MILESTONE_WRITE" },
  { path: "/teams/:teamId/milestones/:milestoneId/edit", component: MilestoneCreatePage, requiredPermission: "MILESTONE_WRITE" },
  { path: "/teams/:teamId/milestones/:milestoneId", component: TeamMilestoneDetailPage, requiredPermission: "MILESTONE_READ" },
  { path: "/teams/:teamId/milestones/:milestoneId/submit", component: TeamArtifactSubmissionPage, requiredPermission: "ARTIFACT_READ" },
  { path: "/teams/:teamId/milestones/:milestoneId/submissions", component: TeamMilestoneSubmissionsPage },
  { path: "/student/teams/:teamId/milestones/:milestoneId/submissions", component: StudentTeamMilestoneSubmissionsPage, requiredPermission: "ARTIFACT_READ" },
  {
    path: "/projects/:projectId/milestones/new",
    component: MilestoneCreatePage,
  },
  { path: "/projects/:projectId/milestones/:milestoneId/edit", component: MilestoneCreatePage, requiredPermission: "MILESTONE_WRITE" },
  {
    path: "/projects/:projectId/milestones/:milestoneId",
    component: MilestoneDetailPage,
  },
  {
    path: "/projects/:projectId/milestones/:milestoneId/submit",
    component: ArtifactDraftPage,
    requiredPermission: "ARTIFACT_READ",
  },
  { path: "/rubrics", component: RubricListPage },
  { path: "/rubrics/new", component: RubricCreatePage },
  { path: "/rubrics/:rubricId", component: RubricDetailPage },
  { path: "/rubrics/:rubricId/versions/:versionId/edit", component: RubricEditPage },
  { path: "/milestone-submissions", component: SubmissionListPage },
  { path: "/milestone-submissions/:submissionId/review", component: SubmissionReviewPage },
  { path: "/milestone-submissions/:submissionId", component: SubmissionReviewPage },
  { path: "/student/milestone-submissions", component: StudentSubmissionListPage },
  { path: "/student/milestone-submissions/:submissionId", component: StudentSubmissionPage },
  { path: "/student/milestone-submissions/:submissionId/edit", component: StudentSubmissionPage },
  ...buildEntityRoutes(),

  { path: "/not-found-page", component: NotFoundPage, isPublic: true },
  { path: "/login", component: Login, isPublic: true },
  { path: "/logout", component: Logout, isPublic: true },
  { path: "/register", component: RegisterPage, isPublic: true },
  { path: "/forgot-password", component: ForgotPasswordPage, isPublic: true },
  { path: "/oauth2/redirect", component: OAuth2RedirectHandler, isPublic: true },
  { path: "/unauthorized", component: Unauthorized, isPublic: true },
];
