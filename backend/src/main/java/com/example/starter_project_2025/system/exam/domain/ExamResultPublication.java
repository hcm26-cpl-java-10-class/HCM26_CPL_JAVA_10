
package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "exam_result_publication",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_exam_result_publication_exam",
                        columnNames = "exam_id"
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExamResultPublication extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "exam_id",
            nullable = false,
            unique = true
    )
    private Exam exam;

    @Enumerated(EnumType.STRING)
    @Column(name = "release_policy", nullable = false, length = 40)
    private ScoreReleasePolicy releasePolicy =
            ScoreReleasePolicy.MY_SCORES_ONLY;

    @Column(name = "published", nullable = false)
    private boolean published = false;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "published_by")
    private Long publishedBy;

    @Column(name = "unpublished_at")
    private LocalDateTime unpublishedAt;

    @Column(name = "unpublished_by")
    private Long unpublishedBy;
}