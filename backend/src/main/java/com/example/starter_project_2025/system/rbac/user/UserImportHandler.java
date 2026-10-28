package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.dataio.importer.hook.ImportHandler;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.result.GeneratedCredential;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.util.PasswordPolicy;
import com.example.starter_project_2025.system.auth.util.TemporaryPassword;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Rules for importing users from Excel/CSV. The email identifies the account. Creating accounts sends
 * no email, so an import of any size never depends on the mail provider.
 *
 * <table>
 *   <tr><th>Account</th><th>Password column</th><th>Result</th></tr>
 *   <tr><td>new</td><td>filled</td><td>password checked, hashed and saved; the account is ready to use</td></tr>
 *   <tr><td>new</td><td>empty</td><td>the system generates a random temporary password for that person and the account
 *       must choose its own password at the first sign-in. The temporary passwords are returned once to
 *       the person who ran the import</td></tr>
 *   <tr><td>existing</td><td>filled</td><td>caller needs USER_UPDATE; password checked, hashed and updated, sessions
 *       revoked; "password changed" notice to the owner (can be switched off, no password in it)</td></tr>
 *   <tr><td>existing</td><td>empty</td><td>skipped; the current password is kept, no email</td></tr>
 * </table>
 *
 * Also rejected, per Excel row: invalid data, an email that appears twice in the same file.
 * Passwords are never put in an email. At most {@code app.import.max-emails} notices are sent per import.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserImportHandler implements ImportHandler<User> {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?\\d{8,15}$");

    private static final String PERMISSION_CREATE = "USER_CREATE";
    private static final String PERMISSION_UPDATE = "USER_UPDATE";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountMailService accountMailService;
    private final RefreshTokenService refreshTokenService;

    /** Tell the owner by email when an import changes their password. Set to false to send no email at all. */
    @Value("${app.import.notify-password-change:true}")
    private boolean notifyPasswordChange = true;

    /** Protects the mail account: after this many emails in one import, no more are sent. */
    @Value("${app.import.max-emails:100}")
    private int maxEmailsPerImport = 100;

    /** State of the import running on this thread. */
    private static final class Run {
        /** Excel row number (header = row 1) of every row object. */
        final Map<Map<String, String>, Integer> rowNumbers = new IdentityHashMap<>();
        /** First Excel row that used each email (lower case). */
        final Map<String, Integer> firstRowByEmail = new HashMap<>();
        /** Entities that already existed in the database and are updated in place. */
        final Set<User> existing = Collections.newSetFromMap(new IdentityHashMap<>());
        /** Temporary passwords generated in this run, by entity. */
        final Map<User, String> temporaryPasswords = new IdentityHashMap<>();
        /** Emails sent or attempted so far in this run. */
        int emailsAttempted;
    }

    private final ThreadLocal<Run> run = new ThreadLocal<>();

    @Override
    public Class<User> entityType() {
        return User.class;
    }

    @Override
    public void beforeImport(List<Map<String, String>> rows) {
        Run state = new Run();
        int fallback = 2;
        for (Map<String, String> row : rows) {
            int rowNumber = FileParser.rowNumberOf(row, fallback);
            state.rowNumbers.put(row, rowNumber);
            String email = value(row, "Email");
            if (email != null) {
                state.firstRowByEmail.putIfAbsent(email.toLowerCase(Locale.ROOT), rowNumber);
            }
            fallback = rowNumber + 1;
        }
        run.set(state);
    }

    @Override
    public void afterImport() {
        run.remove();
    }

    @Override
    public boolean shouldSkip(Map<String, String> row) {
        String email = value(row, "Email");
        if (email == null) {
            return false; // beforeSave reports the missing email
        }

        rejectDuplicateInFile(row, email);

        // An existing account without a password keeps its current password: nothing to do.
        return value(row, "Password") == null && userRepository.findByEmailIgnoreCase(email).isPresent();
    }

    @Override
    public Optional<User> resolveExisting(Map<String, String> row) {
        String email = value(row, "Email");
        if (email == null) {
            return Optional.empty();
        }

        Optional<User> existing = userRepository.findByEmailIgnoreCase(email);
        existing.ifPresent(user -> {
            Run state = run.get();
            if (state != null) {
                state.existing.add(user);
            }
        });
        return existing;
    }

    @Override
    public void beforeSave(User user, Map<String, String> row) {

        String email = value(row, "Email");
        if (email == null || !EMAIL_PATTERN.matcher(email).matches() || email.length() > 100) {
            throw new IllegalArgumentException("Email is invalid");
        }

        String rawPassword = value(row, "Password");

        if (isExisting(user)) {
            updateExistingPassword(user, rawPassword);
            return;
        }

        requirePermission(PERMISSION_CREATE, "create accounts");

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

        user.setLocked(false);

        if (rawPassword != null) {
            requireStrongPassword(rawPassword);
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
            user.setIsActive(true);
            user.setMustChangePassword(false);
        } else {
            // No password in the file: generate a random temporary one for this person. The account is
            // active, but its owner has to choose their own password at the first sign-in.
            String temporary = TemporaryPassword.generate();
            user.setPasswordHash(passwordEncoder.encode(temporary));
            user.setIsActive(true);
            user.setMustChangePassword(true);

            Run state = run.get();
            if (state != null) {
                state.temporaryPasswords.put(user, temporary);
            }
        }
    }

    @Override
    public void afterSave(User user, Map<String, String> row, int rowNumber, ImportResult result) {

        boolean existing = isExisting(user);

        try {
            if (existing) {
                // The password changed: every signed-in session of this account must sign in again.
                refreshTokenService.revokeAllRefreshTokens(user.getId());
                result.setUpdatedCount(result.getUpdatedCount() + 1);
            }
        } catch (Exception e) {
            log.warn("Could not revoke sessions of {}: {}", user.getEmail(), e.getMessage());
        }

        // A temporary password was generated: hand it to the person who ran the import, send no email.
        Run state = run.get();
        String temporary = state == null ? null : state.temporaryPasswords.remove(user);
        if (temporary != null) {
            result.getCredentials().add(new GeneratedCredential(rowNumber, user.getEmail(), temporary));
            return;
        }

        // Creating an account sends no email. Only an existing owner whose password was changed is told.
        if (!existing || !notifyPasswordChange) {
            return;
        }

        if (state != null && state.emailsAttempted >= maxEmailsPerImport) {
            result.setEmailsSkipped(result.getEmailsSkipped() + 1);
            return;
        }
        if (state != null) {
            state.emailsAttempted++;
        }

        try {
            accountMailService.sendPasswordChangedNotification(user);
            result.setEmailsSent(result.getEmailsSent() + 1);

        } catch (Exception e) {
            log.warn("Could not send the password-change notice to {}: {}", user.getEmail(), e.getMessage());
            result.setEmailsFailed(result.getEmailsFailed() + 1);
            result.getErrors().add(new RowError(
                    rowNumber,
                    "Password updated, but the notice to " + user.getEmail() + " could not be sent."));
        }
    }

    // ------------------------------------------------------------------ helpers

    /** Existing account + a password in the file: check the caller's right, then change the password. */
    private void updateExistingPassword(User user, String rawPassword) {
        requirePermission(PERMISSION_UPDATE, "change the password of an existing account");

        if (rawPassword == null) {
            // shouldSkip() normally filters this case out; never change anything without a password.
            throw new IllegalArgumentException("Password is empty, nothing to update");
        }

        requireStrongPassword(rawPassword);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setMustChangePassword(false);
    }

    private void requireStrongPassword(String rawPassword) {
        String problem = PasswordPolicy.validate(rawPassword);
        if (problem != null) {
            throw new IllegalArgumentException(problem);
        }
    }

    private void rejectDuplicateInFile(Map<String, String> row, String email) {
        Run state = run.get();
        if (state == null) {
            return;
        }
        Integer first = state.firstRowByEmail.get(email.toLowerCase(Locale.ROOT));
        Integer current = state.rowNumbers.get(row);
        if (first != null && current != null && !first.equals(current)) {
            throw new IllegalArgumentException(
                    "Duplicate email in the file: " + email + " is already used in row " + first);
        }
    }

    private boolean isExisting(User user) {
        Run state = run.get();
        return state != null && state.existing.contains(user);
    }

    private static void requirePermission(String authority, String action) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean allowed = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
        if (!allowed) {
            throw new IllegalArgumentException("You do not have permission to " + action);
        }
    }

    /** Reads a column; the header is matched ignoring case and surrounding spaces ("password" = "Password"). */
    private static String value(Map<String, String> row, String key) {
        String direct = row.get(key);
        if (direct != null) {
            return trim(direct);
        }
        for (Map.Entry<String, String> entry : row.entrySet()) {
            if (entry.getKey() != null && entry.getKey().trim().equalsIgnoreCase(key)) {
                return trim(entry.getValue());
            }
        }
        return null;
    }

    private static String trim(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
