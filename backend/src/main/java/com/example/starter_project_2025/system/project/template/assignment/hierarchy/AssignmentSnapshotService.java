package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.template.assignment.TemplateBriefSnapshotWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AssignmentSnapshotService {
    private final ProjectTemplateSnapshotRepository snapshots;
    private final SnapshotResourceRepository resources;

    public ProjectTemplateSnapshot capture(AssignmentTemplateReader.Node node, ProjectAssignment assignment,
                                           Long parentSnapshotId, Long teamId) {
        var content = node.content().deepCopy();
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
        for (var file : content.path("resources")) {
            if (!file.path("id").canConvertToLong() || file.path("id").asLong() <= 0)
                throw AssignmentException.invalid("The saved resource metadata is invalid");
            SnapshotResource copy = new SnapshotResource();
            copy.setTenantId(assignment.getTenantId());
            copy.setSnapshotId(snapshot.getId());
            copy.setSourceResourceId(file.path("id").asLong());
            copy.setContentJson(file.toString());
            copies.add(copy);
        }
        resources.saveAll(copies);
        return snapshot;
    }
}
