package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import com.example.starter_project_2025.security.UserPrincipal;
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
            var ready = teams.classroom(tenant, mentor, library.master(), true);
            var view = teams.classroom(tenant, mentor, library.master(), false);
            Long versionId = versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                    library.master().getId(), ProjectTemplateVersionStatus.PUBLISHED).orElseThrow().getId();
            whole(ready, library, versionId, ready.teams().get(4).getId(), "hier-demo-busy", authentication);
            var mappings = IntStream.range(0, library.modules().size()).mapToObj(index ->
                    new AssignmentDtos.ModuleTeam(library.modules().get(index).getId(), view.teams().get(index).getId())).toList();
            assignments.assign(view.trainingClass().getId(), view.session().getId(), "hier-demo-split",
                    new AssignmentDtos.Request(library.master().getId(), versionId, AssignmentDtos.Mode.SPLIT,
                            null, mappings), authentication);
            whole(view, library, versionId, view.teams().get(3).getId(), "hier-demo-whole", authentication);
            audits.saveAndFlush(new ProjectTemplateAudit(tenant.getId(), library.master().getId(), admin.getId(), ACTION,
                    null, "{\"readyClassId\":" + ready.trainingClass().getId() + ",\"viewClassId\":" + view.trainingClass().getId() + "}", marker));
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }

    private void whole(HierarchyDemoTeams.Classroom classroom, HierarchyDemoTemplates.Library library, Long versionId,
                       Long teamId, String key, Authentication authentication) {
        assignments.assign(classroom.trainingClass().getId(), classroom.session().getId(), key,
                new AssignmentDtos.Request(library.master().getId(), versionId, AssignmentDtos.Mode.WHOLE,
                        teamId, List.of()), authentication);
    }
}
