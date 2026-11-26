package com.example.starter_project_2025.system.training.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_activities")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassActivityEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    private TrainingClass trainingClass;

    @Column(name = "author", length = 100)
    private String author;

    @Column(name = "initials", length = 10)
    private String initials;

    @Column(name = "content", length = 1000)
    private String content;

    @Column(name = "timestamp", length = 50)
    private String timestamp;

    @Column(name = "type", length = 20)
    private String type;

    @JsonProperty("classId")
    public Long getClassId() {
        return trainingClass != null ? trainingClass.getId() : null;
    }
}

