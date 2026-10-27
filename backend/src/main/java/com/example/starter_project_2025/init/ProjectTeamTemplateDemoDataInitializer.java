package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-10 demo fixtures: project templates with an explicit
 * {@code min_members}/{@code max_members} window so the "assign project
 * template to a DRAFT team" flow has something to pick from.
 * <p>
 * Idempotent (upsert by {@code code}) and disabled with
 * {@code TEAM_ALLOCATION_DEMO_SEED_ENABLED=false} or the {@code prod} profile.
 * Delete this file to remove the fixtures completely.
 */
@Slf4j
@Order(15)
@Component
@RequiredArgsConstructor
@Profile("!prod")
@ConditionalOnProperty(
        prefix = "app.seed.team-allocation",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class ProjectTeamTemplateDemoDataInitializer implements CommandLineRunner {

    /** code, name, constraints JSON (US-10 capacity window + US-11 role quotas) */
    private static final List<TemplateSeed> TEMPLATES = List.of(
            new TemplateSeed(
                    "US10-TPL-WEB-4-6",
                    "Ứng dụng Web Java (4-6 thành viên)",
                    constraints(4, 6, false,
                            "\"PM\":{\"min\":1,\"max\":1},"
                                    + "\"BA\":{\"min\":1,\"max\":1},"
                                    + "\"DEV\":{\"min\":1,\"max\":4},"
                                    + "\"QA\":{\"min\":1,\"max\":1}")),
            new TemplateSeed(
                    "US10-TPL-DATA-2-5",
                    "Phân tích dữ liệu (2-5 thành viên)",
                    constraints(2, 5, true,
                            "\"PM\":{\"min\":1,\"max\":2},"
                                    + "\"BA\":{\"min\":0,\"max\":1},"
                                    + "\"DEV\":{\"min\":1,\"max\":4},"
                                    + "\"QA\":{\"min\":0,\"max\":1}")),
            new TemplateSeed(
                    "US10-TPL-CAPSTONE-5-7",
                    "Đồ án Capstone (5-7 thành viên)",
                    constraints(5, 7, false,
                            "\"PM\":{\"min\":1,\"max\":1},"
                                    + "\"BA\":{\"min\":1,\"max\":1},"
                                    + "\"DEV\":{\"min\":2,\"max\":4},"
                                    + "\"QA\":{\"min\":1,\"max\":1}")),
            new TemplateSeed(
                    "US10-TPL-MOBILE-3-4",
                    "Ứng dụng Mobile (3-4 thành viên)",
                    constraints(3, 4, true,
                            "\"PM\":{\"min\":1,\"max\":1},"
                                    + "\"BA\":{\"min\":1,\"max\":1},"
                                    + "\"DEV\":{\"min\":1,\"max\":2},"
                                    + "\"QA\":{\"min\":0,\"max\":1}")),
            // US-11 test fixture: 4-8 members and multi-role enabled.
            new TemplateSeed(
                    "US11-TPL-MULTIROLE-4-8",
                    "Đề bài kiêm nhiệm (4-8 thành viên)",
                    constraints(4, 8, true,
                            "\"PM\":{\"min\":1,\"max\":2},"
                                    + "\"BA\":{\"min\":1,\"max\":2},"
                                    + "\"DEV\":{\"min\":1,\"max\":8},"
                                    + "\"QA\":{\"min\":0,\"max\":2}"))
    );

    private final ProjectTemplateRepository projectTemplateRepository;

    @Override
    @Transactional
    public void run(String... args) {
        int created = 0;
        for (TemplateSeed seed : TEMPLATES) {
            ProjectTemplate template = projectTemplateRepository
                    .findByCodeAndTenantIdIsNullAndIsActiveTrue(seed.code())
                    .or(() -> projectTemplateRepository.findAll().stream()
                            .filter(row -> row.getTenantId() == null && seed.code().equals(row.getCode()))
                            .findFirst())
                    .orElseGet(() -> {
                        ProjectTemplate fresh = new ProjectTemplate();
                        fresh.setCode(seed.code());
                        return fresh;
                    });

            if (template.getId() == null) {
                created++;
            }
            template.setName(seed.name());
            template.setConstraintsJson(seed.constraintsJson());
            template.setIsActive(true);
            projectTemplateRepository.save(template);
        }

        ensureManualDefaultTemplate();
        projectTemplateRepository.flush();
        log.info("US-10 project template fixtures ensured ({} new, {} total).",
                created, TEMPLATES.size());
    }

    /**
     * The manual allocation session falls back to this template; giving it an
     * explicit window keeps {@code ProjectTemplateConstraints} happy.
     */
    private void ensureManualDefaultTemplate() {
        projectTemplateRepository.findByCodeAndTenantIdIsNullAndIsActiveTrue("MANUAL-GROUPING-DEFAULT")
                .ifPresent(template -> {
                    String expected = "{\"min_members\":1,\"max_members\":5}";
                    if (!expected.equals(template.getConstraintsJson())) {
                        template.setConstraintsJson(expected);
                        projectTemplateRepository.save(template);
                    }
                });
    }

    private static String constraints(
            int minMembers,
            int maxMembers,
            boolean allowMultiRole,
            String roleQuotas
    ) {
        return "{\"min_members\":" + minMembers
                + ",\"max_members\":" + maxMembers
                + ",\"allow_multi_role\":" + allowMultiRole
                + ",\"role_quotas\":{" + roleQuotas + "}}";
    }

    private record TemplateSeed(
            String code,
            String name,
            String constraintsJson
    ) {
    }
}
