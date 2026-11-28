package com.example.starter_project_2025.system.auth.token.refresh;

import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;

public interface RefreshTokenService {

    record CreatedRefreshToken(String rawToken, String sessionId, boolean rememberMe) {}

    Jwt decodeAccessToken(String token);

    String generateAccessToken(Authentication authentication);

    String generateAccessToken(Authentication authentication, String sessionId);

    String createRefreshToken(User user);

    CreatedRefreshToken createSessionRefreshToken(User user, boolean rememberMe, String ipAddress, String userAgent);

    RefreshToken verifyRefreshToken(String rawToken);

    String rotateRefreshToken(RefreshToken oldToken);

    CreatedRefreshToken rotateSessionRefreshToken(RefreshToken oldToken, String ipAddress, String userAgent);

    boolean isSessionActive(String sessionId);

    void revokeRefreshToken(String rawToken);

    void revokeSession(String sessionId, String reason);

    void revokeSessionForUser(Long userId, String sessionId, String reason);

    int revokeOtherSessions(Long userId, String currentSessionId, String reason);

    void revokeAllRefreshTokens(Long userId);

    void revokeAllRefreshTokens(Long userId, String reason);

    List<RefreshToken> listActiveSessions(Long userId);
}
