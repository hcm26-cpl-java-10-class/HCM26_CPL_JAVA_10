package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.project.TeamAllocationSession;
import com.example.starter_project_2025.system.project.TeamAllocationSessionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamAllocationSessionRepository
        extends BaseCrudRepository<TeamAllocationSession, Long> {

    boolean existsByProjectTemplate_Id(Long templateId);

    Optional<TeamAllocationSession> findByIdAndTrainingClass_Id(
            Long sessionId,
            Long classId
    );

    List<TeamAllocationSession> findAllByTrainingClass_IdOrderByCreatedAtDescIdDesc(
            Long classId
    );

    long countByTrainingClass_Id(Long classId);

    Optional<TeamAllocationSession> findFirstByTrainingClass_IdOrderByIdAsc(Long classId);

    boolean existsByTrainingClass_IdAndStatus(
            Long classId,
            TeamAllocationSessionStatus status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from TeamAllocationSession s where s.id = :sessionId")
    Optional<TeamAllocationSession> findByIdForUpdate(
            @Param("sessionId") Long sessionId
    );
}
