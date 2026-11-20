
package com.example.starter_project_2025.system.auth.token.onetime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface OneTimeTokenRepository
        extends JpaRepository<OneTimeToken, Long> {

    Optional<OneTimeToken> findByTokenHashAndType(
            String tokenHash,
            OneTimeToken.TokenType type
    );

    @Modifying
    @Transactional
    @Query("""
            DELETE FROM OneTimeToken t
            WHERE t.expiryDate < :now OR t.used = true
            """)
    int deleteAllExpiredOrUsed(@Param("now") Instant now);

    @Modifying
    @Transactional
    @Query("""
            DELETE FROM OneTimeToken t
            WHERE t.user.id = :userId
            """)
    int deleteAllByUserId(@Param("userId") Long userId);
}
