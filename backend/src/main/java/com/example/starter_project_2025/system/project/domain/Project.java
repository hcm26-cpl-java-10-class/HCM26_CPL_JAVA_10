package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "projects",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_project_code_tenant", columnNames = {"code", "tenant_id"})
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("PROJECT")
public class Project extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 2000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cohort_id")
    private Cohort cohort;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProjectStatus status;

}
