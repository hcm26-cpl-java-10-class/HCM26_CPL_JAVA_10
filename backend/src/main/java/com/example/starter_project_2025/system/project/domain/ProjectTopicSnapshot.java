package com.example.starter_project_2025.system.project.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

@Entity
@Table(name = "project_topic_snapshots",
       uniqueConstraints = @UniqueConstraint(name = "uk_project_topic_snapshot", columnNames = "project_id"))
@Getter
@NoArgsConstructor
@Immutable
public class ProjectTopicSnapshot extends BaseEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, updatable = false)
    private Project project;

    @Column(name = "topic_code", nullable = false, updatable = false, length = 100)
    private String topicCode;

    @Column(name = "topic_title", nullable = false, updatable = false, length = 255)
    private String topicTitle;

    @Column(nullable = false, updatable = false, length = 50)
    private String version;

    @Lob @Column(updatable = false)
    private String description;

    @Lob @Column(updatable = false)
    private String objectives;

    @Lob @Column(name = "requirements_json", updatable = false)
    private String requirementsJson;

    @Lob @Column(name = "attachments_json", updatable = false)
    private String attachmentsJson;

    @Builder
    public ProjectTopicSnapshot(Project project, String topicCode, String topicTitle,
            String version, String description, String objectives,
            String requirementsJson, String attachmentsJson) {
        this.project = project;
        this.topicCode = topicCode;
        this.topicTitle = topicTitle;
        this.version = version;
        this.description = description;
        this.objectives = objectives;
        this.requirementsJson = requirementsJson;
        this.attachmentsJson = attachmentsJson;
    }
}
