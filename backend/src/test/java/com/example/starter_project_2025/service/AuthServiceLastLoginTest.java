package com.example.starter_project_2025.service;

import com.example.starter_project_2025.security.UserDetailsServiceImpl;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.authentication.AuthMapper;
import com.example.starter_project_2025.system.auth.authentication.AuthServiceImpl;
import com.example.starter_project_2025.system.auth.authentication.SsoAccessPolicy;
import com.example.starter_project_2025.system.auth.authentication.dto.request.LoginRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenService;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.verify.VerificationService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthServiceLastLoginTest {

    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private VerificationService verificationService;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private OneTimeTokenService oneTimeTokenService;
    @Mock
    private AuthMapper authMapper;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private SsoAccessPolicy ssoAccessPolicy;

    private AuthServiceImpl authService;

    private User sampleUser;
    private UserPrincipal principal;
    private Authentication successfulAuth;

    @BeforeEach
    void setUp() {
        UserDetailsServiceImpl userDetailsService = new UserDetailsServiceImpl(userRepository);
        authService = new AuthServiceImpl(
                authenticationManager,
                userDetailsService,
                verificationService,
                refreshTokenService,
                oneTimeTokenService,
                authMapper,
                userRepository,
                roleRepository,
                passwordEncoder,
                ssoAccessPolicy
        );

        Role adminRole = Role.builder()
                .name("ADMIN")
                .permissions(new HashSet<>())
                .build();

        sampleUser = User.builder()
                .id(1L)
                .email("user@example.com")
                .passwordHash("hashedPass")
                .firstName("Test")
                .lastName("User")
                .isActive(true)
                .roles(new HashSet<>(Set.of(adminRole)))
                .lastLoginAt(null)
                .lastLoginDevice(null)
                .build();

        principal = UserPrincipal.fromUser(sampleUser);
        successfulAuth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }

    @Test
    @DisplayName("login - Successful authentication should update and persist lastLoginAt and lastLoginDevice")
    void login_Success_ShouldUpdateLastLoginAt() {
        LoginRequest request = new LoginRequest("user@example.com", "Password123!");

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(successfulAuth);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(refreshTokenService.generateAccessToken(any())).thenReturn("mock-access-token");
        when(refreshTokenService.createRefreshToken(any())).thenReturn("mock-refresh-token");

        assertNull(sampleUser.getLastLoginAt());
        assertNull(sampleUser.getLastLoginDevice());

        AuthenticationResponse response = authService.login(request, "Chrome · Windows 11");

        assertNotNull(response);
        assertNotNull(sampleUser.getLastLoginAt());
        assertEquals("Chrome · Windows 11", sampleUser.getLastLoginDevice());
        assertTrue(sampleUser.getLastLoginAt().isBefore(Instant.now().plusSeconds(1)));
        verify(userRepository).save(sampleUser);
        verify(refreshTokenService).revokeAllRefreshTokens(sampleUser.getId());
    }

    @Test
    @DisplayName("login - Failed authentication should NOT update lastLoginAt or device or save user")
    void login_Failure_ShouldNotUpdateLastLoginAt() {
        LoginRequest request = new LoginRequest("user@example.com", "WrongPassword");

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThrows(BadCredentialsException.class, () -> authService.login(request, "Chrome · Windows 11"));

        assertNull(sampleUser.getLastLoginAt());
        assertNull(sampleUser.getLastLoginDevice());
        verify(userRepository, never()).save(any());
        verify(refreshTokenService, never()).revokeAllRefreshTokens(any());
    }

    @Test
    @DisplayName("loginWithGoogle - Successful Google login should update and persist lastLoginAt and device")
    void loginWithGoogle_Success_ShouldUpdateLastLoginAt() {
        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(refreshTokenService.generateAccessToken(any())).thenReturn("mock-access-token");
        when(refreshTokenService.createRefreshToken(any())).thenReturn("mock-refresh-token");

        assertNull(sampleUser.getLastLoginAt());
        assertNull(sampleUser.getLastLoginDevice());

        AuthenticationResponse response = authService.loginWithGoogle("user@example.com", "Test", "User", "Safari · macOS");

        assertNotNull(response);
        assertNotNull(sampleUser.getLastLoginAt());
        assertEquals("Safari · macOS", sampleUser.getLastLoginDevice());
        verify(userRepository).save(sampleUser);
        verify(refreshTokenService).revokeAllRefreshTokens(sampleUser.getId());
    }
}
