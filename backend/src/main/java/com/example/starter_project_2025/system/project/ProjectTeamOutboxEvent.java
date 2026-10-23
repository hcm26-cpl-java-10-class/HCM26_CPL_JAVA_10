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
@Table(name = "project_team_outbox")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTeamOutboxEvent extends BaseEntity {

    @Column(name = "event_type", nullable = false, length = 100)
    String eventType;

    @Column(name = "aggregate_id", nullable = false)
    Long aggregateId;

    @Column(nullable = false, columnDefinition = "TEXT")
    String payload;

    @Column(name = "correlation_id", nullable = false, length = 100)
    String correlationId;

    @Column(nullable = false, length = 20)
    String status;
}
