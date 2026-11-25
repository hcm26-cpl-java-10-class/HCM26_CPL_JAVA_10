package com.example.starter_project_2025.system.auth.token.refresh;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiryDate < :now")
    int deleteAllExpired(@Param("now") Instant now);

    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.revoked = true AND rt.expiryDate < :now")
    int deleteAllRevokedExpired(@Param("now") Instant now);

    List<RefreshToken> findAllByUserId(Long userId);

    List<RefreshToken> findAllByUserIdAndRevokedFalseAndExpiryDateAfterOrderByCreatedAtDesc(
            Long userId,
            Instant now
    );

    List<RefreshToken> findAllBySessionIdAndRevokedFalse(String sessionId);

    boolean existsBySessionIdAndRevokedFalseAndExpiryDateAfter(String sessionId, Instant now);
}
