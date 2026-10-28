package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.system.auth.util.MailUtil;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Emails about accounts. Creating an account sends no email (so large imports never depend on the mail
 * provider); the only mail left is the notice to the owner when an administrator changes their password.
 * The password itself is never put in an email.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AccountMailService {

    private static final String PASSWORD_CHANGED_EMAIL = "email/password_changed_email";

    MailUtil mailUtil;

    @NonFinal
    @Value("${app.frontend-domain}")
    String frontendUrl;

    @NonFinal
    @Value("${spring.mail.username}")
    String hostEmail;

    /** Notify an existing account owner that an administrator changed their password. */
    public void sendPasswordChangedNotification(User user) {
        mailUtil.buildAndSendMail(
                "Your account password has been changed",
                hostEmail,
                user.getEmail(),
                PASSWORD_CHANGED_EMAIL,
                List.of(
                        Map.entry("name", user.getFullName()),
                        Map.entry("email", user.getEmail()),
                        Map.entry("loginLink", frontendUrl + "/login"),
                        Map.entry("forgotPasswordLink", frontendUrl + "/forgot-password")
                )
        );
        log.info("Password-change notification sent to {}", user.getEmail());
    }
}
