package com.example.starter_project_2025.system.training.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_topic_assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassTopicAssessmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "topic_index")
    private Integer topicIndex;

    @Column(name = "title", length = 500)
    private String title;

    @Lob
    @Column(name = "assessments_json", columnDefinition = "TEXT")
    private String assessmentsJson;
}

