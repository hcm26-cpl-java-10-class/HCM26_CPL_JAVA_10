
package com.example.starter_project_2025.system.auth.token.refresh;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository
        extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllByUserId(Long userId);

    boolean existsByUser_IdAndRevokedFalseAndExpiryDateAfter(
            Long userId,
            Instant now
    );

    @Modifying
    @Transactional
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiryDate < :now")
    int deleteAllExpired(@Param("now") Instant now);

    @Modifying
    @Transactional
    @Query("""
            DELETE FROM RefreshToken rt
            WHERE rt.revoked = true AND rt.expiryDate < :now
            """)
    int deleteAllRevokedExpired(@Param("now") Instant now);

    @Modifying
    @Transactional
    @Query("""
            DELETE FROM RefreshToken rt
            WHERE rt.user.id = :userId
            """)
    int deleteAllByUserId(@Param("userId") Long userId);
}
