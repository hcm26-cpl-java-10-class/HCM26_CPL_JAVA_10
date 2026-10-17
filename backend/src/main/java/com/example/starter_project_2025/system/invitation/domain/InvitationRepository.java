package com.example.starter_project_2025.system.invitation.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvitationRepository extends BaseCrudRepository<Invitation, Long> {

    Optional<Invitation> findByExamIdAndUserId(Long examId, Long userId);

    boolean existsByExamIdAndUserId(Long examId, Long userId);

    List<Invitation> findByExamId(Long examId);

    List<Invitation> findByUserId(Long userId);

    List<Invitation> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invitation i where i.id = :invitationId")
    Optional<Invitation> lockById(@Param("invitationId") Long invitationId);

    List<Invitation> findByExamIdAndStatus(Long examId, InvitationStatus status);
}
