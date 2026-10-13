package com.example.starter_project_2025.system.auth.token.refresh;

import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

public interface RefreshTokenService {

    Jwt decodeAccessToken(String token);

    String generateAccessToken(Authentication authentication);

    String createRefreshToken(User user);

    RefreshToken verifyRefreshToken(String rawToken);

    String rotateRefreshToken(RefreshToken oldToken);

    void revokeRefreshToken(String rawToken);

    void revokeAllRefreshTokens(Long userId);
}
