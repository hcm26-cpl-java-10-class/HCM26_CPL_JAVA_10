package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.dataio.importer.hook.ImportHandler;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.auth.util.PasswordPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Rules for importing users from Excel/CSV:
 * <ul>
 *   <li>An email that already exists in the system is skipped: nothing is changed and no email is sent.</li>
 *   <li>Password column filled: the password must be strong enough; it is saved and emailed to the user.</li>
 *   <li>Password column empty: the account gets a random password and the user receives an email
 *       with a link to create their own password.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserImportHandler implements ImportHandler<User> {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?\\d{8,15}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountMailService accountMailService;

    @Override
    public Class<User> entityType() {
        return User.class;
    }

    @Override
public boolean shouldSkip(Map<String, String> row) {
    String email = value(row, "Email");
    String password = value(row, "Password");

    if (email == null) {
        return false;
    }

    boolean existingAccount =
            userRepository.findByEmailIgnoreCase(email).isPresent();

    if (!existingAccount) {
        return false;
    }

    if (password == null) {
        return true;
    }

    return false;
}

    @Override
    public User mergeExisting(User mappedUser, Map<String, String> row) {
        String email = value(row, "Email");
        if (email == null) return mappedUser;
        // If email exists and a password was supplied, update that existing row.
        return userRepository.findByEmailIgnoreCase(email).orElse(mappedUser);
    }

    @Override
    public void beforeSave(User user, Map<String, String> row) {

        String email = value(row, "Email");
        if (email == null || !EMAIL_PATTERN.matcher(email).matches() || email.length() > 100) {
            throw new IllegalArgumentException("Email is invalid");
        }
        user.setEmail(email);

        if (user.getFirstName() == null || user.getFirstName().isBlank()) {
            throw new IllegalArgumentException("First Name is required");
        }

        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            throw new IllegalArgumentException("At least one role is required (Roles column)");
        }

        String phone = trim(user.getPhone());
        if (phone != null) {
            phone = phone.replaceAll("[\\s.\\-]", "");
            if (!PHONE_PATTERN.matcher(phone).matches()) {
                throw new IllegalArgumentException("Phone number is invalid");
            }
        }
        user.setPhone(phone);

        // Existing accounts: only change the password when the Excel cell is populated.
        // New accounts with an empty password receive a random secret and a set-password email.
        String rawPassword = value(row, "Password");
        boolean existingAccount = user.getId() != null;
        if (rawPassword != null) {
            String problem = PasswordPolicy.validate(rawPassword);
            if (problem != null) {
                throw new IllegalArgumentException(problem);
            }
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
        } else if (!existingAccount) {
            user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID() + "Aa1!"));
        }

        // Do not silently unlock/deactivate or otherwise alter existing account status.
        if (!existingAccount) {
            user.setIsActive(true);
            user.setLocked(false);
        }
    }

    @Override
    public void afterSave(User user, Map<String, String> row, int rowNumber, ImportResult result) {
        // Existing account password updates must not send the plaintext password by email.
        // Existing rows are updated in place, so their id is non-null.
        if (user.getId() != null) {
            return;
        }
        String rawPassword = value(row, "Password");

        try {
            if (rawPassword != null) {
                accountMailService.sendAccountWithPassword(user, rawPassword);
            } else {
                accountMailService.sendSetPasswordInvitation(user);
            }
            result.setEmailsSent(result.getEmailsSent() + 1);

        } catch (Exception e) {
            log.warn("Could not send account email to {}: {}", user.getEmail(), e.getMessage());
            result.setEmailsFailed(result.getEmailsFailed() + 1);
            result.getErrors().add(new RowError(
                    rowNumber,
                    "Account created, but the email to " + user.getEmail() + " could not be sent."));
        }
    }

    private static String value(Map<String, String> row, String key) {
        return trim(row.get(key));
    }

    private static String trim(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
