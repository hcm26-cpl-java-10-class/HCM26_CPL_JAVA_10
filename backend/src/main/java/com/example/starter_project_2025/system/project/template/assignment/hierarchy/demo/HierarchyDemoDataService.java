package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectTeamPublishCoordinator;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAudit;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAuditRepository;
import com.example.starter_project_2025.system.project.template.assignment.hierarchy.AssignmentDtos;
import com.example.starter_project_2025.system.project.template.assignment.hierarchy.ProjectAssignmentService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class HierarchyDemoDataService {
    private static final String ACTION = "HIERARCHY_DEMO_SEEDED_V1";
    private final UserRepository users;
    private final ProjectTemplateAuditRepository audits;
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectAssignmentService assignments;
    private final ProjectTeamPublishCoordinator publisher;
    private final HierarchyDemoTeams teams;
    private final HierarchyDemoTemplates templates;
    @Value("${app.seed.admin.email:admin@example.com}") private String seedAdminEmail;

    @Transactional
    public void seed() {
        var tenant = users.findByEmail(seedAdminEmail).orElseThrow().getTenant();
        if (tenant == null || !Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) return;
        String marker = UUID.nameUUIDFromBytes(("hierarchy-demo-v1:" + tenant.getId()).getBytes(StandardCharsets.UTF_8)).toString();
        if (audits.existsByTenantIdAndActionAndCorrelationId(tenant.getId(), ACTION, marker)) return;
        var admin = teams.admin(tenant);
        var mentor = teams.mentor(tenant);
        var previous = SecurityContextHolder.getContext();
        var principal = UserPrincipal.fromUser(admin);
        Authentication authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        try {
            var library = templates.create(admin);
            var ready = teams.classroom(tenant, mentor, library.master(), "HIER-DEMO-READY",
                    "Hierarchy Demo - Assignment Ready", "ready", List.of("Auth", "Payment", "Catalog", "Whole", "Busy"));
            var view = teams.classroom(tenant, mentor, library.master(), "HIER-DEMO-VIEW",
                    "Hierarchy Demo - Assigned Modules", "view", List.of("Auth", "Payment", "Catalog"));
            var whole = teams.classroom(tenant, mentor, library.master(), "HIER-DEMO-WHOLE",
                    "Hierarchy Demo - Whole Master", "view", List.of("Whole"));
            Long versionId = versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                    library.master().getId(), ProjectTemplateVersionStatus.PUBLISHED).orElseThrow().getId();
            var mappings = IntStream.range(0, library.modules().size()).mapToObj(index ->
                    new AssignmentDtos.ModuleTeam(library.modules().get(index).getId(), view.teams().get(index).getId())).toList();
            assignments.assign(view.trainingClass().getId(), view.session().getId(), "hier-demo-split",
                    new AssignmentDtos.Request(library.master().getId(), versionId, AssignmentDtos.Mode.SPLIT,
                            null, mappings), authentication);
            assignments.assign(whole.trainingClass().getId(), whole.session().getId(), "hier-demo-whole",
                    new AssignmentDtos.Request(library.master().getId(), versionId, AssignmentDtos.Mode.WHOLE,
                            whole.teams().getFirst().getId(), List.of()), authentication);
            publish(view, "hier-demo-publish-view", authentication);
            publish(whole, "hier-demo-publish-whole", authentication);
            audits.saveAndFlush(new ProjectTemplateAudit(tenant.getId(), library.master().getId(), admin.getId(), ACTION,
                    null, "{\"readyClassId\":" + ready.trainingClass().getId() + ",\"viewClassId\":" + view.trainingClass().getId() + "}", marker));
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }

    private void publish(HierarchyDemoTeams.Classroom classroom, String key, Authentication authentication) {
        var result = publisher.publishSession(classroom.trainingClass().getId(), classroom.session().getId(), key, authentication);
        if (!result.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Unable to publish the hierarchy demo: " + result.getBody());
        }
    }
}
