package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserDetailsServiceImpl;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.audit.AuditAction;
import com.example.starter_project_2025.system.audit.AuditLogService;
import com.example.starter_project_2025.system.audit.AuditSupport;
import com.example.starter_project_2025.system.auth.audit.AuthAuditAction;
import com.example.starter_project_2025.system.auth.audit.AuthAuditService;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ChangePasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.LoginRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.RegisterRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ResetPasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.TokenRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.authentication.dto.response.UserSessionDTO;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeToken;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenService;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshToken;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.verify.VerificationService;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
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
public class AuthServiceImpl implements AuthService {

    AuthenticationManager authenticationManager;
    UserDetailsServiceImpl userDetailsService;
    VerificationService verificationService;
    RefreshTokenService refreshTokenService;
    OneTimeTokenService oneTimeTokenService;
    AuthMapper authMapper;
    UserRepository userRepository;
    RoleRepository roleRepository;
    TenantRepository tenantRepository;
    PasswordEncoder passwordEncoder;
    AuthAuditService authAuditService;
    AuditLogService auditLogService;

    @NonFinal
    @Value("${app.auth.sso.jit-provisioning-enabled:true}")
    boolean ssoJitProvisioningEnabled;

    @Override
    public AuthenticationResponse login(LoginRequest request) {
        return login(request, null, null);
    }

    @Override
    @Transactional
    public AuthenticationResponse login(LoginRequest request, String ipAddress, String userAgent) {
        String normalizedEmail = request.email() == null ? "" : request.email().trim();
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(normalizedEmail, request.password())
            );
        } catch (AuthenticationException ex) {
            authAuditService.record(null, null, normalizedEmail, null,
                    AuthAuditAction.LOGIN_FAILED, ipAddress, userAgent, ex.getClass().getSimpleName());
            auditLogService.logLoginFailure(normalizedEmail, UUID.randomUUID().toString());
            throw ex;
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = principal.getUser();
        ensureUserAndTenantActive(user, ipAddress, userAgent, AuthAuditAction.LOGIN_FAILED);

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        boolean rememberMe = request.isRememberMeEnabled();
        RefreshTokenService.CreatedRefreshToken created = refreshTokenService.createSessionRefreshToken(
                user, rememberMe, ipAddress, userAgent
        );
        String accessToken = refreshTokenService.generateAccessToken(authentication, created.sessionId());

        authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                AuthAuditAction.LOGIN_SUCCESS, ipAddress, userAgent, "sessionId=" + created.sessionId());

        AuthenticationResponse response =
                buildAuthResponse(principal, accessToken, created.rawToken(), rememberMe);

        auditLogService.log(
                "LOGIN",
                "AUTH",
                String.valueOf(user.getId()),
                null,
                null,
                UUID.randomUUID().toString(),
                "SUCCESS"
        );

        return response;
    }

    @Override
    @Transactional
    public AuthenticationResponse loginWithGoogle(String email, String firstName, String lastName) {
        return loginWithGoogle(email, firstName, lastName, null, null);
    }

    @Override
    @Transactional
    public AuthenticationResponse loginWithGoogle(
            String email,
            String firstName,
            String lastName,
            String ipAddress,
            String userAgent
    ) {
        if (!StringUtils.hasText(email)) {
            authAuditService.record(null, null, null, null,
                    AuthAuditAction.LOGIN_GOOGLE_FAILED, ipAddress, userAgent, "Missing Google email");
            throw new BadRequestException("Google account email is required");
        }

        String normalizedEmail = email.trim();
        User user = userRepository.findByEmail(normalizedEmail).orElse(null);

        if (user == null) {
            if (!ssoJitProvisioningEnabled) {
                authAuditService.record(null, null, normalizedEmail, null,
                        AuthAuditAction.LOGIN_GOOGLE_FAILED, ipAddress, userAgent, "JIT provisioning disabled");
                throw new DisabledException("Account does not exist and automatic SSO provisioning is disabled");
            }
            user = createGoogleUser(normalizedEmail, firstName, lastName);
        } else {
            ensureUserAndTenantActive(user, ipAddress, userAgent, AuthAuditAction.LOGIN_GOOGLE_FAILED);
            user = updateUserFromGoogleProfile(user, firstName, lastName);
        }

        user.setLastLoginAt(LocalDateTime.now());
        user = userRepository.save(user);

        UserPrincipal principal = UserPrincipal.fromUser(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        );

        RefreshTokenService.CreatedRefreshToken created = refreshTokenService.createSessionRefreshToken(
                user, true, ipAddress, userAgent
        );
        String accessToken = refreshTokenService.generateAccessToken(authentication, created.sessionId());

        authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                AuthAuditAction.LOGIN_GOOGLE_SUCCESS, ipAddress, userAgent, "sessionId=" + created.sessionId());

        return buildAuthResponse(principal, accessToken, created.rawToken(), true);
    }

    @Override
    @Transactional
    public void register(RegisterRequest request) {

        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }

        User user = authMapper.toEntity(request);

        user.setPasswordHash(passwordEncoder.encode(request.password()));

        user.setIsActive(false);

        user.getRoles().add(getDefaultStudentRole());

        User savedUser = userRepository.save(user);

        auditLogService.logEventAs(
                savedUser.getId(),
                savedUser.getEmail(),
                AuditAction.REGISTER,
                "USER",
                String.valueOf(savedUser.getId()),
                null,
                AuditSupport.json("email", savedUser.getEmail())
        );

        verificationService.sendEmailVerification(user.getEmail());
    }

    @Override
    @Transactional
    public AuthenticationResponse refresh(TokenRequest request) {
        return refresh(request, null, null);
    }

    @Override
    @Transactional
    public AuthenticationResponse refresh(TokenRequest request, String ipAddress, String userAgent) {
        RefreshToken refreshToken;
        try {
            refreshToken = refreshTokenService.verifyRefreshToken(request.token());
        } catch (RuntimeException ex) {
            authAuditService.record(null, null, null, null,
                    AuthAuditAction.REFRESH_FAILED, ipAddress, userAgent, ex.getMessage());
            throw ex;
        }

        User user = refreshToken.getUser();

        if (Boolean.TRUE.equals(user.getLocked())) {
            refreshTokenService.revokeAllRefreshTokens(user.getId(), "ACCOUNT_LOCKED");
            authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                    AuthAuditAction.REFRESH_FAILED, ipAddress, userAgent, "Account is locked");
            throw new LockedException("Account is locked");
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            refreshTokenService.revokeAllRefreshTokens(user.getId(), "ACCOUNT_DISABLED");
            authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                    AuthAuditAction.REFRESH_FAILED, ipAddress, userAgent, "Account is deactivated");
            throw new DisabledException("Account is deactivated or not active");
        }

        if (!isTenantActive(user)) {
            refreshTokenService.revokeAllRefreshTokens(user.getId(), "TENANT_INACTIVE");
            authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                    AuthAuditAction.REFRESH_FAILED, ipAddress, userAgent, "Tenant is inactive");
            throw new DisabledException("Organization tenant is currently inactive");
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());

        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities()
        );

        RefreshTokenService.CreatedRefreshToken rotated = refreshTokenService.rotateSessionRefreshToken(
                refreshToken, ipAddress, userAgent
        );
        String newAccessToken = refreshTokenService.generateAccessToken(authentication, rotated.sessionId());

        if (userDetails instanceof UserPrincipal principal) {
            return buildAuthResponse(principal, newAccessToken, rotated.rawToken(), rotated.rememberMe());
        }

        Set<String> roles = resolveRoles(user);
        Set<String> permissions = resolvePermissions(user);
        Map<String, Set<String>> rolePermissions = resolveRolePermissions(user, roles);

        return AuthenticationResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(rotated.rawToken())
                .rememberMe(rotated.rememberMe())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(roles.stream().findFirst().orElse(null))
                .roles(roles)
                .permissions(permissions)
                .rolePermissions(rolePermissions)
                .build();
    }

    @Override
    public void logout(TokenRequest request) {
        logout(request == null ? null : request.token(), null, null, null, null, null);
    }

    @Override
    @Transactional
    public void logout(
            String rawRefreshToken,
            String sessionId,
            Long actorId,
            String actorEmail,
            String ipAddress,
            String userAgent
    ) {
        String correlationId = UUID.randomUUID().toString();

        try {
            if (StringUtils.hasText(rawRefreshToken)) {
                refreshTokenService.revokeRefreshToken(rawRefreshToken);
            }
            if (StringUtils.hasText(sessionId)) {
                refreshTokenService.revokeSession(sessionId, "LOGOUT");
            }
        } catch (RuntimeException ex) {
            auditLogService.logLogout(actorId, actorEmail, correlationId, "FAILURE");
            throw ex;
        }

        authAuditService.record(null, actorId, actorEmail, actorId,
                AuthAuditAction.LOGOUT, ipAddress, userAgent,
                StringUtils.hasText(sessionId) ? "sessionId=" + sessionId : "cookie-logout");
        auditLogService.logLogout(actorId, actorEmail, correlationId, "SUCCESS");
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        OneTimeToken resetToken = oneTimeTokenService.verifyOneTimeToken(
                request.token(), OneTimeToken.TokenType.RESET_PASSWORD
        );

        User user = resetToken.getUser();

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        refreshTokenService.revokeAllRefreshTokens(user.getId(), "PASSWORD_RESET");

        oneTimeTokenService.markUsed(resetToken);

        authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                AuthAuditAction.PASSWORD_RESET, null, null, "Password reset completed; all sessions revoked");

        auditLogService.logEventAs(
                user.getId(),
                user.getEmail(),
                AuditAction.RESET_PASSWORD,
                "USER",
                String.valueOf(user.getId()),
                null,
                null
        );
    }

    @Override
    @Transactional
    public void changePassword(
            Long userId,
            String currentSessionId,
            ChangePasswordRequest request,
            String ipAddress,
            String userAgent
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from the current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        int revoked = 0;
        if (request.shouldRevokeOtherSessions()) {
            revoked = refreshTokenService.revokeOtherSessions(userId, currentSessionId, "PASSWORD_CHANGED");
        }

        authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                AuthAuditAction.PASSWORD_CHANGED, ipAddress, userAgent,
                "revokedOtherSessions=" + revoked);
    }

    @Override
    public List<UserSessionDTO> listActiveSessions(Long userId, String currentSessionId) {
        return refreshTokenService.listActiveSessions(userId).stream()
                .map(token -> UserSessionDTO.builder()
                        .sessionId(token.getSessionId())
                        .ipAddress(token.getIpAddress())
                        .userAgent(token.getUserAgent())
                        .rememberMe(token.isRememberMe())
                        .current(currentSessionId != null && currentSessionId.equals(token.getSessionId()))
                        .createdAt(token.getCreatedAt())
                        .lastUsedAt(token.getLastUsedAt())
                        .expiresAt(token.getExpiryDate())
                        .build())
                .toList();
    }

    @Override
    @Transactional
    public void revokeSession(Long userId, String sessionId, String ipAddress, String userAgent) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        refreshTokenService.revokeSessionForUser(userId, sessionId, "USER_REVOKED");
        authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                AuthAuditAction.SESSION_REVOKED, ipAddress, userAgent, "sessionId=" + sessionId);
    }

    @Override
    @Transactional
    public int revokeOtherSessions(Long userId, String currentSessionId, String ipAddress, String userAgent) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        int revoked = refreshTokenService.revokeOtherSessions(userId, currentSessionId, "USER_REVOKED_OTHERS");
        authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                AuthAuditAction.OTHER_SESSIONS_REVOKED, ipAddress, userAgent, "revokedCount=" + revoked);
        return revoked;
    }

    @Override
    @Transactional
    public void adminRevokeUserSessions(
            Long adminUserId,
            String adminEmail,
            Long targetUserId,
            String ipAddress,
            String userAgent
    ) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        refreshTokenService.revokeAllRefreshTokens(targetUserId, "ADMIN_REVOKED");
        authAuditService.record(target.getTenantId(), adminUserId, adminEmail, targetUserId,
                AuthAuditAction.ADMIN_SESSIONS_REVOKED, ipAddress, userAgent,
                "targetEmail=" + target.getEmail());
    }

    private void ensureUserAndTenantActive(
            User user,
            String ipAddress,
            String userAgent,
            AuthAuditAction failAction
    ) {
        if (Boolean.TRUE.equals(user.getLocked())) {
            authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                    failAction, ipAddress, userAgent, "Account is locked");
            throw new LockedException("Account is locked");
        }
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                    failAction, ipAddress, userAgent, "Account is not active");
            throw new DisabledException("Account is deactivated or not active");
        }
        if (!isTenantActive(user)) {
            authAuditService.record(user.getTenantId(), user.getId(), user.getEmail(), user.getId(),
                    failAction, ipAddress, userAgent, "Tenant is inactive");
            throw new DisabledException("Organization tenant is currently inactive");
        }
    }

    private boolean isTenantActive(User user) {
        if (user.getTenantId() == null) {
            return true;
        }
        return tenantRepository.findById(user.getTenantId())
                .map(Tenant::getActive)
                .map(Boolean.TRUE::equals)
                .orElse(true);
    }

    private User createGoogleUser(String email, String firstName, String lastName) {
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .firstName(resolveFirstName(firstName, email))
                .lastName(resolveLastName(lastName))
                .isActive(true)
                .build();

        user.getRoles().add(getDefaultStudentRole());

        return userRepository.save(user);
    }

    private User updateUserFromGoogleProfile(User user, String firstName, String lastName) {
        boolean shouldUpdate = false;

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            user.setIsActive(true);
            shouldUpdate = true;
        }

        if (!StringUtils.hasText(user.getFirstName())) {
            user.setFirstName(resolveFirstName(firstName, user.getEmail()));
            shouldUpdate = true;
        }

        if (!StringUtils.hasText(user.getLastName()) && StringUtils.hasText(lastName)) {
            user.setLastName(resolveLastName(lastName));
            shouldUpdate = true;
        }

        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            user.getRoles().add(getDefaultStudentRole());
            shouldUpdate = true;
        }

        if (!shouldUpdate) {
            return user;
        }

        return userRepository.save(user);
    }

    private Role getDefaultStudentRole() {
        return roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new BadRequestException("Default role STUDENT not found"));
    }

    private String resolveFirstName(String firstName, String email) {
        if (StringUtils.hasText(firstName)) {
            return firstName.trim();
        }

        if (StringUtils.hasText(email) && email.contains("@")) {
            return email.substring(0, email.indexOf('@'));
        }

        return "GoogleUser";
    }

    private String resolveLastName(String lastName) {
        if (StringUtils.hasText(lastName)) {
            return lastName.trim();
        }

        return null;
    }

    private AuthenticationResponse buildAuthResponse(
            UserPrincipal principal,
            String accessToken,
            String refreshToken,
            boolean rememberMe
    ) {
        User user = principal.getUser();
        Set<String> roles = resolveRoles(user);
        Set<String> permissions = resolvePermissions(user);
        Map<String, Set<String>> rolePermissions = resolveRolePermissions(user, roles);

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .rememberMe(rememberMe)
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(roles.stream().findFirst().orElse(null))
                .roles(roles)
                .permissions(permissions)
                .rolePermissions(rolePermissions)
                .build();
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