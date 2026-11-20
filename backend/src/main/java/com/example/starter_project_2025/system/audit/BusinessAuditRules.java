package com.example.starter_project_2025.system.audit;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Audit rules of the business actions that are not plain CRUD.
 * To audit one more action, add a rule here (or in your own {@link AuditRuleProvider});
 * the audited service itself is not modified.
 */
@Component
public class BusinessAuditRules implements AuditRuleProvider {

    @Override
    public List<AuditRule> auditRules() {
        return List.of(
                // ---- course enrollment ----
                AuditRule.on("CourseEnrollmentService", "enroll")
                        .action(AuditAction.CREATE)
                        .entityType("COURSE_ENROLLMENT")
                        .entityId(call -> text(call.resultProp("id")))
                        .newValue(call -> fields("userId", call.arg(0), "courseId", call.arg(1)))
                        .build(),

                AuditRule.on("CourseEnrollmentService", "cancelEnrollment")
                        .action(AuditAction.CANCEL)
                        .entityType("COURSE_ENROLLMENT")
                        .entityId(call -> text(call.arg(1)))
                        .oldValue(call -> fields("userId", call.arg(0), "enrollmentId", call.arg(1)))
                        .build(),

                // ---- session ----
                AuditRule.on("SessionServiceImpl", "cancelSession")
                        .action(AuditAction.CANCEL)
                        .entityType("SESSION")
                        .entityId(call -> text(call.arg(0)))
                        .newValue(call -> fields(
                                "status", "CANCELLED",
                                "cancelReason", call.argProp(1, "cancelReason")))
                        .build(),

                // ---- exam ----
                AuditRule.on("ExamServiceImpl", "addQuestions")
                        .action(AuditAction.ADD_QUESTION)
                        .entityType("EXAM")
                        .entityId(call -> text(call.arg(0)))
                        .newValue(call -> fields("examId", call.arg(0), "questionIds", call.arg(1)))
                        .build(),

                AuditRule.on("ExamServiceImpl", "removeQuestion")
                        .action(AuditAction.REMOVE_QUESTION)
                        .entityType("EXAM")
                        .entityId(call -> text(call.arg(0)))
                        .oldValue(call -> fields("examId", call.arg(0), "questionId", call.arg(1)))
                        .build(),

                // ---- question import / export ----
                AuditRule.on("QuestionImportService", "importQuestionsFromCsv")
                        .action(AuditAction.IMPORT)
                        .entityType("QUESTION")
                        .newValue(BusinessAuditRules::importSummary)
                        .result(BusinessAuditRules::importResult)
                        .build(),

                AuditRule.on("QuestionExportService", "exportCsv")
                        .action(AuditAction.EXPORT)
                        .entityType("QUESTION")
                        .newValue(call -> fields(
                                "type", call.argProp(0, "type"),
                                "difficulty", call.argProp(0, "difficulty"),
                                "topic", call.argProp(0, "topic")))
                        .build(),

                // ---- generic import / export (every entity that uses the common data-io) ----
                AuditRule.on("GenericImportService", "importFile")
                        .action(AuditAction.IMPORT)
                        .entityType(call -> entityTypeOf(call.arg(1)))
                        .newValue(BusinessAuditRules::importSummary)
                        .result(BusinessAuditRules::importResult)
                        .build(),

                AuditRule.on("GenericExportService", "export")
                        .action(AuditAction.EXPORT)
                        .entityType(call -> entityTypeOf(call.arg(2)))
                        .newValue(call -> fields(
                                "format", text(call.arg(0)),
                                "rowCount", call.arg(1) instanceof Collection<?> rows ? rows.size() : null))
                        .build(),

                // ---- invitation ----
                AuditRule.on("InvitationActionService", "inviteSingle")
                        .action(AuditAction.INVITE)
                        .entityType("INVITATION")
                        .entityId(call -> text(call.resultProp("id")))
                        .newValue(call -> fields(
                                "examId", call.argProp(0, "examId"),
                                "userId", call.argProp(0, "userId")))
                        .build(),

                AuditRule.on("InvitationActionService", "inviteBatch")
                        .action(AuditAction.BATCH_INVITE)
                        .entityType("INVITATION")
                        .newValue(call -> fields(
                                "examId", call.resultProp("examId"),
                                "total", call.resultProp("totalRequested"),
                                "success", call.resultProp("successCount"),
                                "skipped", call.resultProp("skippedCount"),
                                "failed", call.resultProp("failedCount")))
                        .build(),

                AuditRule.on("InvitationActionService", "resend")
                        .action(AuditAction.RESEND)
                        .entityType("INVITATION")
                        .entityId(call -> text(call.arg(0)))
                        .newValue(call -> fields("resendCount", call.resultProp("resendCount")))
                        .build(),

                AuditRule.on("InvitationActionService", "revoke")
                        .action(AuditAction.REVOKE)
                        .entityType("INVITATION")
                        .entityId(call -> text(call.arg(0)))
                        .newValue(call -> fields("reason", call.argProp(1, "reason")))
                        .build(),

                // ---- account ----
                AuditRule.on("VerificationServiceImpl", "verifyEmail")
                        .action(AuditAction.VERIFY_EMAIL)
                        .entityType("USER")
                        .result(call -> call.failed() || Boolean.FALSE.equals(call.result())
                                ? "FAILURE"
                                : "SUCCESS")
                        .build(),

                AuditRule.on("VerificationServiceImpl", "sendForgotPassword")
                        .action(AuditAction.FORGOT_PASSWORD)
                        .entityType("USER")
                        .actor(call -> null, call -> text(call.arg(0)))
                        .build(),

                AuditRule.on("AuthServiceImpl", "loginWithGoogle")
                        .action(AuditAction.LOGIN)
                        .entityType("AUTH")
                        .newValue(call -> fields("provider", "GOOGLE"))
                        .actor(call -> null, call -> text(call.arg(0)))
                        .build()
        );
    }

    private static Map<String, Object> importSummary(AuditInvocation call) {
        return fields(
                "fileName", fileName(call.arg(0)),
                "successCount", call.resultProp("successCount"),
                "failureCount", call.resultProp("failureCount"),
                "updatedCount", call.resultProp("updatedCount"),
                "skippedCount", call.resultProp("skippedCount")
        );
        // credentials and passwords are deliberately never written to the audit log
    }

    private static String importResult(AuditInvocation call) {
        if (call.failed()) {
            return "FAILURE";
        }

        int success = number(call.resultProp("successCount"));
        int failure = number(call.resultProp("failureCount"));

        if (success > 0 && failure > 0) {
            return "PARTIAL";
        }

        return success > 0 ? "SUCCESS" : "FAILURE";
    }

    private static String fileName(Object file) {
        return text(AuditInvocation.prop(file, "originalFilename"));
    }

    private static String entityTypeOf(Object entityClass) {
        return entityClass instanceof Class<?> type
                ? AuditSupport.resourceOf(type)
                : "UNKNOWN";
    }

    private static int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static String text(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private static Map<String, Object> fields(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();

        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }

        return map;
    }
}
