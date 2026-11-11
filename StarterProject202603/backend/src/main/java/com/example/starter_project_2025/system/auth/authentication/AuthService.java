package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.system.auth.authentication.dto.request.*;
import com.example.starter_project_2025.system.auth.authentication.dto.response.AuthenticationResponse;

public interface AuthService {

    AuthenticationResponse login(LoginRequest request);

    AuthenticationResponse loginWithGoogle(String email, String firstName, String lastName);

    void register(RegisterRequest request);

    AuthenticationResponse refresh(TokenRequest request);

    void logout(TokenRequest request);

    void resetPassword(ResetPasswordRequest request);

}
