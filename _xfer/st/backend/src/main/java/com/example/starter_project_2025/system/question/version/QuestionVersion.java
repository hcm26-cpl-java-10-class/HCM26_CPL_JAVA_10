package com.example.starter_project_2025.system.question.version;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One saved state of a question-bank question (state AFTER a create / edit / restore). */
@Entity
@Table(name = "question_version",
        uniqueConstraints = @UniqueConstraint(name = "uk_question_version", columnNames = {"question_id", "version_number"}))
@Getter @Setter @NoArgsConstructor
public class QuestionVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    /** JSON of {@link QuestionSnapshot}. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String snapshot;

    @Column(length = 200)
    private String note;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(nullable = false)
    private Instant createdAt;
}
