package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByUser(User user);

    @Query("""
        select m from TeamMember m
        join fetch m.user u
        join fetch m.team t
        where t.id = :teamId and m.isActive = true
          and m.participationStatus = :status
          and u.tenant.id = t.tenant.id
        order by u.id
        """)
    List<TeamMember> findRoster(@Param("teamId") Long teamId,
                               @Param("status") ParticipationStatus status);

    boolean existsByTeamIdAndUserId(Long teamId, Long userId);

    Optional<TeamMember> findByTeamIdAndUserId(Long teamId, Long userId);

    @Query("select m from TeamMember m join fetch m.user u where m.team.id = :teamId and m.isActive = true order by u.id")
    List<TeamMember> findManagedRoster(@Param("teamId") Long teamId);
}

