package com.example.starter_project_2025.system.auth.token.refresh;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.exception.UnauthorizedException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.util.TokenUtil;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RefreshTokenServiceImpl implements RefreshTokenService {

    JwtEncoder jwtEncoder;
    JwtDecoder jwtDecoder;
    RefreshTokenRepository refreshTokenRepository;
    RoleRepository roleRepository;

    @NonFinal
    @Value("${jwt.access-token.duration}")
    long accessExpirationSeconds;

    @NonFinal
    @Value("${jwt.refresh-token.duration}")
    long refreshExpirationSeconds;

    @NonFinal
    @Value("${jwt.refresh-token.short-duration:86400}")
    long shortRefreshExpirationSeconds;

    @NonFinal
    @Value("${app.auth.max-active-sessions:5}")
    int maxActiveSessions;

    @Override
    public Jwt decodeAccessToken(String accessToken) {
        return jwtDecoder.decode(accessToken);
    }

    @Override
    public String generateAccessToken(Authentication authentication) {
        return generateAccessToken(authentication, null);
    }

    @Override
    public String generateAccessToken(Authentication authentication, String sessionId) {
        Instant now = Instant.now();

        JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
                .issuer("rbac-api")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(accessExpirationSeconds))
                .subject(authentication.getName())
                .claim("type", "AccessToken");

        if (StringUtils.hasText(sessionId)) {
            claimsBuilder.claim("sid", sessionId);
        }

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            User user = principal.getUser();
            Set<String> roles = resolveRoles(user);
            Set<String> permissions = resolvePermissions(user);
            Map<String, Set<String>> rolePermissions = resolveRolePermissions(user, roles);

            compactRolePermissionsForToken(roles, rolePermissions);

            claimsBuilder
                    .claim("email", user.getEmail())
                    .claim("firstName", user.getFirstName())
                    .claim("lastName", user.getLastName())
                    .claim("role", roles.stream().findFirst().orElse(null))
                    .claim("roles", roles)
                    .claim("permissions", permissions)
                    .claim("rolePermissions", rolePermissions);
        }

        JwtClaimsSet claims = claimsBuilder.build();

        return jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
    }

    static void compactRolePermissionsForToken(
            Set<String> roles,
            Map<String, Set<String>> rolePermissions
    ) {
        if (roles.contains("ADMIN")) {
            rolePermissions.remove("ADMIN");
        }
    }

    @Override
    public String createRefreshToken(User user) {
        return createSessionRefreshToken(user, true, null, null).rawToken();
    }

    @Override
    @Transactional
    public CreatedRefreshToken createSessionRefreshToken(
            User user,
            boolean rememberMe,
            String ipAddress,
            String userAgent
    ) {
        enforceMaxActiveSessions(user.getId());
        String sessionId = UUID.randomUUID().toString();
        return persistRefreshToken(user, sessionId, rememberMe, ipAddress, userAgent);
    }

    @Override
    public RefreshToken verifyRefreshToken(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            throw new UnauthorizedException("Missing refresh token");
        }
        String hash = TokenUtil.hash(rawToken);

        RefreshToken token = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (token.isRevoked()) {
            throw new UnauthorizedException("Refresh token has been revoked");
        }

        if (token.getExpiryDate().isBefore(Instant.now())) {
            token.setRevoked(true);
            token.setRevokedReason("EXPIRED");
            refreshTokenRepository.save(token);

            throw new UnauthorizedException("Refresh token has expired");
        }

        return token;
    }

    @Override
    @Transactional
    public String rotateRefreshToken(RefreshToken oldToken) {
        return rotateSessionRefreshToken(oldToken, oldToken.getIpAddress(), oldToken.getUserAgent()).rawToken();
    }

    @Override
    @Transactional
    public CreatedRefreshToken rotateSessionRefreshToken(
            RefreshToken oldToken,
            String ipAddress,
            String userAgent
    ) {
        oldToken.setRevoked(true);
        oldToken.setRevokedReason("ROTATED");
        refreshTokenRepository.save(oldToken);

        String sessionId = StringUtils.hasText(oldToken.getSessionId())
                ? oldToken.getSessionId()
                : UUID.randomUUID().toString();

        return persistRefreshToken(
                oldToken.getUser(),
                sessionId,
                oldToken.isRememberMe(),
                StringUtils.hasText(ipAddress) ? ipAddress : oldToken.getIpAddress(),
                StringUtils.hasText(userAgent) ? userAgent : oldToken.getUserAgent()
        );
    }

    @Override
    public boolean isSessionActive(String sessionId) {
        if (!StringUtils.hasText(sessionId)) {
            return true;
        }
        return refreshTokenRepository.existsBySessionIdAndRevokedFalseAndExpiryDateAfter(
                sessionId,
                Instant.now()
        );
    }

    @Override
    @Transactional
    public void revokeRefreshToken(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            return;
        }
        String hash = TokenUtil.hash(rawToken);

        refreshTokenRepository.findByTokenHash(hash)
                .ifPresent(token -> {
                    token.setRevoked(true);
                    token.setRevokedReason("LOGOUT");
                    refreshTokenRepository.save(token);
                    if (StringUtils.hasText(token.getSessionId())) {
                        revokeSession(token.getSessionId(), "LOGOUT");
                    }
                });
    }

    @Override
    @Transactional
    public void revokeSession(String sessionId, String reason) {
        if (!StringUtils.hasText(sessionId)) {
            return;
        }
        List<RefreshToken> active = refreshTokenRepository.findAllBySessionIdAndRevokedFalse(sessionId);
        if (active.isEmpty()) {
            return;
        }
        active.forEach(t -> {
            t.setRevoked(true);
            t.setRevokedReason(reason);
        });
        refreshTokenRepository.saveAll(active);
    }

    @Override
    @Transactional
    public void revokeSessionForUser(Long userId, String sessionId, String reason) {
        List<RefreshToken> active = refreshTokenRepository.findAllBySessionIdAndRevokedFalse(sessionId)
                .stream()
                .filter(t -> t.getUser() != null && userId.equals(t.getUser().getId()))
                .toList();
        if (active.isEmpty()) {
            throw new ResourceNotFoundException("Active session not found");
        }
        active.forEach(t -> {
            t.setRevoked(true);
            t.setRevokedReason(reason);
        });
        refreshTokenRepository.saveAll(active);
    }

    @Override
    @Transactional
    public int revokeOtherSessions(Long userId, String currentSessionId, String reason) {
        List<RefreshToken> active = listActiveSessions(userId);
        List<RefreshToken> toRevoke = active.stream()
                .filter(t -> currentSessionId == null || !currentSessionId.equals(t.getSessionId()))
                .toList();
        toRevoke.forEach(t -> {
            t.setRevoked(true);
            t.setRevokedReason(reason);
        });
        if (!toRevoke.isEmpty()) {
            refreshTokenRepository.saveAll(toRevoke);
        }
        return toRevoke.size();
    }

    @Override
    @Transactional
    public void revokeAllRefreshTokens(Long userId) {
        revokeAllRefreshTokens(userId, "REVOKED_ALL");
    }

    @Override
    @Transactional
    public void revokeAllRefreshTokens(Long userId, String reason) {
        List<RefreshToken> tokens = refreshTokenRepository.findAllByUserId(userId);
        tokens.stream()
                .filter(t -> !t.isRevoked())
                .forEach(t -> {
                    t.setRevoked(true);
                    t.setRevokedReason(reason);
                });
        refreshTokenRepository.saveAll(tokens);
    }

    @Override
    public List<RefreshToken> listActiveSessions(Long userId) {
        return refreshTokenRepository.findAllByUserIdAndRevokedFalseAndExpiryDateAfterOrderByCreatedAtDesc(
                userId,
                Instant.now()
        );
    }

    private void enforceMaxActiveSessions(Long userId) {
        if (maxActiveSessions <= 0) {
            return;
        }
        List<RefreshToken> active = listActiveSessions(userId);
        if (active.size() < maxActiveSessions) {
            return;
        }
        // Keep (maxActiveSessions - 1) newest sessions, revoke oldest overflow.
        List<RefreshToken> overflow = active.subList(maxActiveSessions - 1, active.size());
        overflow.forEach(t -> {
            t.setRevoked(true);
            t.setRevokedReason("MAX_SESSIONS_EXCEEDED");
        });
        refreshTokenRepository.saveAll(overflow);
    }

    private CreatedRefreshToken persistRefreshToken(
            User user,
            String sessionId,
            boolean rememberMe,
            String ipAddress,
            String userAgent
    ) {
        String rawToken = UUID.randomUUID().toString() + UUID.randomUUID();
        long ttlSeconds = rememberMe ? refreshExpirationSeconds : shortRefreshExpirationSeconds;
        Instant now = Instant.now();

        RefreshToken token = RefreshToken.builder()
                .tokenHash(TokenUtil.hash(rawToken))
                .sessionId(sessionId)
                .user(user)
                .expiryDate(now.plusSeconds(ttlSeconds))
                .revoked(false)
                .rememberMe(rememberMe)
                .ipAddress(truncate(ipAddress, 64))
                .userAgent(truncate(userAgent, 512))
                .lastUsedAt(now)
                .build();

        refreshTokenRepository.save(token);

        return new CreatedRefreshToken(rawToken, sessionId, rememberMe);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private Set<String> resolveRoles(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .map(Role::getName)
                .filter(StringUtils::hasText)
                .map(this::normalizeRoleName)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> resolvePermissions(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .filter(role -> role.getPermissions() != null)
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getName())
                .filter(StringUtils::hasText)
                .map(String::trim)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Map<String, Set<String>> resolveRolePermissions(User user, Set<String> sortedRoles) {
        Map<String, Set<String>> rolePermissions = new LinkedHashMap<>();

        if (user.getRoles() != null) {
            Map<String, Role> rolesByName = user.getRoles().stream()
                    .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                    .filter(role -> StringUtils.hasText(role.getName()))
                    .collect(Collectors.toMap(
                            role -> normalizeRoleName(role.getName()),
                            role -> role,
                            (first, second) -> first,
                            LinkedHashMap::new
                    ));

            for (String roleName : sortedRoles) {
                Role role = rolesByName.get(roleName);
                if (role != null) {
                    rolePermissions.put(roleName, mapRolePermissions(role));
                }
            }
        }

        if (sortedRoles.contains("ADMIN")) {
            includePreviewRolePermissions(rolePermissions, "STUDENT");
            includePreviewRolePermissions(rolePermissions, "TEACHER");
        }

        return rolePermissions;
    }

    private void includePreviewRolePermissions(Map<String, Set<String>> rolePermissions, String roleName) {
        if (rolePermissions.containsKey(roleName)) {
            return;
        }

        roleRepository.findByName(roleName)
                .ifPresent(role -> rolePermissions.put(roleName, mapRolePermissions(role)));
    }

    private Set<String> mapRolePermissions(Role role) {
        if (role.getPermissions() == null || role.getPermissions().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return role.getPermissions().stream()
                .map(permission -> permission.getName())
                .filter(StringUtils::hasText)
                .map(String::trim)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String normalizeRoleName(String roleName) {
        return roleName.trim().toUpperCase();
    }
}
