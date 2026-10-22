package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "syllabus_clos",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_syllabus_clo_code",
                columnNames = {"syllabus_id", "code"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class SyllabusClo extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "syllabus_id", nullable = false)
    private Syllabus syllabus;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(nullable = false, length = 2000)
    private String details;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;
}