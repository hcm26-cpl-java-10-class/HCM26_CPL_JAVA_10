package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "milestone_submission_versions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_submission_version_number", columnNames = {"submission_id", "version_number"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubmissionVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "submission_version_id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false, updatable = false)
    private MilestoneSubmission submission;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(name = "submission_title", nullable = false, length = 160)
    private String title;

    @Column(name = "submission_notes", length = 2000)
    private String notes;

    @Column(name = "submission_url", length = 1000)
    private String submissionUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SubmissionStatus status;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "submitted_by", nullable = false, updatable = false)
    private UUID submittedBy;

    @Column(name = "is_late", nullable = false)
    private boolean late;

    @Column(name = "penalty_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal penaltyPercent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "version", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<SubmissionArtifact> artifacts = new ArrayList<>();

    @OneToMany(mappedBy = "version", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<SubmissionChecklistSnapshot> checklist = new ArrayList<>();

    public static SubmissionVersion draft(MilestoneSubmission submission, int number, String title,
                                          String notes, String url, UUID actorId, Instant now) {
        SubmissionVersion value = new SubmissionVersion();
        value.submission = submission;
        value.versionNumber = number;
        value.title = title.trim();
        value.notes = normalize(notes);
        value.submissionUrl = normalize(url);
        value.status = SubmissionStatus.DRAFT;
        value.submittedBy = actorId;
        value.penaltyPercent = BigDecimal.ZERO.setScale(2);
        value.createdAt = now;
        return value;
    }

    public void updateDraft(String title, String notes, String url) {
        if (status != SubmissionStatus.DRAFT) throw new IllegalStateException("Only a draft version can be edited");
        this.title = title.trim();
        this.notes = normalize(notes);
        this.submissionUrl = normalize(url);
    }

    public void replaceArtifacts(List<ArtifactValue> values) {
        if (status != SubmissionStatus.DRAFT) throw new IllegalStateException("Only a draft version can be edited");
        artifacts.clear();
        for (int index = 0; index < values.size(); index++) {
            ArtifactValue item = values.get(index);
            artifacts.add(SubmissionArtifact.create(this, item.type(), item.name(), item.url(), index));
        }
    }

    public void clearArtifacts() {
        if (status != SubmissionStatus.DRAFT) throw new IllegalStateException("Only a draft version can be edited");
        artifacts.clear();
    }

    public void replaceChecklist(List<ChecklistValue> values) {
        if (status != SubmissionStatus.DRAFT) throw new IllegalStateException("Only a draft version can be edited");
        checklist.clear();
        for (int index = 0; index < values.size(); index++) {
            ChecklistValue item = values.get(index);
            checklist.add(SubmissionChecklistSnapshot.create(this, item.sourceId(), item.content(),
                    item.mandatory(), item.completed(), item.evidenceNote(), index));
        }
    }

    public void clearChecklist() {
        if (status != SubmissionStatus.DRAFT) throw new IllegalStateException("Only a draft version can be edited");
        checklist.clear();
    }

    public record ArtifactValue(SubmissionArtifactType type, String name, String url) { }
    public record ChecklistValue(UUID sourceId, String content, boolean mandatory,
                                 boolean completed, String evidenceNote) { }

    public void submit(Instant now, boolean isLate, BigDecimal penalty) {
        if (status != SubmissionStatus.DRAFT) throw new IllegalStateException("Only a draft version can be submitted");
        status = SubmissionStatus.SUBMITTED;
        submittedAt = now;
        late = isLate;
        penaltyPercent = penalty == null ? BigDecimal.ZERO.setScale(2) : penalty.setScale(2);
    }

    public void applyDecision(ReviewDecision decision) {
        if (status != SubmissionStatus.SUBMITTED) throw new IllegalStateException("Only a submitted version can be reviewed");
        status = switch (decision) {
            case ACCEPT -> SubmissionStatus.ACCEPTED;
            case REJECT -> SubmissionStatus.REJECTED;
            case REQUEST_CHANGES -> SubmissionStatus.CHANGES_REQUESTED;
        };
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
