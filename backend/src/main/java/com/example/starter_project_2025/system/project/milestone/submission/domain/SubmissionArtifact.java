package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "milestone_submission_artifacts", uniqueConstraints =
        @UniqueConstraint(name = "uk_submission_artifact_order", columnNames = {"submission_version_id", "order_index"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubmissionArtifact {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "artifact_id", nullable = false, updatable = false)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_version_id", nullable = false, updatable = false)
    private SubmissionVersion version;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
    private SubmissionArtifactType type;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(nullable = false, length = 1000)
    private String url;
    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    static SubmissionArtifact create(SubmissionVersion version, SubmissionArtifactType type,
                                     String name, String url, int orderIndex) {
        SubmissionArtifact value = new SubmissionArtifact();
        value.version = version;
        value.type = type;
        value.name = name.trim();
        value.url = url.trim();
        value.orderIndex = orderIndex;
        return value;
    }
}
