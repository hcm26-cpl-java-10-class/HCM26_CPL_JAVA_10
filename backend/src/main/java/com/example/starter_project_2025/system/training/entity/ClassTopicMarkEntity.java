package com.example.starter_project_2025.system.training.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "class_topic_marks",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_class_topic_mark_trainee",
                columnNames = {"class_id", "topic_code", "trainee_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassTopicMarkEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "topic_code", nullable = false, length = 100)
    private String topicCode;

    @Column(name = "topic_title", length = 500)
    private String topicTitle;

    @Column(name = "trainee_id", nullable = false)
    private Long traineeId;

    @Column(name = "student_id", length = 64)
    private String studentId;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "personal_email", length = 255)
    private String personalEmail;

    @Column(name = "scores_json", columnDefinition = "TEXT")
    private String scoresJson;

    @Column(name = "total_gpa")
    private Double totalGpa;

    @Column(name = "passed")
    private Boolean passed;

    @Column(name = "updated_at", length = 64)
    private String updatedAt;

    @Version
    private Long version;
}
