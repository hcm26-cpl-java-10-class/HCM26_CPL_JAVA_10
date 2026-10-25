package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "project_teams")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTeam extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    TrainingClass trainingClass;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "allocation_session_id", nullable = false)
    TeamAllocationSession allocationSession;

    @Column(name = "project_id")
    Long projectId;

    @Column(name = "team_name", nullable = false, length = 255)
    String teamName;

    @Column(name = "assigned_mentor_id")
    Long assignedMentorId;

    @Column(name = "max_members", nullable = false)
    Integer maxMembers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    ProjectTeamStatus status;

    @Version
    @Column(nullable = false)
    Long version;
}