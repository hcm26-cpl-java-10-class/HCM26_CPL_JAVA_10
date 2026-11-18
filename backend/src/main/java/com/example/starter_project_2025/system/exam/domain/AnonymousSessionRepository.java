package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AnonymousSessionRepository extends BaseCrudRepository<AnonymousSession, Long> {

    Optional<AnonymousSession> findBySessionToken(String sessionToken);

    @Query("SELECT s FROM AnonymousSession s WHERE s.accessedAt < :before AND s.isValid = true")
    List<AnonymousSession> findStaleSessions(@Param("before") LocalDateTime before);

    Optional<AnonymousSession> findByInvitationIdAndFingerprint(Long invitationId, String fingerprint);

    @Query("SELECT s FROM AnonymousSession s WHERE s.invitation.id = :invitationId AND s.guestUserId = :guestUserId ORDER BY s.accessedAt DESC")
    List<AnonymousSession> findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(
            @Param("invitationId") Long invitationId,
            @Param("guestUserId") Long guestUserId
    );
}
