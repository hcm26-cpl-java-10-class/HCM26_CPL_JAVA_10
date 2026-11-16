package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * Persists Topic syllabus outline, delivery principles, and assessment scheme per Subject.
 */
@Entity
@Data
@EqualsAndHashCode(callSuper = true, exclude = "subject")
@ToString(callSuper = true, exclude = "subject")
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "subject_syllabuses",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_subject_syllabus_subject_id", columnNames = "subject_id")
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubjectSyllabus extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false, unique = true)
    Subject subject;

    @Column(name = "pass_score", length = 50)
    String passScore;

    @Lob
    @Column(name = "meta_json", columnDefinition = "LONGTEXT")
    String metaJson;

    @Lob
    @Column(name = "chapters_json", columnDefinition = "LONGTEXT")
    String chaptersJson;

    @Lob
    @Column(name = "assessment_scheme_json", columnDefinition = "LONGTEXT")
    String assessmentSchemeJson;
}

