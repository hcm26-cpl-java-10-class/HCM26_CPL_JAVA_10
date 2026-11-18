package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditService;
import com.example.starter_project_2025.system.project.project_template_version.event.ProjectTemplateSnapshotOutboxService;
import com.example.starter_project_2025.system.project.template.assignment.TemplateBriefSnapshotWriter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TemplateVersionLifecycleService {
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectTemplateSnapshotAuditService audits;
    private final ProjectTemplateSnapshotOutboxService events;
    private final ObjectMapper json;

    @Transactional(propagation = Propagation.MANDATORY)
    public void archivePublishedVersions(Long templateId, Long retainedVersionId, String actorEmail) {
        for (var version : versions.findByTemplateIdOrderByCreatedAtDesc(templateId)) {
            if (Objects.equals(version.getId(), retainedVersionId) || version.getStatus() != ProjectTemplateVersionStatus.PUBLISHED
                    || !Boolean.TRUE.equals(version.getIsActive()) || !isReusable(version)) continue;
            var before = state(version);
            version.setStatus(ProjectTemplateVersionStatus.ARCHIVED);
            versions.save(version);
            var after = state(version);
            after.put("replacedByVersionId", retainedVersionId);
            audits.record("ARCHIVE", version.getId(), templateId, null, before, after);
            events.enqueue("PROJECT_TEMPLATE_VERSION_ARCHIVED", version.getId(), templateId, null, actorEmail, after);
        }
    }

    public boolean isReusable(ProjectTemplateSnapshot version) {
        if (version.getProjectId() != null) return false;
        try {
            var content = json.readTree(version.getContentJson());
            return content == null || !TemplateBriefSnapshotWriter.PURPOSE_TEAM_ASSIGNMENT.equals(content.path("purpose").asText());
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            return true;
        }
    }

    private Map<String, Object> state(ProjectTemplateSnapshot version) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", version.getId());
        result.put("templateId", version.getTemplateId());
        result.put("version", version.getVersion());
        result.put("status", version.getStatus());
        result.put("contentJson", version.getContentJson());
        return result;
    }
}
