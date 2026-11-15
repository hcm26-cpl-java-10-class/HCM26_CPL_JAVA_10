package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.template.assignment.TemplateBriefSnapshotWriter;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceProvisioningService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AssignmentSnapshotService {
    public record Capture(ProjectTemplateSnapshot snapshot, ProjectResourceProvisioningService.Source source) { }

    private final ProjectTemplateSnapshotRepository snapshots;
    private final SnapshotResourceRepository resources;

    private final ProjectResourceProvisioningService provisioning;
    private final ObjectMapper json;

    public Capture capture(AssignmentTemplateReader.Node node, ProjectAssignment assignment,
                                           Long parentSnapshotId, Long teamId, String origin) {
        var content = node.content().deepCopy();
        content.remove("resources");
        content.put("purpose", TemplateBriefSnapshotWriter.PURPOSE_TEAM_ASSIGNMENT);
        content.put("assignmentId", assignment.getId());
        content.put("assignedTeamId", teamId);
        content.put("assignedClassId", assignment.getClassId());
        content.put("assignedAt", assignment.getAssignedAt().toString());
        content.put("sourceSnapshotId", node.sourceVersionId());
        content.put("sourceVersion", node.version());
        if (!content.has("context")) content.set("context", content.path("description"));
        var snapshot = ProjectTemplateSnapshot.builder().templateId(node.templateId())
                .parentTemplateId(node.sourceVersionId()).parentSnapshotId(parentSnapshotId)
                .version("A" + assignment.getId() + (teamId == null ? "-CLASS" : "-T" + teamId))
                .status(ProjectTemplateVersionStatus.PUBLISHED).isActive(false)
                .contentJson(content.toString()).build();
        snapshots.saveAndFlush(snapshot);
        List<SnapshotResource> copies = new ArrayList<>();
        var source = provisioning.capture(node.templateId(), node.sourceVersionId(), node.name(), origin);
        for (var item : source.resources()) {
            SnapshotResource copy = new SnapshotResource();
            copy.setTenantId(assignment.getTenantId());
            copy.setSnapshotId(snapshot.getId());
            copy.setSourceResourceId(item.id());
            copy.setContentJson(json.valueToTree(item).toString());
            copies.add(copy);
        }
        resources.saveAll(copies);
        return new Capture(snapshot, source);
    }
}
