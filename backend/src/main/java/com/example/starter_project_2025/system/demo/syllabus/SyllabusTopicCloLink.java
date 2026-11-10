package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Explicit many-to-many link. A Topic may support many CLOs, and vice versa. */
@Entity
@Table(name = "syllabus_topic_clo_links", uniqueConstraints = @UniqueConstraint(
        name = "uk_syllabus_topic_clo", columnNames = {"topic_id", "clo_id"}))
@Getter
@Setter
@NoArgsConstructor
public class SyllabusTopicCloLink extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false)
    private SyllabusTopic topic;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "clo_id", nullable = false)
    private SyllabusClo clo;
}
