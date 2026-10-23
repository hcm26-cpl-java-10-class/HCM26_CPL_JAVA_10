package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "projects")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("PROJECT")
public class Project extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    String name;

    /**
     * Operating window of the project. Sprints must be scheduled inside it
     * (UFR-PRJ-003-01). May be {@code null} when the project does not restrict
     * its timeline.
     */
    @Column(name = "start_date")
    LocalDate startDate;

    @Column(name = "end_date")
    LocalDate endDate;
}
