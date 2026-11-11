package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** Classes explicitly created in this application; external class profiles remain externally owned. */
@Entity
@Table(name = "managed_teaching_classes")
@Getter @Setter @NoArgsConstructor
public class ManagedTeachingClass extends BaseEntity {
    @Column(nullable = false, unique = true, updatable = false)
    private Long referenceId;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, unique = true, length = 200)
    private String normalizedName;
    @Column(nullable = false)
    private LocalDate startDate;
    @Column(nullable = false)
    private LocalDate endDate;
    @Column(nullable = false)
    private Integer plannedSize;
}
