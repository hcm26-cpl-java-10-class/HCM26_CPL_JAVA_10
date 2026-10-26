package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "submission_checklist_snapshots", uniqueConstraints =
        @UniqueConstraint(name = "uk_submission_checklist_order", columnNames = {"submission_version_id", "order_index"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubmissionChecklistSnapshot {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "snapshot_item_id", nullable = false, updatable = false)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_version_id", nullable = false, updatable = false)
    private SubmissionVersion version;
    @Column(name = "source_checklist_item_id", updatable = false)
    private UUID sourceChecklistItemId;
    @Column(name = "content_snapshot", nullable = false, length = 500, updatable = false)
    private String content;
    @Column(name = "is_mandatory", nullable = false, updatable = false)
    private boolean mandatory;
    @Column(name = "is_completed", nullable = false)
    private boolean completed;
    @Column(name = "evidence_note", length = 500)
    private String evidenceNote;
    @Column(name = "order_index", nullable = false, updatable = false)
    private int orderIndex;

    static SubmissionChecklistSnapshot create(SubmissionVersion version, UUID sourceId, String content,
                                               boolean mandatory, boolean completed, String evidenceNote,
                                               int orderIndex) {
        SubmissionChecklistSnapshot value = new SubmissionChecklistSnapshot();
        value.version = version;
        value.sourceChecklistItemId = sourceId;
        value.content = content;
        value.mandatory = mandatory;
        value.completed = completed;
        value.evidenceNote = normalize(evidenceNote);
        value.orderIndex = orderIndex;
        return value;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
