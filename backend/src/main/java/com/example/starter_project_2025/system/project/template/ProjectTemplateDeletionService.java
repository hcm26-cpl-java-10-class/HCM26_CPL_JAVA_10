package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.TeamAllocationSessionRepository;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEvent;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTemplateDeletionService {
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateAccessService access;
    private final ProjectTeamRepository teams;
    private final TeamAllocationSessionRepository sessions;
    private final TrainingClassRepository classes;
    private final ProjectTemplateSnapshotRepository snapshots;
    private final ProjectRepository projects;
    private final ProjectTemplateAuditRepository audits;
    private final OutboxEventRepository events;
    private final TemplateTeamConstraintsMapper constraints;
    private final ObjectMapper json;

    @Transactional
    public void delete(Long id, Long lockVersion) {
        var user = access.requireUser("ARCHIVE");
        var template = templates.findForTemplateUpdate(id, user.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Project template was not found"));
        if (lockVersion == null || !lockVersion.equals(template.getLockVersion())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before deleting");
        }
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) {
            throw new ProjectTemplateException(422, "Only unused draft templates can be deleted. Archive active templates instead", Map.of());
        }
        var versionIds = snapshots.findByTemplateIdOrderByCreatedAtDesc(id).stream().map(ProjectTemplateSnapshot::getId).toList();
        if (teams.existsByProjectTemplate_Id(id) || sessions.existsByProjectTemplate_Id(id)
                || classes.existsByProjectTemplate_Id(id) || snapshots.existsByTemplateIdAndProjectIdIsNotNull(id)
                || !versionIds.isEmpty() && projects.existsByTemplateSnapshotIdIn(versionIds)) {
            throw new ProjectTemplateException(422, "This template is linked to a team, class or project and cannot be deleted", Map.of());
        }
        try {
            String before = json.writeValueAsString(ProjectTemplateResponse.from(template, false, constraints.read(template.getConstraintsJson())));
            template.setIsActive(false);
            template.setUpdatedBy(user.getId());
            template.setUpdatedAt(LocalDateTime.now());
            templates.saveAndFlush(template);
            String after = json.writeValueAsString(Map.of("templateId", id, "deleted", true));
            String correlationId = CorrelationIdFilter.currentId();
            audits.save(new ProjectTemplateAudit(template.getTenantId(), id, user.getId(), "PROJECT_TEMPLATE_DELETED", before, after, correlationId));
            String payload = json.writeValueAsString(Map.of("templateId", id, "tenantId", template.getTenantId(),
                    "actorId", user.getId(), "correlationId", correlationId, "deleted", true));
            events.save(OutboxEvent.templateDeleted(template.getTenantId(), id, payload, Instant.now()));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record template deletion", exception);
        }
    }
}
