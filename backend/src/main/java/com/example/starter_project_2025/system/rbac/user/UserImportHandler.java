package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.hook.ImportHandler;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.util.PasswordPolicy;
import com.example.starter_project_2025.system.auth.util.InitialPassword;
import com.example.starter_project_2025.system.rbac.department.Department;
import com.example.starter_project_2025.system.rbac.role.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

/**
 * Rules for importing users from Excel/CSV. The email identifies the account. Creating accounts sends
 * no email, so an import of any size never depends on the mail provider.
 *
 * <table>
 *   <tr><th>Account</th><th>Password column</th><th>Result</th></tr>
 *   <tr><td>new</td><td>filled</td><td>password checked, hashed and saved; the account is ready to use</td></tr>
 *   <tr><td>new</td><td>empty</td><td>the initial password is built from the email and the date of birth (see
 *       {@link InitialPassword}) and the account must choose its own password at the first sign-in</td></tr>
 *   <tr><td>existing</td><td>filled</td><td>caller needs USER_UPDATE; password checked, hashed and updated, sessions
 *       revoked; "password changed" notice to the owner (can be switched off, no password in it). Roles,
 *       Departments, names, phone and description in the file are applied too when they differ</td></tr>
 *   <tr><td>existing</td><td>empty</td><td>caller needs USER_UPDATE only if something differs: Roles, Departments,
 *       First Name, Last Name, Phone or Description in the file are applied (a blank cell keeps the current
 *       value), counted as updated, no email. Nothing differs: skipped (unchanged)</td></tr>
 * </table>
 *
 * The import is all or nothing: when any row is rejected (invalid data, an email that appears twice in the
 * same file, ...) nothing is saved and every rejected row is reported.
 * Passwords are never put in an email. At most {@code app.import.max-emails} notices are sent per import.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserImportHandler implements ImportHandler<User> {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?\\d{8,15}$");

    /** Year, then month and day with one or two digits: 2000-01-05 and 2000-1-5 are the same date. */
    private static final Pattern DATE_SHAPE = Pattern.compile("\\d{4}-\\d{1,2}-\\d{1,2}");
    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("uuuu-M-d").withResolverStyle(ResolverStyle.STRICT);

    /**
     * Initial passwords follow a known pattern (email + date of birth) and are replaced at the first sign-in,
     * so a slow hash protects nothing there: they get the cheapest bcrypt cost (about 1 ms instead of
     * about 100 ms). A hash carries its own cost, so signing in works as usual, and the password the person
     * chooses afterwards is hashed with the normal cost. Passwords typed in the file keep the normal cost.
     */
    private static final PasswordEncoder INITIAL_PASSWORD_ENCODER = new BCryptPasswordEncoder(4);

    private static final String PERMISSION_CREATE = "USER_CREATE";
    private static final String PERMISSION_UPDATE = "USER_UPDATE";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountMailService accountMailService;
    private final RefreshTokenService refreshTokenService;
    private final RelationLookupEngine relationEngine;

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
        /** Existing entities whose password the import changed (only these get sessions revoked and a notice). */
        final Set<User> passwordChanged = Collections.newSetFromMap(new IdentityHashMap<>());
        /** The accounts that already exist for the emails of the file (lower-case email), loaded in one go. */
        final Map<String, User> existingByEmail = new HashMap<>();
        boolean existingLoaded;
        /** Password hashes computed in parallel before the rows are processed, by row. */
        final Map<Map<String, String>, String> passwordHashes = new IdentityHashMap<>();
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

        loadExistingAccounts(state, rows);
        precomputePasswordHashes(state, rows);

        run.set(state);
    }

    /** One query per 500 emails instead of one query per row. */
    private void loadExistingAccounts(Run state, List<Map<String, String>> rows) {
        Set<String> emails = new LinkedHashSet<>();
        for (Map<String, String> row : rows) {
            String email = value(row, "Email");
            if (email != null) {
                emails.add(email.toLowerCase(Locale.ROOT));
            }
        }

        List<String> all = new ArrayList<>(emails);
        for (int from = 0; from < all.size(); from += 500) {
            List<String> chunk = new ArrayList<>(all.subList(from, Math.min(from + 500, all.size())));
            for (User user : userRepository.findAllByEmailLowerIn(chunk)) {
                state.existingByEmail.put(user.getEmail().toLowerCase(Locale.ROOT), user);
            }
        }
        state.existingLoaded = true;
    }

    /**
     * Hashing a password is deliberately slow and was done row by row. Here every password that will be
     * needed (given in the file, or built from the email and date of birth for a new account) is hashed
     * at once on all processors. A row with invalid data is simply not hashed: it is reported later.
     */
    private void precomputePasswordHashes(Run state, List<Map<String, String>> rows) {
        List<Map<String, String>> targets = new ArrayList<>();
        List<String> secrets = new ArrayList<>();
        List<Boolean> initial = new ArrayList<>();

        for (Map<String, String> row : rows) {
            String email = value(row, "Email");
            if (email == null) {
                continue;
            }
            try {
                String password = value(row, "Password");
                if (password != null) {
                    if (PasswordPolicy.validate(password) == null) {
                        targets.add(row);
                        secrets.add(password);
                        initial.add(false);
                    }
                } else if (!state.existingByEmail.containsKey(email.toLowerCase(Locale.ROOT))
                        && EMAIL_PATTERN.matcher(email).matches()) {
                    LocalDate dateOfBirth = parseDateOfBirth(value(row, "Date of Birth"));
                    if (dateOfBirth != null) {
                        targets.add(row);
                        secrets.add(InitialPassword.from(email, dateOfBirth));
                        initial.add(true);
                    }
                }
            } catch (RuntimeException e) {
                // The row has invalid data; it is reported when it is processed.
            }
        }

        if (targets.isEmpty()) {
            return;
        }

        List<String> hashes = IntStream.range(0, targets.size())
                .parallel()
                .mapToObj(i -> (initial.get(i) ? INITIAL_PASSWORD_ENCODER : passwordEncoder).encode(secrets.get(i)))
                .toList();

        for (int i = 0; i < targets.size(); i++) {
            state.passwordHashes.put(targets.get(i), hashes.get(i));
        }
    }

    /** The hash computed in advance for this row, or a fresh one when there is none. */
    private String hashFor(Map<String, String> row, String rawPassword, boolean initialPassword) {
        Run state = run.get();
        String ready = state == null ? null : state.passwordHashes.get(row);
        if (ready != null) {
            return ready;
        }
        return (initialPassword ? INITIAL_PASSWORD_ENCODER : passwordEncoder).encode(rawPassword);
    }

    private Optional<User> findExisting(String email) {
        Run state = run.get();
        if (state != null && state.existingLoaded) {
            return Optional.ofNullable(state.existingByEmail.get(email.toLowerCase(Locale.ROOT)));
        }
        return userRepository.findByEmailIgnoreCase(email);
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

        // Reject a bad Date of Birth / Gender with a clear message, and hand the mapper the canonical form.
        normalizeProfileColumns(row);

        Optional<User> existing = findExisting(email);
        if (existing.isEmpty()) {
            // A new account needs both. An existing account keeps its stored value when the cell is blank.
            requireColumn(row, "Date of Birth");
            requireColumn(row, "Gender");
            return false;
        }
        if (value(row, "Password") != null) {
            return false;
        }

        // An existing account without a password keeps its current password. It is skipped only when
        // nothing else in the row differs from what is stored (roles, departments, name, phone...).
        return !detectChanges(existing.get(), row).any();
    }

    @Override
    public Optional<User> resolveExisting(Map<String, String> row) {
        String email = value(row, "Email");
        if (email == null) {
            return Optional.empty();
        }

        Optional<User> existing = findExisting(email);
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
            Changes changes = detectChanges(user, row);
            if (rawPassword == null && !changes.any()) {
                // shouldSkip() normally filters this case out.
                throw new IllegalArgumentException("Nothing to update");
            }

            requirePermission(PERMISSION_UPDATE, "update an existing account");

            if (rawPassword != null) {
                updateExistingPassword(user, row, rawPassword);
                Run state = run.get();
                if (state != null) {
                    state.passwordChanged.add(user);
                }
            }
            applyChanges(user, changes);
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
            user.setPasswordHash(hashFor(row, rawPassword, false));
            user.setIsActive(true);
            user.setMustChangePassword(false);
        } else {
            // No password in the file: the initial password is built from the email and the date of birth.
            // The account is active, but its owner has to choose their own password at the first sign-in.
            user.setPasswordHash(hashFor(row, InitialPassword.from(email, user.getDateOfBirth()), true));
            user.setIsActive(true);
            user.setMustChangePassword(true);
        }
    }

    @Override
    public void afterSave(User user, Map<String, String> row, int rowNumber, ImportResult result) {

        boolean existing = isExisting(user);

        Run state = run.get();
        boolean passwordChanged = existing && state != null && state.passwordChanged.remove(user);

        if (existing) {
            // Every existing account the import changed counts as updated, whatever was changed.
            result.setUpdatedCount(result.getUpdatedCount() + 1);
        }

        try {
            if (passwordChanged) {
                // The password changed: every signed-in session of this account must sign in again.
                refreshTokenService.revokeAllRefreshTokens(user.getId());
            }
        } catch (Exception e) {
            log.warn("Could not revoke sessions of {}: {}", user.getEmail(), e.getMessage());
        }

        // Creating an account sends no email. Only an existing owner whose password was changed is told.
        if (!passwordChanged || !notifyPasswordChange) {
            return;
        }

        if (state != null && state.emailsAttempted >= maxEmailsPerImport) {
            result.setEmailsSkipped(result.getEmailsSkipped() + 1);
            return;
        }
        if (state != null) {
            state.emailsAttempted++;
        }

        // The import is all or nothing: the notice goes out only after the whole import was saved.
        afterCommit(() -> sendPasswordChangedNotice(user, rowNumber, result));
    }

    private void sendPasswordChangedNotice(User user, int rowNumber, ImportResult result) {
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

    /** Runs the action once the surrounding transaction has been committed (at once when there is none). */
    private void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    // ------------------------------------------------------------------ helpers

    /** Existing account + a password in the file: check the caller's right, then change the password. */
    private void updateExistingPassword(User user, Map<String, String> row, String rawPassword) {
        if (rawPassword == null) {
            // shouldSkip() normally filters this case out; never change anything without a password.
            throw new IllegalArgumentException("Password is empty, nothing to update");
        }

        requireStrongPassword(rawPassword);
        user.setPasswordHash(hashFor(row, rawPassword, false));
        user.setMustChangePassword(false);
    }

    /** What a row would change on an existing account. A field is null when the row leaves it as it is. */
    private static final class Changes {
        String firstName;
        String lastName;
        String phone;
        String description;
        LocalDate dateOfBirth;
        Gender gender;
        Set<Role> roles;
        Set<Department> departments;

        boolean any() {
            return firstName != null || lastName != null || phone != null || description != null
                    || dateOfBirth != null || gender != null
                    || roles != null || departments != null;
        }
    }

    /**
     * Compares the row with the stored account. A blank cell means "keep the current value". Roles and
     * Departments in the file are the full list (they replace the current ones). A role or department
     * that does not exist rejects the row.
     */
    private Changes detectChanges(User user, Map<String, String> row) {
        Changes changes = new Changes();

        changes.firstName = changedText(value(row, "First Name"), user.getFirstName());
        changes.lastName = changedText(value(row, "Last Name"), user.getLastName());
        changes.description = changedText(value(row, "Description"), user.getDescription());

        String phone = value(row, "Phone");
        if (phone != null) {
            phone = phone.replaceAll("[\\s.\\-]", "");
            if (!PHONE_PATTERN.matcher(phone).matches()) {
                throw new IllegalArgumentException("Phone number is invalid");
            }
            changes.phone = changedText(phone, user.getPhone());
        }

        LocalDate dateOfBirth = parseDateOfBirth(value(row, "Date of Birth"));
        if (dateOfBirth != null && !dateOfBirth.equals(user.getDateOfBirth())) {
            changes.dateOfBirth = dateOfBirth;
        }

        Gender gender = parseGender(value(row, "Gender"));
        if (gender != null && gender != user.getGender()) {
            changes.gender = gender;
        }

        String rawRoles = value(row, "Roles");
        if (rawRoles != null) {
            Set<Role> wanted = resolveRelation("roles", rawRoles);
            if (!ids(wanted, Role::getId).equals(ids(user.getRoles(), Role::getId))) {
                changes.roles = wanted;
            }
        }

        String rawDepartments = value(row, "Departments");
        if (rawDepartments != null) {
            Set<Department> wanted = resolveRelation("departments", rawDepartments);
            if (!ids(wanted, Department::getId).equals(ids(user.getDepartments(), Department::getId))) {
                changes.departments = wanted;
            }
        }

        return changes;
    }

    private static void applyChanges(User user, Changes changes) {
        if (changes.firstName != null) user.setFirstName(changes.firstName);
        if (changes.lastName != null) user.setLastName(changes.lastName);
        if (changes.phone != null) user.setPhone(changes.phone);
        if (changes.description != null) user.setDescription(changes.description);
        if (changes.dateOfBirth != null) user.setDateOfBirth(changes.dateOfBirth);
        if (changes.gender != null) user.setGender(changes.gender);

        if (changes.roles != null) {
            user.getRoles().clear();
            user.getRoles().addAll(changes.roles);
        }
        if (changes.departments != null) {
            user.getDepartments().clear();
            user.getDepartments().addAll(changes.departments);
        }
    }

    /** Looks the names/codes of a column up with the same rules as a normal import (see the User fields). */
    @SuppressWarnings("unchecked")
    private <E> Set<E> resolveRelation(String fieldName, String raw) {
        try {
            Field field = User.class.getDeclaredField(fieldName);
            ImportField meta = field.getAnnotation(ImportField.class);
            return (Set<E>) relationEngine.resolve(raw, field, meta);
        } catch (NoSuchFieldException e) {
            throw new IllegalStateException("User has no field " + fieldName, e);
        }
    }

    private static <E> Set<Long> ids(Collection<E> items, Function<E, Long> id) {
        Set<Long> result = new HashSet<>();
        if (items != null) {
            for (E item : items) {
                result.add(id.apply(item));
            }
        }
        return result;
    }

    private static void requireColumn(Map<String, String> row, String column) {
        if (value(row, column) == null) {
            throw new IllegalArgumentException(column + " is required");
        }
    }

    /** Validates Date of Birth and Gender and rewrites them to the form the generic mapper understands. */
    private void normalizeProfileColumns(Map<String, String> row) {
        LocalDate dateOfBirth = parseDateOfBirth(value(row, "Date of Birth"));
        if (dateOfBirth != null) {
            row.put("Date of Birth", dateOfBirth.toString());
        }

        Gender gender = parseGender(value(row, "Gender"));
        if (gender != null) {
            row.put("Gender", gender.name());
        }
    }

    /**
     * Accepts yyyy-MM-dd, with or without the leading zero of the month and day (an Excel date cell may
     * also bring a time part). The date must exist (no 32nd, no 29 February in a common year).
     * Null for an empty cell.
     */
    private static LocalDate parseDateOfBirth(String raw) {
        if (raw == null) {
            return null;
        }

        String text = raw.trim();
        if (text.length() > 10 && text.charAt(10) == 'T') {
            text = text.substring(0, 10);
        }

        LocalDate date;
        try {
            if (!DATE_SHAPE.matcher(text).matches()) {
                throw new DateTimeParseException("Not a yyyy-M-d date", text, 0);
            }
            date = LocalDate.parse(text, DATE_FORMAT);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Date of Birth must be in the format yyyy-MM-dd, for example 2000-01-31");
        }

        if (date.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Date of Birth cannot be in the future");
        }
        return date;
    }

    /** Accepts Male, Female or Other, in any letter case. Null for an empty cell. */
    private static Gender parseGender(String raw) {
        if (raw == null) {
            return null;
        }

        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "male" -> Gender.MALE;
            case "female" -> Gender.FEMALE;
            case "other" -> Gender.OTHER;
            default -> throw new IllegalArgumentException("Gender must be Male, Female or Other");
        };
    }

    private static String changedText(String wanted, String current) {
        return wanted == null || wanted.equals(current) ? null : wanted;
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
