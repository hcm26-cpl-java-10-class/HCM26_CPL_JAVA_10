package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditService;
import com.example.starter_project_2025.system.project.project_template_version.event.ProjectTemplateSnapshotOutboxService;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectTemplateSnapshotServiceImplTest {
    @Mock ProjectTemplateSnapshotMapper snapshotMapper;
    @Mock ProjectTemplateSnapshotRepository snapshotRepository;
    @Mock ProjectTemplateSnapshotAuditService snapshotAuditService;
    @Mock ProjectTemplateSnapshotOutboxService snapshotOutboxService;
    @Mock ProjectTemplateRepository projectTemplateRepository;
    @Mock ProjectRepository projectRepository;
    @Mock TemplateMilestoneRepository templateMilestoneRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks ProjectTemplateSnapshotServiceImpl service;

    @Test
    void createsInitialTemplateVersionWithoutProjectOwner() {
        ProjectTemplate template = new ProjectTemplate();
        template.setId(42L);
        template.setName("Template");
        when(snapshotRepository.findByTemplateIdOrderByCreatedAtDesc(42L)).thenReturn(List.of());
        when(snapshotRepository.save(any(ProjectTemplateSnapshot.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(templateMilestoneRepository.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(42L))
                .thenReturn(List.of());
        when(snapshotMapper.toResponse(any(ProjectTemplateSnapshot.class)))
                .thenAnswer(invocation -> {
                    ProjectTemplateSnapshot snapshot = invocation.getArgument(0);
                    return ProjectTemplateSnapshotDTO.builder()
                            .templateId(snapshot.getTemplateId())
                            .projectId(snapshot.getProjectId())
                            .build();
                });
        when(projectTemplateRepository.findAllById(any())).thenReturn(List.of(template));

        ProjectTemplateSnapshotDTO result = service.createInitialVersion(template);

        assertNotNull(result);
        assertEquals("Template", result.getTemplateName());
        assertNull(result.getProjectId());
        assertNull(result.getProjectName());
        verifyNoInteractions(projectRepository);
    }
}
