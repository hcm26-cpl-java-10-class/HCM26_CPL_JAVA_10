package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.template.ProjectTemplateLevel;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Isolated, opt-in catalogue for the US-PRJ-001 picker acceptance scenarios. */
@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
@Profile("!prod")
@ConditionalOnProperty(prefix = "app.seed.us-prj-001", name = "enabled", havingValue = "true")
public class ProjectTemplateSearchDemoDataInitializer implements CommandLineRunner {
    private static final String PREFIX = "USPRJ001-";
    private static final String OTHER_TENANT_CODE = "USPRJ001-ISOLATED-TENANT";

    private final UserRepository users;
    private final TenantRepository tenants;
    private final TrainingClassRepository classes;
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final TemplateMilestoneRepository milestones;
    private final TemplateBacklogItemRepository backlog;
    private final ObjectMapper mapper;

    @Value("${app.seed.admin.email:admin@example.com}")
    private String adminEmail;

    private record Spec(String name, String category, ProjectTemplateLevel level,
            Set<String> technologies, Set<String> roles, Set<String> outcomes) {}

    private static final List<Spec> CATALOGUE = List.of(
            spec("Cổng học tập React Java", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,TEAMWORK"),
            spec("Nền tảng tuyển dụng", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK,BA", "REST API,AUTHENTICATION"),
            spec("Quản lý thư viện số", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,DATABASE DESIGN"),
            spec("Đặt lịch khám bệnh", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK,QA", "REST API,TESTING"),
            spec("Hệ thống bán hàng", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,PAYMENT FLOW"),
            spec("Quản lý khóa học", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK,BA", "REST API,TEAMWORK"),
            spec("Theo dõi công việc nhóm", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,AGILE"),
            spec("Cổng đăng ký sự kiện", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,AUTHENTICATION"),
            spec("Đặt phòng và tài nguyên", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,DATABASE DESIGN"),
            spec("Hệ thống hỗ trợ khách hàng", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK,QA", "REST API,TESTING"),
            spec("Quản lý kho đa chi nhánh", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,DATABASE DESIGN"),
            spec("Theo dõi thực tập", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                    "REACT,JAVA", "FULLSTACK", "REST API,TEAMWORK"),
            spec("Dashboard dữ liệu bán hàng", "Data Analytics", ProjectTemplateLevel.BEGINNER,
                    "PYTHON,SQL", "DATA ANALYST", "DATA VISUALIZATION,SQL"),
            spec("Phân tích phản hồi khách hàng", "Data Analytics", ProjectTemplateLevel.INTERMEDIATE,
                    "PYTHON,POWER BI", "DATA ANALYST", "DATA VISUALIZATION,REPORTING"),
            spec("Ứng dụng di động học ngoại ngữ", "Mobile Application", ProjectTemplateLevel.INTERMEDIATE,
                    "FLUTTER,FIREBASE", "MOBILE", "MOBILE UI,AUTHENTICATION"),
            spec("Quản lý chi tiêu cá nhân", "Mobile Application", ProjectTemplateLevel.BEGINNER,
                    "REACT NATIVE,NODE.JS", "MOBILE", "MOBILE UI,REST API"),
            spec("Kiểm thử tự động website", "Quality Assurance", ProjectTemplateLevel.INTERMEDIATE,
                    "SELENIUM,JAVA", "QA", "TESTING,TEST AUTOMATION"),
            spec("Pipeline triển khai ứng dụng", "DevOps", ProjectTemplateLevel.ADVANCED,
                    "DOCKER,KUBERNETES", "DEVOPS", "CI/CD,MONITORING"),
            spec("Trợ lý hỏi đáp tài liệu", "AI Application", ProjectTemplateLevel.ADVANCED,
                    "PYTHON,FASTAPI", "AI ENGINEER", "RAG,REST API"),
            spec("Cổng thông tin Vue Java", "Web Application", ProjectTemplateLevel.BEGINNER,
                    "VUE,JAVA", "FRONTEND,BACKEND", "REST API,TEAMWORK")
    );

    private static Spec spec(String name, String category, ProjectTemplateLevel level,
            String technologies, String roles, String outcomes) {
        return new Spec(name, category, level, Set.of(technologies.split(",")),
                Set.of(roles.split(",")), Set.of(outcomes.split(",")));
    }

    @Override
    @Transactional
    public void run(String... args) {
        var admin = users.findByEmail(adminEmail).orElse(null);
        if (admin == null || admin.getTenantId() == null) {
            log.warn("US-PRJ-001 fixtures skipped: admin tenant is unavailable");
            return;
        }
        Long tenantId = admin.getTenantId();
        List<Long> cohortIds = classes.findAllByTenantIdAndCohortIdIsNotNull(tenantId).stream()
                .map(TrainingClass::getCohortId).distinct().sorted().toList();
        int created = 0;
        for (int index = 0; index < CATALOGUE.size(); index++) {
            created += create(tenantId, null, String.format("%s%02d", PREFIX, index + 1),
                    CATALOGUE.get(index), ProjectTemplateStatus.ACTIVE, true);
        }
        if (cohortIds.size() >= 2) {
            created += create(tenantId, cohortIds.get(0), PREFIX + "COHORT-A-01",
                    spec("Capstone đặt lịch khám", "Capstone", ProjectTemplateLevel.ADVANCED,
                            "REACT,JAVA", "FULLSTACK", "REST API,TEAMWORK"), ProjectTemplateStatus.ACTIVE, true);
            created += create(tenantId, cohortIds.get(0), PREFIX + "COHORT-A-02",
                    spec("Quản lý học viên theo đợt", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                            "REACT,JAVA", "FULLSTACK,BA", "REST API,DATABASE DESIGN"), ProjectTemplateStatus.ACTIVE, true);
            created += create(tenantId, cohortIds.get(1), PREFIX + "COHORT-B-01",
                    spec("Quản lý lịch học cohort B", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                            "REACT,JAVA", "FULLSTACK", "REST API,TEAMWORK"), ProjectTemplateStatus.ACTIVE, true);
            created += create(tenantId, cohortIds.get(1), PREFIX + "COHORT-B-02",
                    spec("Theo dõi tiến độ cohort B", "Web Application", ProjectTemplateLevel.BEGINNER,
                            "REACT,JAVA", "FULLSTACK", "REST API,AGILE"), ProjectTemplateStatus.ACTIVE, true);
        }
        created += create(tenantId, null, PREFIX + "DRAFT",
                spec("Đề bài đang soạn", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                        "REACT,JAVA", "FULLSTACK", "REST API"), ProjectTemplateStatus.DRAFT, false);
        created += create(tenantId, null, PREFIX + "ARCHIVED",
                spec("Đề bài đã lưu trữ", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                        "REACT,JAVA", "FULLSTACK", "REST API"), ProjectTemplateStatus.ARCHIVED, true);
        created += create(tenantId, null, PREFIX + "UNPUBLISHED",
                spec("Đề bài chưa công bố baseline", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                        "REACT,JAVA", "FULLSTACK", "REST API"), ProjectTemplateStatus.ACTIVE, false);

        Tenant isolated = tenants.findByCode(OTHER_TENANT_CODE).orElseGet(() ->
                tenants.save(Tenant.builder().code(OTHER_TENANT_CODE)
                        .name("US-PRJ-001 isolated test tenant").active(true).isActive(true).build()));
        created += create(isolated.getId(), null, PREFIX + "OTHER-TENANT-01",
                spec("Đề bài chỉ thuộc tenant khác", "Web Application", ProjectTemplateLevel.INTERMEDIATE,
                        "REACT,JAVA", "FULLSTACK", "REST API"), ProjectTemplateStatus.ACTIVE, true);
        created += create(isolated.getId(), null, PREFIX + "OTHER-TENANT-02",
                spec("Dữ liệu tenant riêng biệt", "Data Analytics", ProjectTemplateLevel.BEGINNER,
                        "PYTHON,SQL", "DATA ANALYST", "REPORTING"), ProjectTemplateStatus.ACTIVE, true);
        log.info("US-PRJ-001 fixture catalogue ready: {} new templates, tenant {}, {} cohort scopes",
                created, tenantId, cohortIds.size());
    }

    private int create(Long tenantId, Long cohortId, String code, Spec spec,
            ProjectTemplateStatus status, boolean published) {
        if (templates.existsByTenantIdAndCodeAndTemplateVersion(tenantId, code, 1)) return 0;
        String description = "Đề bài mẫu US-PRJ-001: " + spec.name()
                + ". Xây dựng sản phẩm có phân tích yêu cầu, triển khai chức năng chính, kiểm thử và demo bàn giao.";
        int[] capacity = capacityFor(code);
        String constraints = "{\"min_members\":" + capacity[0] + ",\"max_members\":" + capacity[1]
                + ",\"allow_multi_role\":false,"
                + "\"role_quotas\":{\"PM\":{\"min\":1,\"max\":1},"
                + "\"BA\":{\"min\":0,\"max\":1},\"DEV\":{\"min\":1,\"max\":4},"
                + "\"QA\":{\"min\":0,\"max\":1}}}";
        ProjectTemplate template = templates.saveAndFlush(ProjectTemplate.builder()
                .tenantId(tenantId).cohortId(cohortId).code(code).name(spec.name())
                .description(description).category(spec.category()).level(spec.level())
                .estimatedDurationWeeks(8).constraintsJson(constraints).status(status)
                .technologies(spec.technologies()).targetRoles(spec.roles())
                .learningOutcomes(spec.outcomes()).isActive(true).build());
        if (status == ProjectTemplateStatus.ACTIVE || status == ProjectTemplateStatus.ARCHIVED) {
            milestones.saveAllAndFlush(List.of(
                    milestone(template, 0, "Phân tích yêu cầu", 2, "40.00"),
                    milestone(template, 1, "Demo và bàn giao", 7, "60.00")));
            backlog.saveAllAndFlush(List.of(
                    backlog(template, 0, "Thiết kế dữ liệu và API", ProjectMemberRole.DEV),
                    backlog(template, 1, "Kiểm thử luồng chính", ProjectMemberRole.QA)));
        }
        versions.save(ProjectTemplateSnapshot.builder().templateId(template.getId()).version("v1.0")
                .status(published ? ProjectTemplateVersionStatus.PUBLISHED : ProjectTemplateVersionStatus.DRAFT)
                .isActive(true).contentJson(content(template, spec, description, constraints)).build());
        return 1;
    }

    private int[] capacityFor(String code) {
        if (code.matches("USPRJ001-(1[3-6])")) return new int[] {2, 4};
        if (code.matches("USPRJ001-(1[7-9]|20)")) return new int[] {5, 8};
        return new int[] {3, 6};
    }

    private TemplateMilestone milestone(ProjectTemplate template, int order, String title,
            int dueAfter, String weight) {
        TemplateMilestone item = new TemplateMilestone();
        item.setTemplate(template);
        item.setOrderIndex(order);
        item.setTitle(title);
        item.setDescription("Hoàn thành " + title.toLowerCase() + " cho " + template.getName());
        item.setDueAfter(dueAfter);
        item.setDueUnit(TemplateMilestoneTimeUnit.WEEKS);
        item.setWeight(new BigDecimal(weight));
        item.setMandatory(true);
        item.setAllowLateSubmission(false);
        item.setMaxLateDays(0);
        item.setPenaltyPerDayPercent(BigDecimal.ZERO);
        return item;
    }

    private TemplateBacklogItem backlog(ProjectTemplate template, int order, String title,
            ProjectMemberRole role) {
        TemplateBacklogItem item = new TemplateBacklogItem();
        item.setTemplate(template);
        item.setOrderIndex(order);
        item.setTitle(title);
        item.setDescription("Hạng mục mẫu cho " + template.getName());
        item.setSuggestedRole(role);
        return item;
    }

    private String content(ProjectTemplate template, Spec spec, String description, String constraints) {
        Map<String, Object> brief = new LinkedHashMap<>();
        brief.put("templateId", template.getId());
        brief.put("name", template.getName());
        brief.put("description", description);
        brief.put("category", spec.category());
        brief.put("level", spec.level().name());
        brief.put("technologies", spec.technologies());
        brief.put("targetRoles", spec.roles());
        brief.put("learningOutcomes", spec.outcomes());
        try {
            brief.put("constraints", mapper.readTree(constraints));
            List<Map<String, Object>> plan = new ArrayList<>();
            plan.add(Map.of("title", "Phân tích yêu cầu", "description", "Chốt phạm vi và tiêu chí nghiệm thu",
                    "dueAfter", 2, "dueUnit", "WEEKS", "weight", 40));
            plan.add(Map.of("title", "Demo và bàn giao", "description", "Hoàn thiện sản phẩm và tài liệu",
                    "dueAfter", 7, "dueUnit", "WEEKS", "weight", 60));
            brief.put("milestones", plan);
            return mapper.writeValueAsString(brief);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to create US-PRJ-001 fixture brief", exception);
        }
    }
}
