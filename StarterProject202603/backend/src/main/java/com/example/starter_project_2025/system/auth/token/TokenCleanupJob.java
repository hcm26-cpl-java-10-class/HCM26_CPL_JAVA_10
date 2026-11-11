package com.example.starter_project_2025.system.auth.token;

import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TokenCleanupJob {

    RefreshTokenRepository refreshTokenRepository;
    OneTimeTokenRepository oneTimeTokenRepository;

    @Transactional
    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanTokens() {

        Instant now = Instant.now();

        int expiredRefresh = refreshTokenRepository.deleteAllExpired(now);
        int revokedRefresh = refreshTokenRepository.deleteAllRevokedExpired(now);
        int oneTime = oneTimeTokenRepository.deleteAllExpiredOrUsed(now);

        log.info("[CRON] Deleted {} expired refresh, {} revoked refresh, {} one-time tokens",
                expiredRefresh, revokedRefresh, oneTime);
    }
}
