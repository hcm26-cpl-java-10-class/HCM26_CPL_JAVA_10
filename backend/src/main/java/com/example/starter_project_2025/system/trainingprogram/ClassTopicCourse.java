package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Links a specific class's ProgramSubject (Topic) to an ACTIVE LMS Course matching that Topic.
 */
@Entity
@Table(
        name = "class_topic_courses",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_class_topic_course_class_program_subject",
                        columnNames = {"class_id", "program_subject_id"}
                )
        },
        indexes = {
                @Index(name = "idx_class_topic_course_class_id", columnList = "class_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ClassTopicCourse extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    Long classId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_subject_id", nullable = false)
    ProgramSubject programSubject;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    Course course;
}

