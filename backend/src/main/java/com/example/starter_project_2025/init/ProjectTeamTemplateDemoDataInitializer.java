package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateLevel;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneChecklistItem;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
import com.example.starter_project_2025.system.project.template.milestone.TemplateRubricCriterion;
import java.math.BigDecimal;
import java.util.ArrayList;
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

    /** code, name, description, category, level, weeks, constraints JSON (US-10 window + US-11 quotas) */
    private static final List<TemplateSeed> TEMPLATES = List.of(
            new TemplateSeed(
                    "US10-TPL-WEB-4-6",
                    "Ứng dụng Web Java (4-6 thành viên)",
                    "Đề bài mẫu cho nhóm phát triển ứng dụng web với Java Spring Boot và React.",
                    "Web Application",
                    ProjectTemplateLevel.INTERMEDIATE,
                    10,
                    constraints(4, 6, false,
                            "\"PM\":{\"min\":1,\"max\":1},"
                                    + "\"BA\":{\"min\":1,\"max\":1},"
                                    + "\"DEV\":{\"min\":1,\"max\":4},"
                                    + "\"QA\":{\"min\":1,\"max\":1}")),
            new TemplateSeed(
                    "US10-TPL-DATA-2-5",
                    "Phân tích dữ liệu (2-5 thành viên)",
                    "Đề bài mẫu cho nhóm xây dựng pipeline phân tích dữ liệu và báo cáo.",
                    "Data Analytics",
                    ProjectTemplateLevel.BEGINNER,
                    8,
                    constraints(2, 5, true,
                            "\"PM\":{\"min\":1,\"max\":2},"
                                    + "\"BA\":{\"min\":0,\"max\":1},"
                                    + "\"DEV\":{\"min\":1,\"max\":4},"
                                    + "\"QA\":{\"min\":0,\"max\":1}")),
            new TemplateSeed(
                    "US10-TPL-CAPSTONE-5-7",
                    "Đồ án Capstone (5-7 thành viên)",
                    "Đề bài mẫu cho đồ án tốt nghiệp với các mốc bảo vệ giữa kỳ và cuối kỳ.",
                    "Capstone",
                    ProjectTemplateLevel.ADVANCED,
                    15,
                    constraints(5, 7, false,
                            "\"PM\":{\"min\":1,\"max\":1},"
                                    + "\"BA\":{\"min\":1,\"max\":1},"
                                    + "\"DEV\":{\"min\":2,\"max\":4},"
                                    + "\"QA\":{\"min\":1,\"max\":1}")),
            new TemplateSeed(
                    "US10-TPL-MOBILE-3-4",
                    "Ứng dụng Mobile (3-4 thành viên)",
                    "Đề bài mẫu cho nhóm phát triển ứng dụng di động đa nền tảng.",
                    "Mobile Application",
                    ProjectTemplateLevel.INTERMEDIATE,
                    9,
                    constraints(3, 4, true,
                            "\"PM\":{\"min\":1,\"max\":1},"
                                    + "\"BA\":{\"min\":1,\"max\":1},"
                                    + "\"DEV\":{\"min\":1,\"max\":2},"
                                    + "\"QA\":{\"min\":0,\"max\":1}")),
            // US-11 test fixture: 4-8 members and multi-role enabled.
            new TemplateSeed(
                    "US11-TPL-MULTIROLE-4-8",
                    "Đề bài kiêm nhiệm (4-8 thành viên)",
                    "Đề bài mẫu cho phép một thành viên đảm nhận nhiều vai trò.",
                    "Cross-functional",
                    ProjectTemplateLevel.INTERMEDIATE,
                    12,
                    constraints(4, 8, true,
                            "\"PM\":{\"min\":1,\"max\":2},"
                                    + "\"BA\":{\"min\":1,\"max\":2},"
                                    + "\"DEV\":{\"min\":1,\"max\":8},"
                                    + "\"QA\":{\"min\":0,\"max\":2}"))
    );

    private final ProjectTemplateRepository projectTemplateRepository;
    private final TemplateMilestoneRepository templateMilestones;
    private final TemplateBacklogItemRepository templateBacklogItems;

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
            template.setDescription(seed.description());
            template.setCategory(seed.category());
            template.setLevel(seed.level());
            template.setEstimatedDurationWeeks(seed.estimatedDurationWeeks());
            template.setConstraintsJson(seed.constraintsJson());
            template.setIsActive(true);
            ProjectTemplate savedTemplate = projectTemplateRepository.save(template);
            seedBriefContent(savedTemplate);
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

    /**
     * US-13 sample brief content: the assignment flow copies exactly this data
     * into the project snapshot and from there into milestones, sprint backlog
     * items. Idempotent: a template that already owns
     * milestone rows is left untouched.
     */
    private void seedBriefContent(ProjectTemplate template) {

        List<TemplateMilestone> existing =
                templateMilestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        if (!existing.isEmpty() || template.getId() == null) {
            return;
        }

        List<TemplateMilestone> plan = new ArrayList<>();
        plan.add(milestone(template, 0,
                "Kick-off & phân tích yêu cầu",
                "Chốt phạm vi, đối tượng người dùng và tiêu chí nghiệm thu với mentor.",
                1, TemplateMilestoneTimeUnit.WEEKS, "20.00",
                null, null,
                List.of("Hoàn thành phỏng vấn người dùng", "Ký xác nhận phạm vi với mentor"),
                List.of("Phân tích yêu cầu", "Kế hoạch dự án")));
        plan.add(milestone(template, 1,
                "Bản thảo chức năng chính",
                "Hoàn thiện luồng nghiệp vụ cốt lõi, API và kiểm thử tự động cho chức năng chính.",
                3, TemplateMilestoneTimeUnit.WEEKS, "40.00",
                2, "10.00",
                List.of("API chính chạy được end-to-end", "Có kiểm thử tự động cho luồng chính"),
                List.of("Chức năng hoàn chỉnh", "Chất lượng mã nguồn")));
        plan.add(milestone(template, 2,
                "Hoàn thiện & bàn giao",
                "Demo sản phẩm, tài liệu bàn giao và tổng kết bài học kinh nghiệm.",
                6, TemplateMilestoneTimeUnit.WEEKS, "40.00",
                2, "10.00",
                List.of("Tài liệu hướng dẫn sử dụng", "Buổi demo với mentor"),
                List.of("Mức độ hoàn thiện", "Tài liệu và thuyết trình")));

        templateMilestones.saveAllAndFlush(plan);

        List<TemplateBacklogItem> backlog = List.of(
                backlogItem(template, "Phân tích yêu cầu & phạm vi",
                        "Liệt kê actor, use case và tiêu chí nghiệm thu.", ProjectMemberRole.BA, 0),
                backlogItem(template, "Thiết kế kiến trúc & cơ sở dữ liệu",
                        "Sơ đồ kiến trúc, mô hình dữ liệu và hợp đồng API.", ProjectMemberRole.DEV, 1),
                backlogItem(template, "Triển khai API chính",
                        "Cài đặt các endpoint cốt lõi kèm xác thực và phân quyền.", ProjectMemberRole.DEV, 2),
                backlogItem(template, "Giao diện người dùng",
                        "Màn hình chính, điều hướng và xử lý trạng thái lỗi.", ProjectMemberRole.DEV, 3),
                backlogItem(template, "Kiểm thử & tài liệu",
                        "Kiểm thử hồi quy, tài liệu bàn giao và kịch bản demo.", ProjectMemberRole.QA, 4));
        templateBacklogItems.saveAllAndFlush(backlog);

    }

    private TemplateMilestone milestone(ProjectTemplate template,
                                        int orderIndex,
                                        String title,
                                        String description,
                                        int dueAfter,
                                        TemplateMilestoneTimeUnit dueUnit,
                                        String weight,
                                        Integer maxLateDays,
                                        String penaltyPerDayPercent,
                                        List<String> checklist,
                                        List<String> rubricCriteria) {

        TemplateMilestone milestone = new TemplateMilestone();
        milestone.setTemplate(template);
        milestone.setTitle(title);
        milestone.setDescription(description);
        milestone.setDueAfter(dueAfter);
        milestone.setDueUnit(dueUnit);
        milestone.setWeight(new BigDecimal(weight));
        milestone.setMandatory(true);
        milestone.setOrderIndex(orderIndex);
        milestone.setAllowLateSubmission(maxLateDays != null);
        milestone.setMaxLateDays(maxLateDays == null ? 0 : maxLateDays);
        milestone.setPenaltyPerDayPercent(maxLateDays == null
                ? BigDecimal.ZERO
                : new BigDecimal(penaltyPerDayPercent));

        for (int index = 0; index < checklist.size(); index++) {
            TemplateMilestoneChecklistItem item = new TemplateMilestoneChecklistItem();
            item.setMilestone(milestone);
            item.setContent(checklist.get(index));
            item.setMandatory(index == 0);
            item.setOrderIndex(index);
            milestone.getChecklistItems().add(item);
        }
        for (int index = 0; index < rubricCriteria.size(); index++) {
            TemplateRubricCriterion criterion = new TemplateRubricCriterion();
            criterion.setMilestone(milestone);
            criterion.setName(rubricCriteria.get(index));
            criterion.setDescription("Tiêu chí đánh giá: " + rubricCriteria.get(index));
            criterion.setMaxScore(new BigDecimal("5.00"));
            criterion.setOrderIndex(index);
            milestone.getRubricCriteria().add(criterion);
        }
        return milestone;
    }

    private TemplateBacklogItem backlogItem(ProjectTemplate template,
                                            String title,
                                            String description,
                                            ProjectMemberRole suggestedRole,
                                            int orderIndex) {

        TemplateBacklogItem item = new TemplateBacklogItem();
        item.setTemplate(template);
        item.setTitle(title);
        item.setDescription(description);
        item.setSuggestedRole(suggestedRole);
        item.setOrderIndex(orderIndex);
        return item;
    }

    private record TemplateSeed(
            String code,
            String name,
            String description,
            String category,
            ProjectTemplateLevel level,
            Integer estimatedDurationWeeks,
            String constraintsJson
    ) {
    }
}
