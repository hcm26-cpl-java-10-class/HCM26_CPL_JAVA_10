package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends BaseCrudRepository<Invitation, Long> {

    List<Invitation> findByExamId(Long examId);

    List<Invitation> findByExamIdAndStatus(Long examId, InvitationStatus status);

    List<Invitation> findByUserId(Long userId);

    Optional<Invitation> findByToken(String token);

    Optional<Invitation> findByAccessCode(String accessCode);

    Optional<Invitation> findByExamIdAndUserId(Long examId, Long userId);

    @Query("SELECT i FROM Invitation i WHERE i.exam.id = :examId AND i.status = 'PENDING' AND i.expiresAt < :now")
    List<Invitation> findExpiredPendingInvitations(@Param("examId") Long examId, @Param("now") LocalDateTime now);

    @Query("SELECT i FROM Invitation i WHERE i.status = 'PENDING' AND i.expiresAt < :now")
    List<Invitation> findAllExpiredPendingInvitations(@Param("now") LocalDateTime now);

    @Query("SELECT i FROM Invitation i WHERE i.exam.id = :examId AND i.anonymous = true")
    List<Invitation> findAnonymousByExamId(@Param("examId") Long examId);

    @Query("SELECT i FROM Invitation i JOIN FETCH i.exam e JOIN FETCH i.user WHERE i.user.id = :userId")
    List<Invitation> findByUserIdWithExamAndUser(@Param("userId") Long userId);

    boolean existsByExamIdAndUserId(Long examId, Long userId);
}
