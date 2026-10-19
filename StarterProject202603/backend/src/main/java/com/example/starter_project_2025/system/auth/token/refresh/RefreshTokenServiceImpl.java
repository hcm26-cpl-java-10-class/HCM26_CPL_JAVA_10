package com.example.starter_project_2025.system.auth.token.refresh;

import com.example.starter_project_2025.exception.BadRequestException;
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

    @Override
    public Jwt decodeAccessToken(String accessToken) {
        return jwtDecoder.decode(accessToken);
    }

    @Override
    public String generateAccessToken(Authentication authentication) {

        Instant now = Instant.now();

        JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
                .issuer("rbac-api")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(accessExpirationSeconds))
                .subject(authentication.getName())
            .claim("type", "AccessToken");

        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            User user = principal.getUser();
            Set<String> roles = resolveRoles(user);
            Set<String> permissions = resolvePermissions(user);
            Map<String, Set<String>> rolePermissions = resolveRolePermissions(user, roles);

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

    @Override
    public String createRefreshToken(User user) {
        String rawToken = UUID.randomUUID().toString() + UUID.randomUUID();

        RefreshToken token = RefreshToken.builder()
                .tokenHash(TokenUtil.hash(rawToken))
                .user(user)
                .expiryDate(Instant.now().plusSeconds(refreshExpirationSeconds))
                .revoked(false)
                .build();

        refreshTokenRepository.save(token);

        return rawToken;
    }

    @Override
    public RefreshToken verifyRefreshToken(String rawToken) {
        String hash = TokenUtil.hash(rawToken);

        RefreshToken token = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        if (token.isRevoked()) {
            throw new BadRequestException("Refresh token has been revoked");
        }

        if (token.getExpiryDate().isBefore(Instant.now())) {
            token.setRevoked(true);
            refreshTokenRepository.save(token);

            throw new BadRequestException("Refresh token has expired");
        }

        return token;
    }

    @Override
    @Transactional
    public String rotateRefreshToken(RefreshToken oldToken) {
        oldToken.setRevoked(true);
        refreshTokenRepository.save(oldToken);

        return createRefreshToken(
                oldToken.getUser()
        );
    }

    @Override
    public void revokeRefreshToken(String rawToken) {
        String hash = TokenUtil.hash(rawToken);

        refreshTokenRepository.findByTokenHash(hash)
                .ifPresent(token -> {
                    token.setRevoked(true);
                    refreshTokenRepository.save(token);
                });
    }

    @Override
    public void revokeAllRefreshTokens(Long userId) {
        List<RefreshToken> tokens = refreshTokenRepository.findAllByUserId(userId);

        tokens.forEach(t -> t.setRevoked(true));

        refreshTokenRepository.saveAll(tokens);
    }

    private Set<String> resolveRoles(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return new LinkedHashSet<>();
        }

        return user.getRoles().stream()
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
