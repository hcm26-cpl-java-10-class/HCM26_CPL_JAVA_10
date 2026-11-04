package com.example.starter_project_2025.system.auth.token.onetime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface OneTimeTokenRepository extends JpaRepository<OneTimeToken, Long> {

    Optional<OneTimeToken> findByTokenHashAndType(String tokenHash, OneTimeToken.TokenType type);

    @Modifying
    @Query("DELETE FROM OneTimeToken t WHERE t.expiryDate < :now OR t.used = true")
    int deleteAllExpiredOrUsed(@Param("now") Instant now);

    /** Xóa toàn bộ token một lần của một user (cần trước khi xóa user vì có khóa ngoại). */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM OneTimeToken t WHERE t.user.id = ?1")
    int deleteAllByUserId(Long userId);
}
