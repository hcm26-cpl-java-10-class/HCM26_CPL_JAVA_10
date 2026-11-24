package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.exception.UnauthorizedException;
import com.example.starter_project_2025.system.auth.audit.AuthAuditService;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ChangePasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.TokenRequest;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenService;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshToken;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenServiceImpl;
import com.example.starter_project_2025.system.auth.verify.VerificationService;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.security.UserDetailsServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthFlowSecurityTest {

    @Mock AuthenticationManager authenticationManager;
    @Mock UserDetailsServiceImpl userDetailsService;
    @Mock VerificationService verificationService;
    @Mock RefreshTokenService refreshTokenService;
    @Mock OneTimeTokenService oneTimeTokenService;
    @Mock AuthMapper authMapper;
    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock TenantRepository tenantRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuthAuditService authAuditService;

    @Mock JwtEncoder jwtEncoder;
    @Mock JwtDecoder jwtDecoder;
    @Mock RefreshTokenRepository refreshTokenRepository;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(
                authenticationManager,
                userDetailsService,
                verificationService,
                refreshTokenService,
                oneTimeTokenService,
                authMapper,
                userRepository,
                roleRepository,
                tenantRepository,
                passwordEncoder,
                authAuditService
        );
        ReflectionTestUtils.setField(authService, "ssoJitProvisioningEnabled", true);
    }

    @Test
    void loginWithGoogle_rejectsDeactivatedAccountWithoutReactivating() {
        User disabled = User.builder()
                .email("disabled@example.com")
                .isActive(false)
                .locked(false)
                .build();
        disabled.setId(10L);
        when(userRepository.findByEmail("disabled@example.com")).thenReturn(Optional.of(disabled));

        assertThrows(DisabledException.class,
                () -> authService.loginWithGoogle("disabled@example.com", "Disabled", "User", "127.0.0.1", "JUnit"));

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void loginWithGoogle_rejectsUnknownUserWhenJitProvisioningDisabled() {
        ReflectionTestUtils.setField(authService, "ssoJitProvisioningEnabled", false);
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());

        assertThrows(DisabledException.class,
                () -> authService.loginWithGoogle("new@example.com", "New", "User", "127.0.0.1", "JUnit"));

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void refresh_rejectsDeactivatedUserAndRevokesAllTokens() {
        User disabled = User.builder()
                .email("inactive@example.com")
                .isActive(false)
                .locked(false)
                .build();
        disabled.setId(22L);

        RefreshToken token = RefreshToken.builder()
                .user(disabled)
                .sessionId("sess-1")
                .expiryDate(Instant.now().plusSeconds(3600))
                .revoked(false)
                .build();
        when(refreshTokenService.verifyRefreshToken("raw-token")).thenReturn(token);

        assertThrows(DisabledException.class,
                () -> authService.refresh(new TokenRequest("raw-token"), "127.0.0.1", "JUnit"));

        verify(refreshTokenService).revokeAllRefreshTokens(22L, "ACCOUNT_DISABLED");
    }

    @Test
    void refresh_rejectsUserInInactiveTenant() {
        User user = User.builder()
                .email("tenant-user@example.com")
                .isActive(true)
                .locked(false)
                .tenantId(99L)
                .build();
        user.setId(25L);
        Tenant inactiveTenant = Tenant.builder().code("T99").name("Inactive Tenant").active(false).build();
        inactiveTenant.setId(99L);

        RefreshToken token = RefreshToken.builder()
                .user(user)
                .sessionId("sess-2")
                .expiryDate(Instant.now().plusSeconds(3600))
                .revoked(false)
                .build();
        when(refreshTokenService.verifyRefreshToken("raw-token")).thenReturn(token);
        when(tenantRepository.findById(99L)).thenReturn(Optional.of(inactiveTenant));

        assertThrows(DisabledException.class,
                () -> authService.refresh(new TokenRequest("raw-token"), "127.0.0.1", "JUnit"));

        verify(refreshTokenService).revokeAllRefreshTokens(25L, "TENANT_INACTIVE");
    }

    @Test
    void changePassword_updatesHashAndRevokesOtherSessions() {
        User user = User.builder()
                .email("user@example.com")
                .passwordHash("encoded-old")
                .isActive(true)
                .locked(false)
                .build();
        user.setId(5L);

        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("OldPass@123", "encoded-old")).thenReturn(true);
        when(passwordEncoder.matches("NewPass@456", "encoded-old")).thenReturn(false);
        when(passwordEncoder.encode("NewPass@456")).thenReturn("encoded-new");
        when(refreshTokenService.revokeOtherSessions(5L, "cur-sid", "PASSWORD_CHANGED")).thenReturn(2);

        authService.changePassword(
                5L,
                "cur-sid",
                new ChangePasswordRequest("OldPass@123", "NewPass@456", true),
                "127.0.0.1",
                "JUnit"
        );

        verify(userRepository).save(user);
        verify(refreshTokenService).revokeOtherSessions(5L, "cur-sid", "PASSWORD_CHANGED");
    }

    @Test
    void verifyRefreshToken_throwsUnauthorizedWhenRevoked() {
        RefreshTokenServiceImpl realRefresh = new RefreshTokenServiceImpl(
                jwtEncoder, jwtDecoder, refreshTokenRepository, roleRepository
        );
        RefreshToken revoked = RefreshToken.builder()
                .revoked(true)
                .expiryDate(Instant.now().plusSeconds(3600))
                .build();
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(revoked));

        assertThrows(UnauthorizedException.class, () -> realRefresh.verifyRefreshToken("some-token"));
    }

    @Test
    void logout_revokesBothCookieAndSessionId() {
        authService.logout("cookie-raw", "sid-123", 1L, "u@example.com", "127.0.0.1", "JUnit");

        verify(refreshTokenService).revokeRefreshToken("cookie-raw");
        verify(refreshTokenService).revokeSession(eq("sid-123"), eq("LOGOUT"));
    }
}
