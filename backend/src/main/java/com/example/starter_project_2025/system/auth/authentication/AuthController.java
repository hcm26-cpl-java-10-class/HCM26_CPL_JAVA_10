package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.audit.AuthAuditAction;
import com.example.starter_project_2025.system.auth.audit.AuthAuditLog;
import com.example.starter_project_2025.system.auth.audit.AuthAuditService;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ChangePasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ForgotPasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.LoginRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.RegisterRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.ResetPasswordRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.request.TokenRequest;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.authentication.dto.response.UserSessionDTO;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.util.CookieUtil;
import com.example.starter_project_2025.system.auth.verify.VerificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Authentication", description = "APIs for user authentication, session management and registration")
public class AuthController {

    AuthService authService;
    RefreshTokenService refreshTokenService;
    AuthAuditService authAuditService;
    CookieUtil cookieUtil;
    VerificationService verificationService;

    @PostMapping("/login")
    public ResponseEntity<AuthenticationResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse response
    ) {
        AuthenticationResponse authenticationResponse = authService.login(
                request,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );

        cookieUtil.setRefreshTokenCookie(
                response,
                authenticationResponse.getRefreshToken(),
                authenticationResponse.isRememberMe()
        );
        authenticationResponse.setRefreshToken(null);

        return ResponseEntity.ok(authenticationResponse);
    }

    @PostMapping("/register")
    public ResponseEntity<Void> registerUser(
            @Valid @RequestBody RegisterRequest request
    ) {
        authService.register(request);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthenticationResponse> refreshToken(
            @CookieValue(value = "refreshToken", required = false) String refreshToken,
            HttpServletRequest httpRequest,
            HttpServletResponse response
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        AuthenticationResponse authenticationResponse = authService.refresh(
                new TokenRequest(refreshToken),
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );

        cookieUtil.setRefreshTokenCookie(
                response,
                authenticationResponse.getRefreshToken(),
                authenticationResponse.isRememberMe()
        );
        authenticationResponse.setRefreshToken(null);

        return ResponseEntity.ok(authenticationResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String refreshToken = cookieUtil.getRefreshTokenFromCookie(request).orElse(null);
        String sessionId = extractSessionId(request);
        Long actorId = principal != null ? principal.getUser().getId() : null;
        String actorEmail = principal != null ? principal.getUser().getEmail() : null;

        authService.logout(
                refreshToken,
                sessionId,
                actorId,
                actorEmail,
                resolveClientIp(request),
                request.getHeader("User-Agent")
        );
        cookieUtil.clearRefreshTokenCookie(response);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.changePassword(
                principal.getUser().getId(),
                extractSessionId(httpRequest),
                request,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<UserSessionDTO>> listSessions(
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(
                authService.listActiveSessions(principal.getUser().getId(), extractSessionId(httpRequest))
        );
    }

    @DeleteMapping("/sessions/{sessionId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> revokeSession(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String sessionId,
            HttpServletRequest httpRequest
    ) {
        authService.revokeSession(
                principal.getUser().getId(),
                sessionId,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sessions/revoke-others")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Integer>> revokeOtherSessions(
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        int revokedCount = authService.revokeOtherSessions(
                principal.getUser().getId(),
                extractSessionId(httpRequest),
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ResponseEntity.ok(Map.of("revokedCount", revokedCount));
    }

    @GetMapping("/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<AuthAuditLog>> listAuditLogs(
            @RequestParam(required = false) AuthAuditAction action,
            @RequestParam(required = false) String email,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(authAuditService.search(action, email, pageable));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        verificationService.sendForgotPassword(request.email());

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(
            @RequestParam("email") String email
    ) {
        verificationService.resendVerification(email);

        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(
            @RequestBody ResetPasswordRequest request
    ) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

    private String extractSessionId(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (!StringUtils.hasText(bearer) || !bearer.startsWith("Bearer ")) {
            return null;
        }
        try {
            Jwt jwt = refreshTokenService.decodeAccessToken(bearer.substring(7));
            return jwt.getClaimAsString("sid");
        } catch (JwtException ex) {
            return null;
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(xff)) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
