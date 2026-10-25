package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.Builder;
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
        name = "team_members",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_team_member_user_team", columnNames = {"team_id", "user_id"})
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TeamMember extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "project_role", nullable = false,
            columnDefinition = "varchar(32) default 'UNASSIGNED'")
    private ProjectRole projectRole = ProjectRole.UNASSIGNED;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "participation_status", nullable = false,
            columnDefinition = "varchar(32) default 'ACTIVE'")
    private ParticipationStatus participationStatus = ParticipationStatus.ACTIVE;

    @Column(name = "joined_at")
    private java.time.Instant joinedAt;

    @jakarta.persistence.PrePersist
    void initializeJoinedAt() {
        if (joinedAt == null) joinedAt = java.time.Instant.now();
    }

    public boolean isCurrentParticipant() {
        return Boolean.TRUE.equals(getIsActive())
                && participationStatus == ParticipationStatus.ACTIVE;
    }
}

