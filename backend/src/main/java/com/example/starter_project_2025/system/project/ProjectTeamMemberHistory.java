package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "project_team_member_history")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTeamMemberHistory extends BaseEntity {

    @PreUpdate
    @PreRemove
    void rejectMutation() {
        throw new IllegalStateException("Team member history is append-only");
    }

    @Column(name = "class_id", nullable = false)
    Long classId;

    @Column(name = "cohort_id")
    Long cohortId;

    @Column(name = "allocation_session_id", nullable = false)
    Long allocationSessionId;

    @Column(name = "active_at_event")
    Boolean activeAtEvent;

    @Column(name = "member_id", nullable = false)
    Long memberId;

    @Column(name = "member_name", nullable = false, length = 255)
    String memberName;

    @Column(name = "from_team_id")
    Long fromTeamId;

    @Column(name = "from_team_name", length = 255)
    String fromTeamName;

    @Column(name = "to_team_id")
    Long toTeamId;

    @Column(name = "to_team_name", length = 255)
    String toTeamName;

    @Column(name = "from_role", length = 30)
    String fromRole;

    @Column(name = "to_role", length = 30)
    String toRole;

    @Column(nullable = false, length = 40)
    String action;

    @Column(columnDefinition = "TEXT")
    String reason;

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Column(name = "actor_name", nullable = false, length = 255)
    String actorName;
}
