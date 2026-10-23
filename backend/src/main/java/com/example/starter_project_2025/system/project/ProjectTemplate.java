package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "project_templates")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTemplate extends BaseEntity {

    @Column(nullable = false, unique = true, length = 100)
    String code;

    @Column(nullable = false, length = 255)
    String name;

    @Column(name = "constraints_json", nullable = false, columnDefinition = "TEXT")
    String constraintsJson;
}