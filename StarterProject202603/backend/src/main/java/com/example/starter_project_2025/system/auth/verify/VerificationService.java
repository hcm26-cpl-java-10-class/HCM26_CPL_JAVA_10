package com.example.starter_project_2025.system.auth.verify;

public interface VerificationService {

    void sendEmailVerification(String email);

    boolean verifyEmail(String token);

    void sendForgotPassword(String email);

    void resendVerification(String email);

}
