package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectTeamRepository
        extends BaseCrudRepository<ProjectTeam, Long> {

    Optional<ProjectTeam> findByIdAndAllocationSession_Id(
            Long teamId,
            Long sessionId
    );

    List<ProjectTeam> findAllByAllocationSession_IdOrderByIdAsc(Long sessionId);

    List<ProjectTeam> findAllByAllocationSession_IdAndStatusOrderByIdAsc(
            Long sessionId,
            ProjectTeamStatus status
    );

    List<ProjectTeam> findAllByAllocationSession_IdAndStatus(
            Long sessionId,
            ProjectTeamStatus status
    );

    boolean existsByAllocationSession_IdAndStatus(
            Long sessionId,
            ProjectTeamStatus status
    );
}