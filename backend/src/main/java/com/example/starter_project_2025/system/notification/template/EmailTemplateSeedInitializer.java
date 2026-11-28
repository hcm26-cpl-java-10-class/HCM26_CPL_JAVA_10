package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.config.startup.StartupMutation;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(50)
@Component
@RequiredArgsConstructor
@StartupMutation
public class EmailTemplateSeedInitializer implements CommandLineRunner {

    private final EmailTemplateRepository templateRepository;
    private final EmailTemplateVersionRepository versionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seedIfMissing(
                "CLASS_WELCOME",
                "Class Welcome Email",
                NotificationCategory.CLASS,
                "Welcome message sent to trainees enrolled in a training class.",
                "[FAMS] Welcome to {{className}}",
                "<p>Hello {{studentName}},</p><p>You have been enrolled in <strong>{{className}}</strong> starting on {{startDate}}.</p><p>Best regards,<br/>FAMS Training Operations</p>",
                "{\"studentName\":\"Nguyen Van A\",\"className\":\"HCM26_CA_JAVA_01\",\"startDate\":\"01/12/2026\"}"
        );
        seedIfMissing(
                "CLASS_SESSION_REMINDER",
                "Class Session Reminder",
                NotificationCategory.CLASS,
                "Automated or manual reminder before a scheduled class session.",
                "[Reminder] Upcoming session: {{sessionTitle}}",
                "<p>Hello {{studentName}},</p><p>This is a reminder for session <strong>{{sessionTitle}}</strong> at {{startTime}} ({{location}}).</p>",
                "{\"studentName\":\"Nguyen Van A\",\"sessionTitle\":\"Spring Security\",\"startTime\":\"09:00 02/12/2026\",\"location\":\"Lab 201\"}"
        );
        seedIfMissing(
                "EXAM_INVITATION_NOTICE",
                "Exam Invitation Notice",
                NotificationCategory.EXAM,
                "Standard exam invitation notification.",
                "[Exam] Invitation to {{examTitle}}",
                "<p>Hello {{studentName}},</p><p>You are invited to complete <strong>{{examTitle}}</strong> before {{deadline}}.</p>",
                "{\"studentName\":\"Nguyen Van A\",\"examTitle\":\"Java Mid-term Exam\",\"deadline\":\"10/12/2026 23:59\"}"
        );
        seedIfMissing(
                "EXAM_RESULT_NOTICE",
                "Exam Result Published",
                NotificationCategory.EXAM,
                "Notification sent when assessment results are officially released.",
                "[Exam] Results published for {{examTitle}}",
                "<p>Hello {{studentName}},</p><p>Official results for <strong>{{examTitle}}</strong> are now available on FAMS LMS.</p>",
                "{\"studentName\":\"Nguyen Van A\",\"examTitle\":\"Java Mid-term Exam\"}"
        );
        seedIfMissing(
                "GENERAL_ANNOUNCEMENT",
                "General Announcement",
                NotificationCategory.SYSTEM,
                "General operational announcement to students or trainers.",
                "[FAMS] {{announcementTitle}}",
                "<p>Hello {{studentName}},</p><p>{{message}}</p><p>Regards,<br/>FAMS Team</p>",
                "{\"studentName\":\"Nguyen Van A\",\"announcementTitle\":\"Schedule Update\",\"message\":\"Please check the updated schedule in FAMS LMS.\"}"
        );
    }

    private void seedIfMissing(
            String code,
            String name,
            NotificationCategory category,
            String description,
            String subjectTemplate,
            String bodyHtml,
            String sampleVariablesJson
    ) {
        if (templateRepository.existsByTenantIdAndCodeIgnoreCase(TenantNotificationPolicy.DEFAULT_TENANT_ID, code)) {
            return;
        }
        EmailTemplate saved = templateRepository.save(EmailTemplate.builder()
                .tenantId(TenantNotificationPolicy.DEFAULT_TENANT_ID)
                .code(code)
                .name(name)
                .category(category)
                .description(description)
                .active(true)
                .currentVersion(1)
                .subjectTemplate(subjectTemplate)
                .bodyHtml(EmailHtmlSanitizer.sanitizeHtml(bodyHtml))
                .sampleVariablesJson(sampleVariablesJson)
                .systemSeeded(true)
                .build());
        versionRepository.save(EmailTemplateVersion.builder()
                .templateId(saved.getId())
                .version(1)
                .subjectTemplate(saved.getSubjectTemplate())
                .bodyHtml(saved.getBodyHtml())
                .changeNote("System default seed")
                .build());
        log.debug("Seeded default email template {}", code);
    }
}
