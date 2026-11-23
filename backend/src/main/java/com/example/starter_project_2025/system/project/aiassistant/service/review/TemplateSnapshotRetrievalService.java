package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TemplateSnapshotRetrievalService {

    private final ProjectTemplateSnapshotRepository snapshotRepository;

    @Transactional(readOnly = true)
    public ProjectTemplateSnapshot retrieve(Long templateId, Long snapshotId) {

        return snapshotRepository
                .findByIdAndTemplateIdAndIsActiveTrue(snapshotId, templateId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Snapshot not found or does not belong to the specified template"
                ));
    }

    @Transactional(readOnly = true)
    public ProjectTemplateSnapshot retrieveReferencedModuleSnapshot(
            Long templateId,
            Long snapshotId
    ) {
        ProjectTemplateSnapshot snapshot = snapshotRepository
                .findByIdAndTemplateIdAndIsActiveTrue(snapshotId, templateId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Module snapshot not found or does not belong to the specified template"
                ));

        if (snapshot.getProjectId() != null
                || (snapshot.getStatus() != ProjectTemplateVersionStatus.PUBLISHED
                && snapshot.getStatus() != ProjectTemplateVersionStatus.ARCHIVED)) {
            throw new IllegalArgumentException(
                    "Referenced module snapshot must be a published or archived template snapshot"
            );
        }

        return snapshot;
    }
}