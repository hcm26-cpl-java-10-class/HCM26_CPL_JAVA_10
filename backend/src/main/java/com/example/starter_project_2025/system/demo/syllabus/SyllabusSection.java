package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "syllabus_sections")
@Getter
@Setter
@NoArgsConstructor
public class SyllabusSection extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "syllabus_id", nullable = false)
    private Syllabus syllabus;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;
}