package com.example.starter_project_2025.system.audit;

import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Role;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.example.starter_project_2025.system.audit.ModuleAuditRules.rule;

/**
 * Audit rules for modules added after {@link ModuleAuditRules}: training (class, calendar, program),
 * subject, gradebook, project tasks / charter / assignment, AI review, location staff, email templates
 * and account sessions. Same format as {@link ModuleAuditRules}; services that extend
 * BaseCrudServiceImpl are already audited automatically and are not listed here.
 */
@Component
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ExtraModuleAuditRules implements AuditRuleProvider {

    @Override
    public List<AuditRule> auditRules() {
        return List.of(
                // training
                rule("TrainingClassService", "create", AuditAction.CREATE, "TRAINING_CLASS", true, -1, "request", 0),
                rule("TrainingClassService", "update", AuditAction.UPDATE, "TRAINING_CLASS", false, 0, "id", 0, "request", 1),
                rule("TrainingClassService", "deactivate", AuditAction.DEACTIVATE, "TRAINING_CLASS", false, 0, "id", 0),
                rule("TrainingClassService", "importClasses", AuditAction.IMPORT, "TRAINING_CLASS", false, -1, "classes", 0),
                rule("TrainingCalendarService", "create", AuditAction.CREATE, "TRAINING_CALENDAR", false, 0, "classId", 0, "sourceId", 1, "body", 2),
                rule("TrainingCalendarService", "update", AuditAction.UPDATE, "TRAINING_CALENDAR", false, 0, "classId", 0, "body", 1),
                rule("TrainingCalendarService", "delete", AuditAction.DELETE, "TRAINING_CALENDAR", false, 1, "classId", 0, "calendarId", 1),
                rule("ClassEnrollmentService", "importRows", AuditAction.IMPORT, "CLASS_ENROLLMENT", false, 0, "classId", 0),
                rule("TrainingProgramServiceImpl", "create", AuditAction.CREATE, "TRAINING_PROGRAM", true, -1, "request", 0),
                rule("TrainingProgramServiceImpl", "update", AuditAction.UPDATE, "TRAINING_PROGRAM", false, 0, "id", 0, "request", 1),
                rule("TrainingProgramServiceImpl", "updateSubjects", AuditAction.UPDATE, "TRAINING_PROGRAM", false, 0, "id", 0, "subjects", 1),
                rule("TrainingProgramServiceImpl", "cloneVersion", AuditAction.CLONE, "TRAINING_PROGRAM", true, 0, "sourceId", 0, "newVersion", 1),
                rule("TrainingProgramServiceImpl", "activate", AuditAction.ACTIVATE, "TRAINING_PROGRAM", false, 0, "id", 0),
                rule("TrainingProgramServiceImpl", "changeStatus", AuditAction.UPDATE, "TRAINING_PROGRAM", false, 0, "id", 0, "status", 1),
                rule("TrainingProgramServiceImpl", "delete", AuditAction.DELETE, "TRAINING_PROGRAM", false, 0, "id", 0),
                rule("TrainingProgramImportService", "importAll", AuditAction.IMPORT, "TRAINING_PROGRAM", false, -1),
                rule("SubjectImportService", "importFile", AuditAction.IMPORT, "SUBJECT", false, -1),
                rule("SubjectSyllabusService", "saveSyllabus", AuditAction.UPDATE, "SUBJECT_SYLLABUS", false, 0, "subjectId", 0, "request", 1),
                rule("SubjectSyllabusService", "resetSyllabus", AuditAction.UPDATE, "SUBJECT_SYLLABUS", false, 0, "subjectId", 0),

                // rbac / notification
                rule("LocationStaffService", "assignUsers", AuditAction.ASSIGN, "LOCATION", false, 0, "locationId", 0, "request", 1),
                rule("LocationStaffService", "unassignUser", AuditAction.UNLINK, "LOCATION", false, 0, "locationId", 0, "userId", 1),
                rule("EmailTemplateService", "create", AuditAction.CREATE, "EMAIL_TEMPLATE", true, -1, "request", 3),
                rule("EmailTemplateService", "update", AuditAction.UPDATE, "EMAIL_TEMPLATE", false, 3, "id", 3, "request", 4),
                rule("EmailTemplateService", "updateStatus", AuditAction.UPDATE, "EMAIL_TEMPLATE", false, 3, "id", 3, "active", 4),
                rule("TenantNotificationPolicyService", "updatePolicies", AuditAction.UPDATE, "NOTIFICATION_POLICY", false, 0, "tenantId", 0, "changes", 3),

                // account security
                rule("AuthServiceImpl", "changePassword", AuditAction.CHANGE_PASSWORD, "USER", false, 0, "userId", 0),
                rule("AuthServiceImpl", "revokeSession", AuditAction.REVOKE, "USER_SESSION", false, 0, "userId", 0, "sessionId", 1),
                rule("AuthServiceImpl", "revokeOtherSessions", AuditAction.REVOKE, "USER_SESSION", false, 0, "userId", 0),

                // gradebook / exam
                rule("GradebookService", "save", AuditAction.UPDATE, "GRADEBOOK", false, 0, "courseId", 0),
                rule("GradebookService", "addColumn", AuditAction.CREATE, "GRADEBOOK_COLUMN", false, 0, "courseId", 0, "request", 1),
                rule("GradebookService", "updateColumn", AuditAction.UPDATE, "GRADEBOOK_COLUMN", false, 0, "columnId", 0, "request", 1),
                rule("GradebookService", "deleteColumn", AuditAction.DELETE, "GRADEBOOK_COLUMN", false, 0, "columnId", 0),
                rule("GradebookService", "importExam", AuditAction.IMPORT, "GRADEBOOK_COLUMN", false, 0, "columnId", 0, "request", 1),
                rule("GradebookBonusService", "add", AuditAction.CREATE, "GRADEBOOK_BONUS", false, 0, "courseId", 0, "request", 1),
                rule("GradebookBonusService", "revoke", AuditAction.REVOKE, "GRADEBOOK_BONUS", false, 0, "bonusId", 0),
                rule("ExamGradeScaleService", "saveScales", AuditAction.UPDATE, "EXAM_GRADE_SCALE", false, 0, "examId", 0, "type", 1, "scales", 2),
                rule("ExamGradeScaleService", "resetToDefault", AuditAction.UPDATE, "EXAM_GRADE_SCALE", false, 0, "examId", 0, "type", 1),
                rule("ExamIntegrityReviewService", "submitReview", AuditAction.REVIEW, "EXAM_INTEGRITY", false, 1, "examId", 0, "attemptId", 1, "request", 2),
                rule("ExamPeerReviewService", "assignReviewers", AuditAction.ASSIGN, "EXAM_PEER_REVIEW", false, 0, "examId", 0),
                rule("ExamPeerReviewService", "submitReview", AuditAction.REVIEW, "EXAM_PEER_REVIEW", false, 0, "assignmentId", 0, "request", 2),
                rule("ExamQuestionPoolVersionService", "saveConfig", AuditAction.UPDATE, "EXAM_QUESTION_POOL", false, 0, "examId", 0, "request", 1),
                rule("ReminderService", "cancelReminder", AuditAction.CANCEL, "EXAM_REMINDER", false, 0, "reminderId", 0),

                // project: tasks
                rule("ProjectTaskServiceImpl", "createTask", AuditAction.CREATE, "TASK", true, -1, "projectId", 0, "sprintId", 1, "request", 2),
                rule("ProjectTaskServiceImpl", "updateTask", AuditAction.UPDATE, "TASK", false, 1, "projectId", 0, "taskId", 1, "request", 2),
                rule("ProjectTaskServiceImpl", "deleteTask", AuditAction.DELETE, "TASK", false, 1, "projectId", 0, "taskId", 1),
                rule("ProjectTaskServiceImpl", "assignTask", AuditAction.ASSIGN, "TASK", false, 1, "projectId", 0, "taskId", 1, "request", 2),
                rule("ProjectTaskServiceImpl", "updateStatus", AuditAction.UPDATE, "TASK", false, 1, "projectId", 0, "taskId", 1, "request", 2),
                rule("ProjectTaskServiceImpl", "moveTaskToSprint", AuditAction.UPDATE, "TASK", false, 1, "projectId", 0, "taskId", 1, "request", 2),
                rule("TaskServiceImpl", "create", AuditAction.CREATE, "TASK", true, -1, "request", 0),
                rule("TaskServiceImpl", "update", AuditAction.UPDATE, "TASK", false, 0, "id", 0, "request", 1),
                rule("TaskWorkflowService", "changeStatus", AuditAction.UPDATE, "TASK", false, 0, "taskId", 0, "request", 1),
                rule("TaskDeletionService", "delete", AuditAction.DELETE, "TASK", false, 0, "taskId", 0, "version", 1),

                // project: charter, submissions, allocation, publication
                rule("TeamCharterService", "save", AuditAction.UPDATE, "TEAM_CHARTER", false, 0, "teamId", 0, "request", 1),
                rule("TeamCharterService", "confirm", AuditAction.CONFIRM, "TEAM_CHARTER", false, 0, "teamId", 0, "request", 1),
                rule("SubmissionVersionService", "createNextVersion", AuditAction.CREATE, "ARTIFACT_SUBMISSION", false, 0, "id", 0, "request", 1),
                rule("SubmissionVersionService", "createMyNextVersion", AuditAction.CREATE, "ARTIFACT_SUBMISSION", false, 0, "id", 0, "request", 1),
                rule("SubmissionVersionService", "submit", AuditAction.SUBMIT, "ARTIFACT_SUBMISSION", false, 0, "id", 0),
                rule("SubmissionVersionService", "submitMine", AuditAction.SUBMIT, "ARTIFACT_SUBMISSION", false, 0, "id", 0),
                rule("MasterMilestoneService", "submit", AuditAction.SUBMIT, "MILESTONE_SUBMISSION", false, 1, "workspaceId", 0, "milestoneId", 1, "request", 3),
                rule("MasterMilestoneService", "submitForClass", AuditAction.SUBMIT, "MILESTONE_SUBMISSION", false, 1, "projectId", 0, "milestoneId", 1, "request", 3),
                rule("ProjectAssignmentService", "assign", AuditAction.ASSIGN, "PROJECT_ASSIGNMENT", false, 1, "classId", 0, "sessionId", 1, "request", 3),
                rule("ProjectTeamLeaderService", "assign", AuditAction.ASSIGN, "PROJECT_TEAM", false, 2, "classId", 0, "sessionId", 1, "teamId", 2, "request", 3),
                rule("ProjectTeamPublishCoordinator", "publish", AuditAction.PUBLISH, "PROJECT_TEAM", false, 1, "classId", 0, "sessionId", 1, "request", 3),
                rule("ProjectTeamPublishCoordinator", "publishSession", AuditAction.PUBLISH, "TEAM_ALLOCATION_SESSION", false, 1, "classId", 0, "sessionId", 1),

                // project: AI assistant
                rule("AiSuggestionService", "approveSuggestion", AuditAction.APPROVE, "AI_SUGGESTION", false, 0, "suggestionId", 0),
                rule("AiSuggestionService", "rejectSuggestion", AuditAction.REJECT, "AI_SUGGESTION", false, 0, "suggestionId", 0, "request", 1),
                rule("AIReviewSuggestionService", "approve", AuditAction.APPROVE, "AI_REVIEW_SUGGESTION", false, 3, "templateId", 0, "reportId", 1, "findingId", 2, "suggestionId", 3),
                rule("AIReviewSuggestionService", "reject", AuditAction.REJECT, "AI_REVIEW_SUGGESTION", false, 3, "templateId", 0, "reportId", 1, "findingId", 2, "suggestionId", 3, "reason", 4),
                rule("AIReviewFindingManagementService", "accept", AuditAction.ACCEPT, "AI_REVIEW_FINDING", false, 2, "templateId", 0, "reportId", 1, "findingId", 2),
                rule("AIReviewFindingManagementService", "resolve", AuditAction.RESOLVE, "AI_REVIEW_FINDING", false, 2, "templateId", 0, "reportId", 1, "findingId", 2)
        );
    }
}
