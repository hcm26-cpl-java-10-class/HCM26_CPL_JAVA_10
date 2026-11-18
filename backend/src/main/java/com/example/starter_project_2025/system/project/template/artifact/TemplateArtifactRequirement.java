package com.example.starter_project_2025.system.project.template.artifact;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "project_template_artifact_requirements")
@Getter
@Setter
@NoArgsConstructor
public class TemplateArtifactRequirement extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private ProjectTemplate template;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "milestone_id", nullable = false)
    private TemplateMilestone milestone;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "artifact_type", nullable = false, length = 10)
    private TemplateArtifactType type;

    @ElementCollection
    @CollectionTable(name = "project_template_artifact_file_types", joinColumns = @JoinColumn(name = "requirement_id"))
    @Column(name = "mime_type", nullable = false, length = 100)
    private Set<String> allowedMimeTypes = new LinkedHashSet<>();

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;
}
