package com.example.starter_project_2025.system.training.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_topic_assessments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassTopicAssessmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    private TrainingClass trainingClass;

    public Long getClassId() {
        return trainingClass != null ? trainingClass.getId() : null;
    }

    @Column(name = "topic_index")
    private Integer topicIndex;

    @Column(name = "title", length = 500)
    private String title;

    @Column(name = "assessments_json", columnDefinition = "TEXT")
    private String assessmentsJson;

    public static class ClassTopicAssessmentEntityBuilder {
        public ClassTopicAssessmentEntityBuilder classId(Long classId) {
            if (classId != null) {
                TrainingClass tc = new TrainingClass();
                tc.setId(classId);
                this.trainingClass = tc;
            }
            return this;
        }
    }
}
