package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.system.auth.authentication.dto.request.*;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;
import com.example.starter_project_2025.system.auth.authentication.dto.response.UserSessionDTO;

import java.util.List;

public interface AuthService {

    AuthenticationResponse login(LoginRequest request);

    AuthenticationResponse login(LoginRequest request, String ipAddress, String userAgent);

    AuthenticationResponse loginWithGoogle(String email, String firstName, String lastName);

    AuthenticationResponse loginWithGoogle(String email, String firstName, String lastName, String ipAddress, String userAgent);

    void register(RegisterRequest request);

    AuthenticationResponse refresh(TokenRequest request);

    AuthenticationResponse refresh(TokenRequest request, String ipAddress, String userAgent);

    void logout(TokenRequest request);

    void logout(String rawRefreshToken, String sessionId, Long actorId, String actorEmail, String ipAddress, String userAgent);

    void resetPassword(ResetPasswordRequest request);

    void changePassword(Long userId, String currentSessionId, ChangePasswordRequest request, String ipAddress, String userAgent);

    List<UserSessionDTO> listActiveSessions(Long userId, String currentSessionId);

    void revokeSession(Long userId, String sessionId, String ipAddress, String userAgent);

    int revokeOtherSessions(Long userId, String currentSessionId, String ipAddress, String userAgent);

    void adminRevokeUserSessions(Long adminUserId, String adminEmail, Long targetUserId, String ipAddress, String userAgent);
}
