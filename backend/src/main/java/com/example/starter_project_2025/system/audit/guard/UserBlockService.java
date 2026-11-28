package com.example.starter_project_2025.system.audit.guard;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.audit.AuditLogService;
import com.example.starter_project_2025.system.audit.AuditSupport;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Temporary, day-based blocking of accounts. A block of N days ends at 00:00 of the Nth day after
 * today, so "1 day" means the account is usable again from tomorrow. Expiry is enforced on every
 * request (see {@link User#hasActiveLock()}); the scheduled job only tidies the columns and leaves
 * an audit trail.
 */
@Service
@RequiredArgsConstructor
public class UserBlockService {

    private static final String ENTITY = "USER";

    private final UserRepository userRepository;
    private final SecurityAlertRepository alertRepository;
    private final RefreshTokenService refreshTokenService;
    private final AuditLogService auditLogService;

    @Transactional
    public BlockedUserDTO block(Long userId, int days, String reason, Long adminId, String adminEmail) {
        User user = loadBlockable(userId, adminId);
        LocalDateTime previous = user.isTemporarilyBlocked() ? user.getBlockedUntil() : null;

        user.setBlockedUntil(endOfBlock(LocalDate.now(), days));
        user.setBlockReason(clean(reason));
        userRepository.save(user);

        refreshTokenService.revokeAllRefreshTokens(userId, "USER_BLOCKED");
        alertRepository.resolveOpenForUser(
                userId, SecurityAlert.STATUS_BLOCKED, LocalDateTime.now(), adminEmail);

        auditLogService.logAs(adminId, adminEmail, "BLOCK", ENTITY, String.valueOf(userId),
                previous == null ? null : AuditSupport.json("blockedUntil", previous.toString()),
                AuditSupport.json("blockedUntil", user.getBlockedUntil().toString(),
                        "days", days, "reason", user.getBlockReason()),
                null, "SUCCESS");

        return toDto(user);
    }

    /** Adds days on top of the current end date (or from today when the block already ended). */
    @Transactional
    public BlockedUserDTO extend(Long userId, int days, String reason, Long adminId, String adminEmail) {
        User user = loadBlockable(userId, adminId);

        if (!user.isTemporarilyBlocked()) {
            throw new BadRequestException("User is not currently blocked");
        }

        LocalDateTime previous = user.getBlockedUntil();
        user.setBlockedUntil(endOfBlock(previous.toLocalDate(), days));

        if (clean(reason) != null) {
            user.setBlockReason(clean(reason));
        }

        userRepository.save(user);

        auditLogService.logAs(adminId, adminEmail, "EXTEND_BLOCK", ENTITY, String.valueOf(userId),
                AuditSupport.json("blockedUntil", previous.toString()),
                AuditSupport.json("blockedUntil", user.getBlockedUntil().toString(), "addedDays", days),
                null, "SUCCESS");

        return toDto(user);
    }

    @Transactional
    public void unblock(Long userId, Long adminId, String adminEmail) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getBlockedUntil() == null) {
            return;
        }

        LocalDateTime previous = user.getBlockedUntil();
        user.setBlockedUntil(null);
        user.setBlockReason(null);
        userRepository.save(user);

        auditLogService.logAs(adminId, adminEmail, "UNBLOCK", ENTITY, String.valueOf(userId),
                AuditSupport.json("blockedUntil", previous.toString()), null,
                null, "SUCCESS");
    }

    @Transactional(readOnly = true)
    public List<BlockedUserDTO> listBlocked() {
        return userRepository.findByBlockedUntilAfterOrderByBlockedUntilAsc(LocalDateTime.now())
                .stream()
                .map(UserBlockService::toDto)
                .toList();
    }

    /** Clears blocks whose end date has passed. */
    @Scheduled(fixedDelayString = "${app.security.block.expiry-check-ms:60000}")
    @Transactional
    public void releaseExpiredBlocks() {
        for (User user : userRepository.findByBlockedUntilNotNullAndBlockedUntilBefore(LocalDateTime.now())) {
            LocalDateTime previous = user.getBlockedUntil();
            user.setBlockedUntil(null);
            user.setBlockReason(null);
            userRepository.save(user);

            auditLogService.logAs(null, "SYSTEM", "AUTO_UNBLOCK", ENTITY, String.valueOf(user.getId()),
                    AuditSupport.json("blockedUntil", previous.toString()), null,
                    null, "SUCCESS");
        }
    }

    private User loadBlockable(Long userId, Long adminId) {
        if (userId.equals(adminId)) {
            throw new BadRequestException("You cannot block your own account");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean isAdmin = user.getRoles().stream()
                .anyMatch(role -> "ADMIN".equals(role.getName()));

        if (isAdmin) {
            throw new BadRequestException("Administrator accounts cannot be blocked");
        }

        return user;
    }

    private static LocalDateTime endOfBlock(LocalDate from, int days) {
        return from.plusDays(days).atStartOfDay();
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static BlockedUserDTO toDto(User user) {
        return new BlockedUserDTO(
                user.getId(), user.getEmail(), user.getFullName(),
                user.getBlockReason(), user.getBlockedUntil());
    }
}
