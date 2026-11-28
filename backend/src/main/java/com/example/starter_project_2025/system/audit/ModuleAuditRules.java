package com.example.starter_project_2025.system.audit;

import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Role;
import org.springframework.stereotype.Component;

import java.time.temporal.Temporal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Audit rules of the business actions of the other modules (course, syllabus, exam, score, project, workspace...).
 * <p>
 * One line per audited method:
 * rule(service class, method, action, entity type, idFromResult, idArgIndex, "inputName", argIndex, ...)
 * <ul>
 *   <li>idFromResult = true: the entity id is taken from the returned object (create); otherwise from the
 *       argument at idArgIndex (-1 = none).</li>
 *   <li>The listed inputs are written as the "new value" of the log (simple values and request objects only).</li>
 * </ul>
 * Only the outermost audited call of a request is logged (see {@link AuditRuleInterceptor}).
 * To audit one more method add a line here, or create your own {@link AuditRuleProvider}.
 */
@Component
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ModuleAuditRules implements AuditRuleProvider {

    @Override
    public List<AuditRule> auditRules() {
        return List.of(
                rule("CourseFromSyllabusService", "create", AuditAction.CREATE, "COURSE", true, -1, "request", 0),
                rule("CourseFromSyllabusService", "createCustomized", AuditAction.CREATE, "COURSE", true, -1, "payload", 0),
                rule("CourseReviewServiceImpl", "createReview", AuditAction.CREATE, "COURSE_REVIEW", true, 0, "courseId", 0, "request", 1),
                rule("CourseReviewServiceImpl", "updateMyReview", AuditAction.UPDATE, "COURSE_REVIEW", false, 0, "courseId", 0, "request", 1),
                rule("CourseReviewServiceImpl", "deleteMyReview", AuditAction.DELETE, "COURSE_REVIEW", false, 0, "courseId", 0),
                rule("CourseBundleImportService", "importBundle", AuditAction.IMPORT, "COURSE", false, -1),
                rule("CurriculumServiceImpl", "reorder", AuditAction.UPDATE, "CURRICULUM", false, 0, "courseId", 0, "request", 1),
                rule("CourseEnrollmentService", "enrollStudent", AuditAction.CREATE, "COURSE_ENROLLMENT", true, 1, "studentId", 0, "courseId", 1),
                rule("CourseEnrollmentService", "enrollDepartment", AuditAction.CREATE, "COURSE_ENROLLMENT", true, 1, "departmentId", 0, "courseId", 1),
                rule("CourseEnrollmentService", "enrollDepartments", AuditAction.CREATE, "COURSE_ENROLLMENT", true, 0, "courseId", 0),
                rule("LessonReportService", "create", AuditAction.CREATE, "LESSON_REPORT", true, 1, "lessonId", 1, "reason", 2, "detail", 3),
                rule("LessonReportService", "resolve", AuditAction.RESOLVE, "LESSON_REPORT", false, 1, "reportId", 1),
                rule("LessonQnaService", "createQuestion", AuditAction.CREATE, "LESSON_QUESTION", true, 1, "lessonId", 1, "content", 2),
                rule("LessonQnaService", "updateQuestion", AuditAction.UPDATE, "LESSON_QUESTION", false, 2, "lessonId", 1, "questionId", 2, "content", 3),
                rule("LessonQnaService", "deleteQuestion", AuditAction.DELETE, "LESSON_QUESTION", false, 2, "lessonId", 1, "questionId", 2),
                rule("LessonQnaService", "createAnswer", AuditAction.CREATE, "LESSON_ANSWER", true, 2, "lessonId", 1, "questionId", 2, "content", 3),
                rule("LessonQnaService", "updateAnswer", AuditAction.UPDATE, "LESSON_ANSWER", false, 3, "lessonId", 1, "questionId", 2, "answerId", 3, "content", 4),
                rule("LessonQnaService", "deleteAnswer", AuditAction.DELETE, "LESSON_ANSWER", false, 3, "lessonId", 1, "questionId", 2, "answerId", 3),
                rule("LessonQnaService", "acceptAnswer", AuditAction.ACCEPT, "LESSON_ANSWER", false, 3, "lessonId", 1, "questionId", 2, "answerId", 3),
                rule("AiCourseBuilderService", "apply", AuditAction.APPLY, "COURSE", false, -1, "request", 0),
                rule("SyllabusService", "create", AuditAction.CREATE, "SYLLABUS", true, -1, "input", 0),
                rule("SyllabusService", "update", AuditAction.UPDATE, "SYLLABUS", false, 0, "id", 0, "input", 1),
                rule("SyllabusService", "delete", AuditAction.DELETE, "SYLLABUS", false, 0, "id", 0),
                rule("SyllabusService", "updateInformation", AuditAction.UPDATE, "SYLLABUS", false, 0, "syllabusId", 0, "input", 1),
                rule("SyllabusService", "createSection", AuditAction.CREATE, "SYLLABUS_SECTION", true, 0, "syllabusId", 0, "input", 1),
                rule("SyllabusService", "bulkCreateSections", AuditAction.CREATE, "SYLLABUS_SECTION", false, 0, "syllabusId", 0, "input", 1),
                rule("SyllabusService", "updateSection", AuditAction.UPDATE, "SYLLABUS_SECTION", false, 1, "syllabusId", 0, "sectionId", 1, "input", 2),
                rule("SyllabusService", "deleteSection", AuditAction.DELETE, "SYLLABUS_SECTION", false, 1, "syllabusId", 0, "sectionId", 1),
                rule("SyllabusService", "createTopic", AuditAction.CREATE, "SYLLABUS_TOPIC", true, 1, "syllabusId", 0, "sectionId", 1, "input", 2),
                rule("SyllabusService", "updateTopic", AuditAction.UPDATE, "SYLLABUS_TOPIC", false, 2, "syllabusId", 0, "sectionId", 1, "topicId", 2, "input", 3),
                rule("SyllabusService", "deleteTopic", AuditAction.DELETE, "SYLLABUS_TOPIC", false, 2, "syllabusId", 0, "sectionId", 1, "topicId", 2),
                rule("SyllabusCloService", "create", AuditAction.CREATE, "SYLLABUS_CLO", true, 0, "syllabusId", 0, "input", 1),
                rule("SyllabusCloService", "createBulk", AuditAction.CREATE, "SYLLABUS_CLO", false, 0, "syllabusId", 0, "input", 1),
                rule("SyllabusCloService", "update", AuditAction.UPDATE, "SYLLABUS_CLO", false, 1, "syllabusId", 0, "cloId", 1, "input", 2),
                rule("SyllabusCloService", "delete", AuditAction.DELETE, "SYLLABUS_CLO", false, 1, "syllabusId", 0, "cloId", 1),
                rule("SyllabusCoverageService", "setTopicClos", AuditAction.UPDATE, "SYLLABUS_TOPIC", false, 1, "syllabusId", 0, "topicId", 1, "input", 2),
                rule("SyllabusWorkflowService", "publish", AuditAction.PUBLISH, "SYLLABUS", false, 0, "syllabusId", 0),
                rule("SyllabusTemplateService", "copy", AuditAction.CREATE, "SYLLABUS", true, -1, "input", 0),
                rule("SyllabusMaterialService", "create", AuditAction.CREATE, "SYLLABUS_MATERIAL", true, 0, "syllabusId", 0, "input", 1),
                rule("SyllabusMaterialService", "update", AuditAction.UPDATE, "SYLLABUS_MATERIAL", false, 1, "syllabusId", 0, "materialId", 1, "input", 2),
                rule("SyllabusMaterialService", "delete", AuditAction.DELETE, "SYLLABUS_MATERIAL", false, 1, "syllabusId", 0, "materialId", 1),
                rule("SyllabusMaterialFileService", "upload", AuditAction.UPLOAD, "SYLLABUS_MATERIAL", false, 0, "syllabusId", 0),
                rule("SyllabusBundleImportService", "importExcel", AuditAction.IMPORT, "SYLLABUS", false, -1),
                rule("SyllabusMaterialsArchiveService", "export", AuditAction.EXPORT, "SYLLABUS_MATERIAL", false, 0, "id", 0),
                rule("ExamCourseLinkService", "apply", AuditAction.UPDATE, "EXAM_COURSE_LINK", false, -1, "request", 1),
                rule("ExamCourseLinkService", "linkExam", AuditAction.LINK, "EXAM_COURSE_LINK", false, 3, "courseId", 0, "examId", 1, "sectionId", 2, "lessonId", 3),
                rule("ExamCourseLinkService", "unlinkExam", AuditAction.UNLINK, "EXAM_COURSE_LINK", false, 1, "courseId", 0, "examId", 1, "unlinkFromCourse", 2),
                rule("ExamImportService", "importExams", AuditAction.IMPORT, "EXAM", false, -1),
                rule("ExamExportService", "exportCsv", AuditAction.EXPORT, "EXAM", false, -1, "filter", 0, "search", 1),
                rule("ExamExportService", "exportExcel", AuditAction.EXPORT, "EXAM", false, -1, "filter", 0, "search", 1),
                rule("ExamExportService", "exportPdf", AuditAction.EXPORT, "EXAM", false, -1, "filter", 0, "search", 1),
                rule("ExamResultExportService", "exportCsv", AuditAction.EXPORT, "EXAM_RESULT", false, 0, "examId", 0),
                rule("ExamResultExportService", "exportExcel", AuditAction.EXPORT, "EXAM_RESULT", false, 0, "examId", 0),
                rule("ExamResultExportService", "exportPdf", AuditAction.EXPORT, "EXAM_RESULT", false, 0, "examId", 0),
                rule("ExamResultPublicationService", "publish", AuditAction.PUBLISH, "EXAM_RESULT", false, 0, "examId", 0),
                rule("ExamResultPublicationService", "unpublish", AuditAction.UNPUBLISH, "EXAM_RESULT", false, 0, "examId", 0),
                rule("ExamTemplateService", "saveAsTemplate", AuditAction.CREATE, "EXAM_TEMPLATE", true, 0, "examId", 0, "request", 1),
                rule("ExamTemplateService", "updateTemplate", AuditAction.UPDATE, "EXAM_TEMPLATE", false, 0, "templateId", 0, "request", 1),
                rule("ExamTemplateService", "deleteTemplate", AuditAction.DELETE, "EXAM_TEMPLATE", false, 0, "templateId", 0),
                rule("ExamTemplateService", "createExamFromTemplate", AuditAction.CREATE, "EXAM", true, 0, "templateId", 0, "request", 1),
                rule("ExamEssayGradingService", "submitReferenceAnswer", AuditAction.UPDATE, "ESSAY_GRADING", false, 1, "examId", 0, "questionId", 1, "referenceAnswer", 2),
                rule("ExamEssayGradingService", "submitRubric", AuditAction.UPDATE, "ESSAY_GRADING", false, 1, "examId", 0, "questionId", 1, "rubric", 2),
                rule("ExamEssayGradingService", "submitOfficialGrade", AuditAction.GRADE, "ESSAY_GRADING", false, 1, "examId", 0, "attemptId", 1, "request", 2),
                rule("ExamEssayGradingService", "regradeCoding", AuditAction.GRADE, "CODING_SUBMISSION", false, 2, "examId", 0, "attemptId", 1, "questionId", 2),
                rule("ScoreAppealService", "createAppeal", AuditAction.CREATE, "SCORE_APPEAL", true, 1, "studentId", 0, "attemptId", 1, "reason", 2, "requestedScore", 3),
                rule("ScoreAppealService", "review", AuditAction.REVIEW, "SCORE_APPEAL", false, 0, "appealId", 0, "decision", 1, "newScore", 2, "resolutionNote", 3),
                rule("ExamAttemptService", "submit", AuditAction.SUBMIT, "EXAM_ATTEMPT", false, 1, "attemptId", 0, "studentId", 1),
                rule("AnonymousExamService", "submit", AuditAction.SUBMIT, "EXAM_ATTEMPT", false, 1, "sessionToken", 0, "attemptId", 1),
                rule("InvitationService", "acceptInvitation", AuditAction.ACCEPT, "INVITATION", false, 0, "id", 0),
                rule("InvitationService", "rejectInvitation", AuditAction.REJECT, "INVITATION", false, 0, "id", 0),
                rule("QuestionExportService", "exportLegacyCsv", AuditAction.EXPORT, "QUESTION", false, -1, "filter", 0),
                rule("QuestionExportService", "exportExcel", AuditAction.EXPORT, "QUESTION", false, -1, "filter", 0),
                rule("QuestionExportService", "exportPdf", AuditAction.EXPORT, "QUESTION", false, -1, "filter", 0),
                rule("CourseAnalyticsExportService", "exportAll", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0, "from", 1, "to", 2, "inactiveDays", 4),
                rule("CourseAnalyticsExportService", "exportLessonFunnel", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0),
                rule("CourseAnalyticsExportService", "exportTrend", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0, "from", 1, "to", 2),
                rule("CourseAnalyticsExportService", "exportActivity", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0, "inactiveDays", 1),
                rule("CourseAnalyticsExportService", "exportReviews", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0),
                rule("CourseAnalyticsExportService", "exportDepartments", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0),
                rule("CourseAnalyticsExportService", "exportCourseRanking", AuditAction.EXPORT, "COURSE_ANALYTICS", false, -1),
                rule("CourseAnalyticsExportService", "exportContentQuality", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0),
                rule("CourseAnalyticsExportService", "exportExams", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0),
                rule("CourseAnalyticsExportService", "exportStudyTime", AuditAction.EXPORT, "COURSE_ANALYTICS", false, 0, "courseId", 0),
                rule("ProjectTeamDraftService", "saveBatch", AuditAction.UPDATE, "PROJECT_TEAM_DRAFT", false, 3, "sessionId", 0, "request", 1, "idempotencyRecordId", 3),
                rule("ProjectTeamDraftService", "updateDraftTeam", AuditAction.UPDATE, "PROJECT_TEAM_DRAFT", false, 2, "classId", 0, "sessionId", 1, "teamId", 2, "request", 3),
                rule("ProjectTeamMembershipService", "addMember", AuditAction.CREATE, "PROJECT_TEAM_MEMBER", true, 2, "classId", 0, "sessionId", 1, "teamId", 2, "request", 3),
                rule("ProjectTeamMembershipService", "removeMember", AuditAction.DELETE, "PROJECT_TEAM_MEMBER", false, 3, "classId", 0, "sessionId", 1, "teamId", 2, "memberId", 3, "request", 4),
                rule("ProjectTeamMentorService", "updateTeamMentor", AuditAction.ASSIGN, "PROJECT_TEAM", false, 2, "classId", 0, "sessionId", 1, "teamId", 2, "request", 3),
                rule("ProjectTeamRoleService", "updateRoles", AuditAction.UPDATE, "PROJECT_TEAM_ROLE", false, 2, "classId", 0, "sessionId", 1, "teamId", 2, "request", 3),
                rule("ProjectTeamRoleService", "updateRolesAsTeamLeader", AuditAction.UPDATE, "PROJECT_TEAM_ROLE", false, 0, "teamId", 0, "request", 1),
                rule("ProjectTeamTemplateService", "assignTemplate", AuditAction.ASSIGN, "PROJECT_TEAM", false, 4, "classId", 0, "sessionId", 1, "teamId", 2, "projectTemplateId", 3, "versionId", 4),
                rule("ProjectTeamTemplateService", "assignTemplateAsTeamLeader", AuditAction.ASSIGN, "PROJECT_TEAM", false, 1, "teamId", 0, "projectTemplateId", 1),
                rule("TeamAllocationSessionService", "updateMaxMembers", AuditAction.UPDATE, "TEAM_ALLOCATION_SESSION", false, 1, "classId", 0, "sessionId", 1, "request", 2),
                rule("TeamPublishItemService", "publish", AuditAction.PUBLISH, "PROJECT_TEAM", false, 2, "sessionId", 0, "teamId", 1, "actorId", 2),
                rule("ProjectAlertService", "send", AuditAction.SEND, "PROJECT_ALERT", false, -1, "key", 0, "correlation", 1, "request", 2),
                rule("ProjectAlertService", "link", AuditAction.UPDATE, "PROJECT_ALERT", false, 1, "teamId", 0, "milestoneId", 1, "request", 2),
                rule("TaskAlertService", "send", AuditAction.SEND, "TASK_ALERT", false, 2, "request", 0, "requestId", 1, "correlationId", 2),
                rule("MilestoneRiskService", "send", AuditAction.SEND, "MILESTONE_ALERT", false, 1, "projectId", 0, "milestoneId", 1, "key", 2, "request", 3),
                rule("MemberReminderService", "send", AuditAction.SEND, "MEMBER_REMINDER", false, 0, "projectId", 0, "key", 1, "correlation", 2, "request", 3),
                rule("ProjectBoardServiceImpl", "createTeamSprint", AuditAction.CREATE, "TEAM_SPRINT", true, 0, "teamId", 0, "request", 1),
                rule("MilestoneCommandService", "create", AuditAction.CREATE, "MILESTONE", true, 0, "projectId", 0, "idempotencyKey", 1, "request", 2),
                rule("MilestoneLifecycleService", "editPlanned", AuditAction.UPDATE, "MILESTONE", false, 2, "projectId", 0, "teamId", 1, "id", 2, "request", 3),
                rule("MilestoneLifecycleService", "editActive", AuditAction.UPDATE, "MILESTONE", false, 2, "projectId", 0, "teamId", 1, "id", 2, "request", 3),
                rule("MilestoneLifecycleService", "deleteDraft", AuditAction.DELETE, "MILESTONE", false, 2, "projectId", 0, "teamId", 1, "id", 2, "expectedVersion", 3),
                rule("ArtifactSubmissionService", "submit", AuditAction.SUBMIT, "ARTIFACT_SUBMISSION", true, 1, "projectId", 0, "milestoneId", 1, "idempotencyKey", 2, "request", 3),
                rule("TeamArtifactSubmissionService", "submit", AuditAction.SUBMIT, "ARTIFACT_SUBMISSION", true, 1, "teamId", 0, "milestoneId", 1, "key", 2, "request", 3),
                rule("ArtifactUploadService", "upload", AuditAction.UPLOAD, "ARTIFACT", true, 1, "projectId", 0, "milestoneId", 1),
                rule("SubmissionReviewService", "review", AuditAction.REVIEW, "ARTIFACT_SUBMISSION", false, 0, "submissionId", 0, "idempotencyKey", 1, "request", 2),
                rule("ProjectCompletionCommandService", "lockFinalGrade", AuditAction.LOCK, "PROJECT_COMPLETION", false, 1, "projectId", 0, "teamId", 1, "request", 2),
                rule("RubricService", "create", AuditAction.CREATE, "RUBRIC", true, -1, "request", 0),
                rule("RubricService", "updateDraft", AuditAction.UPDATE, "RUBRIC", false, 1, "rubricId", 0, "versionId", 1, "request", 2),
                rule("RubricService", "publish", AuditAction.PUBLISH, "RUBRIC", false, 1, "rubricId", 0, "versionId", 1),
                rule("RubricService", "createVersion", AuditAction.CREATE, "RUBRIC", true, 0, "rubricId", 0, "request", 1),
                rule("RubricService", "deleteDraft", AuditAction.DELETE, "RUBRIC", false, 1, "rubricId", 0, "versionId", 1),
                rule("ProjectHubService", "assignMentor", AuditAction.ASSIGN, "PROJECT", false, 0, "id", 0, "request", 1),
                rule("ProjectHubService", "saveCharter", AuditAction.UPDATE, "PROJECT", false, 0, "id", 0, "charter", 1),
                rule("TemplateVersionLifecycleService", "archivePublishedVersions", AuditAction.ARCHIVE, "PROJECT_TEMPLATE_VERSION", false, 1, "templateId", 0, "retainedVersionId", 1, "actorEmail", 2),
                rule("TemplateResourceVersionServiceImpl", "create", AuditAction.CREATE, "TEMPLATE_RESOURCE", true, 0, "versionId", 0, "request", 1),
                rule("TemplateResourceVersionServiceImpl", "update", AuditAction.UPDATE, "TEMPLATE_RESOURCE", false, 1, "versionId", 0, "resourceId", 1, "request", 2),
                rule("TemplateResourceVersionServiceImpl", "delete", AuditAction.DELETE, "TEMPLATE_RESOURCE", false, 1, "versionId", 0, "resourceId", 1),
                rule("TemplateResourceVersionServiceImpl", "upload", AuditAction.UPLOAD, "TEMPLATE_RESOURCE", false, 1, "versionId", 0, "resourceId", 1),
                rule("TemplateResourceVersionServiceImpl", "deleteFile", AuditAction.DELETE, "TEMPLATE_RESOURCE", false, 1, "versionId", 0, "fileId", 1),
                rule("WorkspaceResourceCommandService", "create", AuditAction.CREATE, "WORKSPACE_RESOURCE", true, 0, "workspaceId", 0, "request", 1),
                rule("WorkspaceResourceCommandService", "update", AuditAction.UPDATE, "WORKSPACE_RESOURCE", false, 1, "workspaceId", 0, "resourceId", 1, "request", 2),
                rule("WorkspaceResourceCommandService", "delete", AuditAction.DELETE, "WORKSPACE_RESOURCE", false, 1, "workspaceId", 0, "resourceId", 1),
                rule("WorkspaceResourceCommandService", "upload", AuditAction.UPLOAD, "WORKSPACE_RESOURCE", false, 1, "workspaceId", 0, "resourceId", 1),
                rule("WorkspaceResourceCommandService", "deleteFile", AuditAction.DELETE, "WORKSPACE_RESOURCE", false, 2, "workspaceId", 0, "resourceId", 1, "fileId", 2),
                rule("ProjectTemplateService", "create", AuditAction.CREATE, "PROJECT_TEMPLATE", true, -1, "request", 0),
                rule("ProjectTemplateService", "update", AuditAction.UPDATE, "PROJECT_TEMPLATE", false, 0, "id", 0, "request", 1),
                rule("ProjectTemplateService", "updateTeamConstraints", AuditAction.UPDATE, "PROJECT_TEMPLATE", false, 0, "id", 0, "request", 1),
                rule("ProjectTemplateService", "archive", AuditAction.ARCHIVE, "PROJECT_TEMPLATE", false, 0, "id", 0, "request", 1),
                rule("ProjectTemplateDeletionService", "delete", AuditAction.DELETE, "PROJECT_TEMPLATE", false, 0, "id", 0, "lockVersion", 1),
                rule("TemplateActivationService", "activate", AuditAction.ACTIVATE, "PROJECT_TEMPLATE", false, 0, "id", 0, "request", 1),
                rule("TemplateMilestoneService", "savePlan", AuditAction.UPDATE, "PROJECT_TEMPLATE_VERSION", false, 0, "templateId", 0, "request", 1),
                rule("TemplateSampleContentService", "save", AuditAction.UPDATE, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0, "request", 1),
                rule("TemplateVersionConfigurationService", "importTemplate", AuditAction.IMPORT, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0),
                rule("TemplateVersionConfigurationService", "saveOverview", AuditAction.UPDATE, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0, "request", 1),
                rule("TemplateVersionConfigurationService", "saveTeam", AuditAction.UPDATE, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0, "request", 1),
                rule("TemplateVersionConfigurationService", "saveMilestones", AuditAction.UPDATE, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0, "request", 1),
                rule("TemplateVersionConfigurationService", "saveBacklog", AuditAction.UPDATE, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0, "request", 1),
                rule("TemplateVersionConfigurationService", "publish", AuditAction.PUBLISH, "PROJECT_TEMPLATE_VERSION", false, 0, "id", 0, "request", 1),
                rule("WorkspaceServiceImpl", "createWorkspace", AuditAction.CREATE, "WORKSPACE", true, -1, "key", 0, "request", 1),
                rule("WorkspaceServiceImpl", "confirmWorkspace", AuditAction.CONFIRM, "WORKSPACE", false, -1, "request", 0),
                rule("WorkspaceSectionService", "create", AuditAction.CREATE, "WORKSPACE_SECTION", true, 0, "id", 0),
                rule("WorkspaceSectionService", "submit", AuditAction.SUBMIT, "WORKSPACE_SECTION", false, 0, "id", 0),
                rule("WorkspaceSectionService", "review", AuditAction.REVIEW, "WORKSPACE_SECTION", false, 0, "id", 0),
                rule("WorkspaceSectionService", "updateBoardColumns", AuditAction.UPDATE, "WORKSPACE_SECTION", false, 0, "id", 0),
                rule("WorkspaceGitService", "save", AuditAction.UPDATE, "WORKSPACE_GIT_REPOSITORY", false, 0, "workspaceId", 0),
                rule("WorkspaceGitService", "unlink", AuditAction.DELETE, "WORKSPACE_GIT_REPOSITORY", false, 0, "workspaceId", 0, "version", 1),
                rule("ProjectLogService", "create", AuditAction.CREATE, "PROJECT_LOG", true, 2, "workspaceId", 0, "request", 1, "correlationId", 2, "ip", 3),
                rule("ProjectLogService", "updateRisk", AuditAction.UPDATE, "PROJECT_LOG", false, 5, "workspaceId", 0, "logId", 1, "request", 2, "expectedVersion", 3, "idempotencyKey", 4, "correlationId", 5, "ip", 6)
        );
    }

    static AuditRule rule(
            String targetClass,
            String method,
            String action,
            String entityType,
            boolean idFromResult,
            int idArg,
            Object... inputs
    ) {
        return AuditRule.on(targetClass, method)
                .action(action)
                .entityType(entityType)
                .entityId(call -> idOf(call, idFromResult, idArg))
                .newValue(call -> inputs.length == 0 ? null : snapshot(call, inputs))
                .build();
    }

    private static String idOf(AuditInvocation call, boolean idFromResult, int idArg) {
        Object returned = call.result();
        Object fromResult = returned instanceof Number || returned instanceof UUID
                ? returned
                : call.resultProp("id");
        Object fromArg = idArg >= 0 ? call.arg(idArg) : null;

        Object id = idFromResult
                ? (fromResult != null ? fromResult : fromArg)
                : (fromArg != null ? fromArg : fromResult);

        return id != null ? String.valueOf(id) : null;
    }

    private static Map<String, Object> snapshot(AuditInvocation call, Object[] inputs) {
        Map<String, Object> values = new LinkedHashMap<>();

        for (int i = 0; i + 1 < inputs.length; i += 2) {
            values.put((String) inputs[i], safe(call.arg((Integer) inputs[i + 1])));
        }

        return values;
    }

    /**
     * Keeps log data small and safe: persistence entities are never serialized (only their class name),
     * collections of simple values are kept, anything else is a request/DTO object.
     */
    private static Object safe(Object value) {
        if (value == null || isSimple(value)) {
            return value;
        }

        if (value instanceof Collection<?> items) {
            return items.size() <= 50 && items.stream().allMatch(item -> item == null || isSimple(item))
                    ? items
                    : items.size() + " items";
        }

        if (value.getClass().isAnnotationPresent(jakarta.persistence.Entity.class)) {
            return value.getClass().getSimpleName();
        }

        return value;
    }

    private static boolean isSimple(Object value) {
        return value instanceof Number
                || value instanceof CharSequence
                || value instanceof Boolean
                || value instanceof Enum<?>
                || value instanceof UUID
                || value instanceof Temporal;
    }
}
