package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.system.auth.token.onetime.OneTimeToken;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenService;
import com.example.starter_project_2025.system.auth.util.MailUtil;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/** Emails sent to people whose account was created by an administrator (for example by Excel import). */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AccountMailService {

    private static final String ACCOUNT_CREATED_EMAIL = "email/account_created_email";
    private static final String SET_PASSWORD_EMAIL = "email/set_password_email";

    MailUtil mailUtil;
    OneTimeTokenService oneTimeTokenService;

    @NonFinal
    @Value("${app.frontend-domain}")
    String frontendUrl;

    @NonFinal
    @Value("${spring.mail.username}")
    String hostEmail;

    /** How long the "set your password" link stays valid. */
    @NonFinal
    @Value("${app.set-password.expiry-days:7}")
    long setPasswordExpiryDays;

    /** Notify the user that an administrator created the account. Never email credentials. */
    public void sendAccountCreatedNotification(User user) {
        mailUtil.buildAndSendMail(
                "Your account has been created",
                hostEmail,
                user.getEmail(),
                ACCOUNT_CREATED_EMAIL,
                List.of(
                        Map.entry("name", user.getFullName()),
                        Map.entry("email", user.getEmail()),
                        Map.entry("loginLink", frontendUrl + "/login")
                )
        );
        log.info("Account creation notification sent to {}", user.getEmail());
    }

    /** Notify an existing account owner that an administrator changed their password. */
    public void sendPasswordChangedNotification(User user) {
        mailUtil.buildAndSendMail(
                "Your account password has been changed",
                hostEmail,
                user.getEmail(),
                ACCOUNT_CREATED_EMAIL,
                List.of(
                        Map.entry("name", user.getFullName()),
                        Map.entry("email", user.getEmail()),
                        Map.entry("loginLink", frontendUrl + "/login")
                )
        );
        log.info("Password-change notification sent to {}", user.getEmail());
    }

    /** No password was given: email a link so the new user can create their own password. */
    public void sendSetPasswordInvitation(User user) {
        String token = oneTimeTokenService.createOneTimeToken(
                user,
                OneTimeToken.TokenType.RESET_PASSWORD,
                Duration.ofDays(setPasswordExpiryDays)
        );

        mailUtil.buildAndSendMail(
                "Create your password",
                hostEmail,
                user.getEmail(),
                SET_PASSWORD_EMAIL,
                List.of(
                        Map.entry("name", user.getFullName()),
                        Map.entry("setPasswordLink", frontendUrl + "/forgot-password?token=" + token),
                        Map.entry("expiryDays", setPasswordExpiryDays)
                )
        );
        log.info("Set-password email sent to {}", user.getEmail());
    }
}
