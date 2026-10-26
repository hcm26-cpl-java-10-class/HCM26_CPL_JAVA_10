package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ProjectMemberRepository
        extends BaseCrudRepository<ProjectMember, Long> {

    @EntityGraph(attributePaths = {"classMember", "classMember.user"})
    List<ProjectMember> findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
            Long teamId,
            ClassMemberStatus status);

    @EntityGraph(attributePaths = {"classMember", "classMember.user"})
    List<ProjectMember> findAllByTeam_IdOrderByIdAsc(Long teamId);

    long countByTeam_Id(Long teamId);

    void deleteAllByTeam_Id(Long teamId);

    boolean existsByTeam_IdAndClassMember_Id(Long teamId, Long memberId);

    boolean existsByTeam_IdAndClassMember_User_IdAndClassMember_Status(
            Long teamId,
            Long userId,
            com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus status);

    java.util.Optional<ProjectMember> findByTeam_IdAndClassMember_User_Id(Long teamId, Long userId);

    void deleteByTeam_IdAndClassMember_Id(Long teamId, Long memberId);

    @Query("""
        select pm
        from ProjectMember pm
        where pm.classMember.id in :memberIds
          and pm.team.allocationSession.id = :sessionId
          and pm.team.status = :status
        """)
    List<ProjectMember> findMembersBySessionAndTeamStatus(
            @Param("memberIds") Collection<Long> memberIds,
            @Param("sessionId") Long sessionId,
            @Param("status") ProjectTeamStatus status
    );

    @Query("""
        select distinct pm.classMember.id
        from ProjectMember pm
        where pm.team.allocationSession.id = :sessionId
          and pm.team.status = :status
        """)
    List<Long> findAssignedMemberIdsBySessionAndTeamStatus(
            @Param("sessionId") Long sessionId,
            @Param("status") ProjectTeamStatus status
    );

    @Query("""
        select distinct pm.classMember.id
        from ProjectMember pm
        where pm.team.allocationSession.id = :sessionId
          and pm.team.status in :statuses
        """)
    List<Long> findAssignedMemberIdsBySessionAndTeamStatuses(
            @Param("sessionId") Long sessionId,
            @Param("statuses") Collection<ProjectTeamStatus> statuses
    );
}
