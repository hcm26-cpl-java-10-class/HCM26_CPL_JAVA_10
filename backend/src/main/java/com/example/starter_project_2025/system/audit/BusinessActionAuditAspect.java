package com.example.starter_project_2025.system.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class BusinessActionAuditAspect {

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Around("""
        execution(* com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService.enroll(..))
        || execution(* com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService.cancelEnrollment(..))
        || execution(* com.example.starter_project_2025.system.demo.session.SessionServiceImpl.cancelSession(..))
        || execution(* com.example.starter_project_2025.system.exam.service.ExamServiceImpl.addQuestions(..))
        || execution(* com.example.starter_project_2025.system.exam.service.ExamServiceImpl.removeQuestion(..))
        || execution(* com.example.starter_project_2025.system.question.service.QuestionImportService.importQuestionsFromCsv(..))
        || execution(* com.example.starter_project_2025.system.question.service.QuestionExportService.exportCsv(..))
        """)
    public Object auditBusinessAction(ProceedingJoinPoint joinPoint) throws Throwable {

        Object result;

        try {
            result = joinPoint.proceed();
        } catch (Throwable exception) {
            writeAuditSafely(joinPoint, null, "FAILURE");
            throw exception;
        }

        String auditResult = determineResult(joinPoint, result);
        writeAuditSafely(joinPoint, result, auditResult);

        return result;
    }

    private void writeAuditSafely(
            ProceedingJoinPoint joinPoint,
            Object result,
            String auditResult
    ) {
        try {
            AuditData data = buildAuditData(joinPoint, result);

            auditLogService.log(
                    data.action,
                    data.entityType,
                    data.entityId,
                    toJson(data.oldValue),
                    toJson(data.newValue),
                    MDC.get("correlationId"),
                    auditResult
            );

        } catch (Exception exception) {
            log.warn(
                    "Failed to write business action audit log for method: {}",
                    joinPoint.getSignature().toShortString(),
                    exception
            );
        }
    }

    private AuditData buildAuditData(
            ProceedingJoinPoint joinPoint,
            Object result
    ) {
        String method = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();

        AuditData data = new AuditData();

        switch (method) {

            case "enroll" -> {
                data.action = "CREATE";
                data.entityType = "COURSE_ENROLLMENT";

                Object enrollmentId = getProperty(result, "id");
                data.entityId = enrollmentId != null
                        ? String.valueOf(enrollmentId)
                        : null;

                Map<String, Object> newValue = new LinkedHashMap<>();
                newValue.put("userId", getArg(args, 0));
                newValue.put("courseId", getArg(args, 1));
                data.newValue = newValue;
            }

            case "cancelEnrollment" -> {
                data.action = "CANCEL";
                data.entityType = "COURSE_ENROLLMENT";
                data.entityId = stringValue(getArg(args, 1));

                Map<String, Object> oldValue = new LinkedHashMap<>();
                oldValue.put("userId", getArg(args, 0));
                oldValue.put("enrollmentId", getArg(args, 1));
                data.oldValue = oldValue;
            }

            case "cancelSession" -> {
                data.action = "CANCEL";
                data.entityType = "SESSION";
                data.entityId = stringValue(getArg(args, 0));

                Map<String, Object> newValue = new LinkedHashMap<>();
                newValue.put("status", "CANCELLED");
                newValue.put(
                        "cancelReason",
                        getProperty(getArg(args, 1), "cancelReason")
                );
                data.newValue = newValue;
            }

            case "addQuestions" -> {
                data.action = "ADD_QUESTION";
                data.entityType = "EXAM";
                data.entityId = stringValue(getArg(args, 0));

                Map<String, Object> newValue = new LinkedHashMap<>();
                newValue.put("examId", getArg(args, 0));
                newValue.put("questionIds", getArg(args, 1));
                data.newValue = newValue;
            }

            case "removeQuestion" -> {
                data.action = "REMOVE_QUESTION";
                data.entityType = "EXAM";
                data.entityId = stringValue(getArg(args, 0));

                Map<String, Object> oldValue = new LinkedHashMap<>();
                oldValue.put("examId", getArg(args, 0));
                oldValue.put("questionId", getArg(args, 1));
                data.oldValue = oldValue;
            }

            case "importQuestionsFromCsv" -> {
                data.action = "IMPORT";
                data.entityType = "QUESTION";

                Map<String, Object> newValue = new LinkedHashMap<>();
                newValue.put("fileName", getFileName(args));
                newValue.put("successCount",
                        getProperty(result, "successCount"));
                newValue.put("failureCount",
                        getProperty(result, "failureCount"));
                newValue.put("updatedCount",
                        getProperty(result, "updatedCount"));
                newValue.put("skippedCount",
                        getProperty(result, "skippedCount"));
                newValue.put("emailsSent",
                        getProperty(result, "emailsSent"));
                newValue.put("emailsFailed",
                        getProperty(result, "emailsFailed"));
                newValue.put("emailsSkipped",
                        getProperty(result, "emailsSkipped"));

                // Never include credentials or passwords in audit logs.
                data.newValue = newValue;
            }

            case "exportCsv" -> {
                data.action = "EXPORT";
                data.entityType = "QUESTION";

                Object filter = getArg(args, 0);

                Map<String, Object> newValue = new LinkedHashMap<>();
                newValue.put("type", getProperty(filter, "type"));
                newValue.put("difficulty",
                        getProperty(filter, "difficulty"));
                newValue.put("topic", getProperty(filter, "topic"));
                data.newValue = newValue;
            }

            default -> throw new IllegalArgumentException(
                    "Unsupported audit method: " + method
            );
        }

        return data;
    }

    private String determineResult(
            ProceedingJoinPoint joinPoint,
            Object result
    ) {
        String method = joinPoint.getSignature().getName();

        if (!"importQuestionsFromCsv".equals(method)) {
            return "SUCCESS";
        }

        Number successCount = asNumber(
                getProperty(result, "successCount")
        );

        Number failureCount = asNumber(
                getProperty(result, "failureCount")
        );

        int success = successCount != null ? successCount.intValue() : 0;
        int failure = failureCount != null ? failureCount.intValue() : 0;

        if (success > 0 && failure > 0) {
            return "PARTIAL";
        }

        if (success > 0) {
            return "SUCCESS";
        }

        return "FAILURE";
    }

    private String getFileName(Object[] args) {
        if (args.length > 0 && args[0] instanceof MultipartFile file) {
            return file.getOriginalFilename();
        }

        return null;
    }

    private Object getArg(Object[] args, int index) {
        return args != null && index >= 0 && index < args.length
                ? args[index]
                : null;
    }

    private String stringValue(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private Object getProperty(Object target, String property) {
        if (target == null || property == null || property.isBlank()) {
            return null;
        }

        String getterName = "get"
                + Character.toUpperCase(property.charAt(0))
                + property.substring(1);

        try {
            Method getter = target.getClass().getMethod(getterName);
            return getter.invoke(target);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Number asNumber(Object value) {
        return value instanceof Number number ? number : null;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            log.warn("Cannot serialize audit data", exception);
            return null;
        }
    }

    private static class AuditData {
        private String action;
        private String entityType;
        private String entityId;
        private Object oldValue;
        private Object newValue;
    }
}