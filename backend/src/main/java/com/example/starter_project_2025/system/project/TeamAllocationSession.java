package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "team_allocation_sessions")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TeamAllocationSession extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    TrainingClass trainingClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_template_id")
    ProjectTemplate projectTemplate;

    @Column(name = "max_members", nullable = false)
    Integer maxMembers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    TeamAllocationSessionStatus status;

    @Version
    @Column(nullable = false)
    Long version;
}