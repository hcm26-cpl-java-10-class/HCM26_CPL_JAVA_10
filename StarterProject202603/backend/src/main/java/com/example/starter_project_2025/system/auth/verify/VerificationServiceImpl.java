package com.example.starter_project_2025.system.auth.verify;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeToken;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenService;
import com.example.starter_project_2025.system.auth.util.MailUtil;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class VerificationServiceImpl implements VerificationService {

    OneTimeTokenService oneTimeTokenService;
    UserRepository userRepository;
    MailUtil mailUtil;

    private static final String VERIFICATION_EMAIL = "email/verification_email";
    private static final String RESET_PASSWORD_EMAIL = "email/reset_password_email";

    @NonFinal
    @Value("${app.backend-domain}")
    String backendUrl;

    @NonFinal
    @Value("${app.frontend-domain}")
    String frontendUrl;

    @NonFinal
    @Value("${spring.mail.username}")
    String hostEmail;

    @Override
    public void sendEmailVerification(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User with email " + email + " not found"));

        String token = oneTimeTokenService.createOneTimeToken(user, OneTimeToken.TokenType.EMAIL_VERIFY);

        String verificationLink = String.format("%s/verify?token=%s", backendUrl, token);

        sendVerificationEmail(user.getEmail(), user.getFullName(), verificationLink);
    }

    @Override
    public void resendVerification(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User with email " + email + " not found"));

        if (user.getIsActive()) {
            throw new BadRequestException("User with email " + email + " is already active");
        }

        sendEmailVerification(user.getEmail());
    }

    @Override
    @Transactional
    public boolean verifyEmail(String rawToken) {

        OneTimeToken token = oneTimeTokenService.verifyOneTimeToken(rawToken, OneTimeToken.TokenType.EMAIL_VERIFY);
        oneTimeTokenService.markUsed(token);

        User user = token.getUser();
        if (user.getIsActive()) {
            return false;
        }

        user.setIsActive(true);
        userRepository.save(user);
        return true;
    }

    @Override
    public void sendForgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User with email " + email + " not found"));

        if (!user.getIsActive()) {
            throw new BadRequestException("User with email " + email + " is not active");
        }

        String token = oneTimeTokenService.createOneTimeToken(user, OneTimeToken.TokenType.RESET_PASSWORD);

        String verificationLink = String.format("%s/forgot-password?token=%s", frontendUrl, token);

        sendResetPasswordMail(user.getEmail(), user.getFullName(), verificationLink);
    }

    public void sendVerificationEmail(String to, String username, String verificationLink) {
        mailUtil.buildAndSendMail(
                "Verify Email",
                hostEmail,
                to,
                VERIFICATION_EMAIL,
                List.of(
                        Map.entry("username", username),
                        Map.entry("verificationLink", verificationLink)
                )
        );
        log.info("Verification email sent to {}", to);
    }

    public void sendResetPasswordMail(String to, String username, String resetLink) {
        mailUtil.buildAndSendMail(
                "Reset Password",
                hostEmail,
                to,
                RESET_PASSWORD_EMAIL,
                List.of(
                        Map.entry("username", username),
                        Map.entry("resetLink", resetLink)
                )
        );
        log.info("Verification email sent to {}", to);
    }

}
