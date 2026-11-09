package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.auth.util.PasswordPolicy;
import com.example.starter_project_2025.system.rbac.department.Department;
import com.example.starter_project_2025.system.rbac.role.Role;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Import rules for users: new/existing account x password filled/empty, duplicates, permissions,
 * changes to roles/departments/profile of existing accounts, and the guarantee that no email
 * contains a password.
 */
class UserImportHandlerTest {

    /** Records the mails that would be sent. */
    static class FakeMail extends AccountMailService {
        final List<String> sent = new ArrayList<>();
        boolean failing;

        FakeMail() {
            super(null);
        }

        @Override
        public void sendPasswordChangedNotification(User user) {
            if (failing) {
                throw new IllegalStateException("Authentication failed");
            }
            sent.add("changed:" + user.getEmail());
        }
    }

    private static final Map<String, Long> ROLE_IDS = Map.of("STUDENT", 1L, "TEACHER", 2L);
    private static final Map<String, Long> DEPARTMENT_IDS = Map.of("IT", 10L, "HR", 11L);

    /** Stands in for the database lookup of roles (by name) and departments (by code). */
    static class FakeRelations extends RelationLookupEngine {
        FakeRelations() {
            super(null);
        }

        @Override
        public Object resolve(String raw, Field field, ImportField meta) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            boolean roles = field.getName().equals("roles");
            Map<String, Long> known = roles ? ROLE_IDS : DEPARTMENT_IDS;

            Set<Object> result = new HashSet<>();
            for (String value : raw.split(meta.separator())) {
                Long id = known.get(value.trim());
                if (id == null) {
                    throw new RuntimeException("Not found: " + meta.lookupField() + " = '" + value.trim() + "'");
                }
                if (roles) {
                    Role role = new Role();
                    role.setId(id);
                    result.add(role);
                } else {
                    Department department = new Department();
                    department.setId(id);
                    result.add(department);
                }
            }
            return result;
        }
    }

    private final Map<String, User> database = new HashMap<>();
    private final List<Long> revokedSessions = new ArrayList<>();
    private FakeMail mail;
    private UserImportHandler handler;

    @BeforeEach
    void setUp() {
        database.clear();
        revokedSessions.clear();
        mail = new FakeMail();

        Function<Object[], Object> byEmail =
                args -> Optional.ofNullable(database.get(String.valueOf(args[0]).toLowerCase()));

        UserRepository users = TestStubs.stub(UserRepository.class, Map.of(
                "findByEmailIgnoreCase", byEmail,
                "findByEmail", byEmail));

        PasswordEncoder encoder = TestStubs.stub(PasswordEncoder.class, Map.of(
                "encode", args -> "HASH:" + args[0]));

        RefreshTokenService sessions = TestStubs.stub(RefreshTokenService.class, Map.of(
                "revokeAllRefreshTokens", args -> {
                    revokedSessions.add((Long) args[0]);
                    return null;
                }));

        handler = new UserImportHandler(users, encoder, mail, sessions, new FakeRelations());
        grant("USER_CREATE", "USER_UPDATE");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ---------------------------------------------------------------- helpers

    private static void grant(String... authorities) {
        List<SimpleGrantedAuthority> granted = new ArrayList<>();
        for (String authority : authorities) {
            granted.add(new SimpleGrantedAuthority(authority));
        }
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null, granted));
    }

    private static Map<String, String> row(String email, String password) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("Email", email);
        row.put("First Name", "Test");
        row.put("Roles", "STUDENT");
        row.put("Date of Birth", "2000-01-31");
        row.put("Gender", "Male");
        if (password != null) {
            row.put("Password", password);
        }
        return row;
    }

    private User existing(String email, String oldHash) {
        User user = new User();
        user.setId(7L);
        user.setEmail(email);
        user.setFirstName("Test"); // same as the default row, so a row differs only where a test makes it differ
        Role student = new Role();
        student.setId(ROLE_IDS.get("STUDENT"));
        Set<Role> roles = new HashSet<>();
        roles.add(student);
        user.setRoles(roles);
        user.setDateOfBirth(LocalDate.of(2000, 1, 31)); // same as the default row
        user.setGender(Gender.MALE);
        user.setPasswordHash(oldHash);
        user.setIsActive(true);
        user.setLocked(false);
        user.setMustChangePassword(false);
        database.put(email.toLowerCase(), user);
        return user;
    }

    /** Does what GenericImportService does for every row, for one import run. */
    private ImportResult run(List<Map<String, String>> rows) {
        ImportResult result = new ImportResult();
        handler.beforeImport(rows);
        try {
            int rowNumber = 2;
            for (Map<String, String> row : rows) {
                try {
                    if (handler.shouldSkip(row)) {
                        result.setSkippedCount(result.getSkippedCount() + 1);
                    } else {
                        User user = handler.resolveExisting(row).orElseGet(() -> {
                            User created = new User(); // the real importer maps the row into a new entity
                            created.setEmail(row.get("Email"));
                            created.setFirstName(row.get("First Name"));
                            Set<Role> roles = new HashSet<>();
                            roles.add(new Role());
                            created.setRoles(roles);
                            created.setPasswordHash(row.get("Password")); // raw cell, as the mapper does
                            return created;
                        });
                        handler.beforeSave(user, row);
                        user.setId(user.getId() == null ? 99L : user.getId()); // "saved"
                        result.setSuccessCount(result.getSuccessCount() + 1);
                        handler.afterSave(user, row, rowNumber, result);
                    }
                } catch (Exception e) {
                    result.setFailureCount(result.getFailureCount() + 1);
                    result.getErrors().add(new com.example.starter_project_2025.base.dataio.importer.result.RowError(
                            rowNumber, e.getMessage()));
                }
                rowNumber++;
            }
        } finally {
            handler.afterImport();
        }
        return result;
    }

    private ImportResult run(Map<String, String> row) {
        return run(List.of(row));
    }

    // ---------------------------------------------------------------- new accounts

    @Test
    void newAccountWithPassword_isActive_hashed_andNoEmailIsSent() {
        Map<String, String> row = row("new@example.com", "Hoa12345");

        ImportResult result = run(row);

        assertEquals(1, result.getSuccessCount());
        assertEquals(0, result.getFailureCount());
        assertTrue(mail.sent.isEmpty()); // creating an account never sends an email
        assertTrue(result.getCredentials().isEmpty());

        handler.beforeImport(List.of(row));
        User user = new User();
        user.setEmail("new@example.com");
        user.setFirstName("Test");
        Set<Role> roles = new HashSet<>();
        roles.add(new Role());
        user.setRoles(roles);
        handler.beforeSave(user, row);
        handler.afterImport();

        assertEquals("HASH:Hoa12345", user.getPasswordHash());
        assertTrue(user.getIsActive());
        assertFalse(user.getMustChangePassword());
    }

    @Test
    void newAccountWithoutPassword_getsATemporaryPassword_mustChangeItAtFirstLogin_andNoEmailIsSent() {
        Map<String, String> row = row("temp@example.com", null);

        ImportResult result = run(row);

        assertEquals(1, result.getSuccessCount());
        assertTrue(mail.sent.isEmpty()); // nothing to send: this is what keeps 1000-row imports under mail limits
        assertEquals(1, result.getCredentials().size());
        assertEquals("temp@example.com", result.getCredentials().get(0).email());
        assertEquals(2, result.getCredentials().get(0).rowNumber());

        String temporary = result.getCredentials().get(0).temporaryPassword();
        assertNull(PasswordPolicy.validate(temporary)); // it satisfies the password policy

        handler.beforeImport(List.of(row));
        User user = new User();
        user.setEmail("temp@example.com");
        user.setFirstName("Test");
        Set<Role> roles = new HashSet<>();
        roles.add(new Role());
        user.setRoles(roles);
        handler.beforeSave(user, row);
        handler.afterImport();

        assertTrue(user.getIsActive());
        assertTrue(user.getMustChangePassword());
        assertTrue(user.getPasswordHash().startsWith("HASH:"));
    }

    @Test
    void everyPersonGetsTheirOwnTemporaryPassword() {
        ImportResult result = run(List.of(
                row("a@example.com", null),
                row("b@example.com", null),
                row("c@example.com", null)));

        assertEquals(3, result.getCredentials().size());
        Set<String> distinct = new HashSet<>();
        result.getCredentials().forEach(credential -> distinct.add(credential.temporaryPassword()));
        assertEquals(3, distinct.size());
    }

    @Test
    void newAccountWithWeakPassword_isRejectedOnItsRow() {
        ImportResult result = run(row("weak@example.com", "password123"));

        assertEquals(0, result.getSuccessCount());
        assertEquals(1, result.getFailureCount());
        assertEquals(2, result.getErrors().get(0).getRowNumber());
        assertTrue(mail.sent.isEmpty());
    }

    @Test
    void newAccountWithInvalidData_isRejectedOnItsRow() {
        Map<String, String> badEmail = row("not-an-email", "Hoa12345");

        ImportResult result = run(badEmail);

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("Email"));
    }

    // ---------------------------------------------------------------- existing accounts

    @Test
    void existingAccountWithPassword_updatesPassword_revokesSessions_andSendsChangedEmail() {
        User user = existing("old@example.com", "HASH:before");
        user.setMustChangePassword(true);

        ImportResult result = run(row("OLD@example.com", "Hoa12345"));

        assertEquals(1, result.getSuccessCount());
        assertEquals(1, result.getUpdatedCount());
        assertEquals(0, result.getSkippedCount());
        assertEquals("HASH:Hoa12345", user.getPasswordHash());
        assertEquals(List.of(7L), revokedSessions);
        assertEquals(List.of("changed:old@example.com"), mail.sent);
        assertFalse(user.getMustChangePassword()); // the administrator chose this password: no forced change
    }

    @Test
    void existingAccountWithPassword_inAFileThatOnlyHasEmailAndPassword_isStillUpdated() {
        User user = existing("old@example.com", "HASH:before");
        Map<String, String> row = new LinkedHashMap<>();
        row.put("Email", "old@example.com");
        row.put("password", "Hoa12345"); // header exactly as the Export file names it, lower case

        ImportResult result = run(row);

        assertEquals(1, result.getUpdatedCount());
        assertEquals("HASH:Hoa12345", user.getPasswordHash());
    }

    @Test
    void existingAccountWithoutPassword_isKeptAsIs_noEmail() {
        User user = existing("old@example.com", "HASH:before");

        ImportResult result = run(row("old@example.com", null));

        assertEquals(1, result.getSkippedCount());
        assertEquals(0, result.getSuccessCount());
        assertEquals("HASH:before", user.getPasswordHash());
        assertTrue(mail.sent.isEmpty());
        assertTrue(revokedSessions.isEmpty());
    }

    @Test
    void existingAccountWithWeakPassword_keepsTheOldPassword() {
        User user = existing("old@example.com", "HASH:before");

        ImportResult result = run(row("old@example.com", "12345678"));

        assertEquals(1, result.getFailureCount());
        assertEquals("HASH:before", user.getPasswordHash());
        assertTrue(mail.sent.isEmpty());
    }

    // ---------------------------------------------------------------- permissions, duplicates, mail failures

    @Test
    void withoutUpdatePermission_anExistingPasswordCannotBeChanged() {
        User user = existing("old@example.com", "HASH:before");
        grant("USER_CREATE");

        ImportResult result = run(row("old@example.com", "Hoa12345"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("permission"));
        assertEquals("HASH:before", user.getPasswordHash());
        assertTrue(mail.sent.isEmpty());
    }

    @Test
    void withoutCreatePermission_aNewAccountIsRejected() {
        grant("USER_UPDATE");

        ImportResult result = run(row("new@example.com", "Hoa12345"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("permission"));
    }

    @Test
    void theSameEmailTwiceInTheFile_failsTheSecondRowOnly() {
        ImportResult result = run(List.of(
                row("same@example.com", "Hoa12345"),
                row("SAME@example.com", "Hoa12345")));

        assertEquals(1, result.getSuccessCount());
        assertEquals(1, result.getFailureCount());
        assertEquals(3, result.getErrors().get(0).getRowNumber());
        assertTrue(result.getErrors().get(0).getMessage().contains("row 2"));
    }

    @Test
    void aMailFailure_doesNotUndoThePasswordChange_butIsReportedForThatRow() {
        User user = existing("old@example.com", "HASH:before");
        mail.failing = true;

        ImportResult result = run(row("old@example.com", "Hoa12345"));

        assertEquals(1, result.getSuccessCount());
        assertEquals(0, result.getFailureCount());
        assertEquals("HASH:Hoa12345", user.getPasswordHash());
        assertEquals(0, result.getEmailsSent());
        assertEquals(1, result.getEmailsFailed());
        assertTrue(result.getErrors().get(0).getMessage().contains("could not be sent"));
    }

    @Test
    void theNoticeCanBeSwitchedOff() throws Exception {
        User user = existing("old@example.com", "HASH:before");
        var flag = UserImportHandler.class.getDeclaredField("notifyPasswordChange");
        flag.setAccessible(true);
        flag.setBoolean(handler, false);

        ImportResult result = run(row("old@example.com", "Hoa12345"));

        assertEquals("HASH:Hoa12345", user.getPasswordHash());
        assertEquals(1, result.getUpdatedCount());
        assertTrue(mail.sent.isEmpty());
    }

    @Test
    void noMailEverContainsThePassword_andCreatingAccountsSendsNone() {
        run(List.of(
                row("a@example.com", "Hoa12345"),
                row("b@example.com", null)));
        existing("c@example.com", "HASH:before");
        run(row("c@example.com", "Hoa12345"));

        // The mail service has no method that accepts a password at all.
        for (var method : AccountMailService.class.getDeclaredMethods()) {
            if (method.getName().startsWith("send")) {
                assertEquals(1, method.getParameterCount(), method.getName());
                assertEquals(User.class, method.getParameterTypes()[0], method.getName());
            }
        }
        assertEquals(List.of("changed:c@example.com"), mail.sent); // only the existing owner is told
    }

    @Test
    void afterTheNoticeLimitOfAnImport_noMoreNoticesAreSent_butPasswordsAreStillUpdated() throws Exception {
        var limit = UserImportHandler.class.getDeclaredField("maxEmailsPerImport");
        limit.setAccessible(true);
        limit.setInt(handler, 2);

        User a = existing("a@example.com", "HASH:a");
        User b = existing("b@example.com", "HASH:b");
        User c = existing("c@example.com", "HASH:c");
        User d = existing("d@example.com", "HASH:d");

        ImportResult result = run(List.of(
                row("a@example.com", "Hoa12345"),
                row("b@example.com", "Hoa12345"),
                row("c@example.com", "Hoa12345"),
                row("d@example.com", "Hoa12345")));

        assertEquals(4, result.getUpdatedCount());
        assertEquals(2, result.getEmailsSent());
        assertEquals(2, result.getEmailsSkipped());
        assertEquals("HASH:Hoa12345", d.getPasswordHash());
        assertEquals("HASH:Hoa12345", a.getPasswordHash());
        assertEquals("HASH:Hoa12345", b.getPasswordHash());
        assertEquals("HASH:Hoa12345", c.getPasswordHash());
    }

    // ---------------------------------------------------------------- existing accounts: other columns

    private static Map<String, String> rowWith(String email, String column, String value) {
        Map<String, String> row = row(email, null);
        row.put(column, value);
        return row;
    }

    private static Set<Long> roleIds(User user) {
        return user.getRoles().stream().map(Role::getId).collect(Collectors.toSet());
    }

    private static Set<Long> departmentIds(User user) {
        return user.getDepartments().stream().map(Department::getId).collect(Collectors.toSet());
    }

    @Test
    void existingAccountWithoutPassword_butDifferentRole_isUpdated_counted_andNoEmail() {
        User user = existing("old@example.com", "HASH:before");

        ImportResult result = run(rowWith("old@example.com", "Roles", "TEACHER"));

        assertEquals(1, result.getUpdatedCount());
        assertEquals(1, result.getSuccessCount());
        assertEquals(0, result.getSkippedCount());
        assertEquals(Set.of(2L), roleIds(user)); // the file's list replaces the old one
        assertEquals("HASH:before", user.getPasswordHash()); // the password is untouched
        assertTrue(mail.sent.isEmpty());
        assertTrue(revokedSessions.isEmpty());
    }

    @Test
    void existingAccountWithDifferentDepartments_isUpdated_andTheSameFileAgainIsUnchanged() {
        User user = existing("old@example.com", "HASH:before");
        Map<String, String> row = rowWith("old@example.com", "Departments", "IT,HR");

        ImportResult first = run(row);

        assertEquals(1, first.getUpdatedCount());
        assertEquals(Set.of(10L, 11L), departmentIds(user));

        ImportResult second = run(rowWith("old@example.com", "Departments", "HR,IT"));

        assertEquals(0, second.getUpdatedCount());
        assertEquals(1, second.getSkippedCount());
    }

    @Test
    void existingAccountWithDifferentProfile_isUpdated() {
        User user = existing("old@example.com", "HASH:before");
        Map<String, String> row = row("old@example.com", null);
        row.put("First Name", "Changed");
        row.put("Last Name", "Name");
        row.put("Phone", "090 123 4567");
        row.put("Date of Birth", "2000-01-31");
        row.put("Gender", "Female");

        ImportResult result = run(row);

        assertEquals(1, result.getUpdatedCount());
        assertEquals("Changed", user.getFirstName());
        assertEquals("Name", user.getLastName());
        assertEquals("0901234567", user.getPhone());
        assertEquals(LocalDate.of(2000, 1, 31), user.getDateOfBirth());
        assertEquals(Gender.FEMALE, user.getGender());
    }

    @Test
    void existingAccountWithTheSameDateOfBirthAndGender_isUnchanged() {
        User user = existing("old@example.com", "HASH:before");
        user.setDateOfBirth(LocalDate.of(2000, 1, 31));
        user.setGender(Gender.MALE);
        Map<String, String> row = row("old@example.com", null);
        row.put("Date of Birth", "2000-01-31");
        row.put("Gender", "Male");

        ImportResult result = run(row);

        assertEquals(1, result.getSkippedCount());
        assertEquals(0, result.getUpdatedCount());
    }

    @Test
    void aBlankCell_keepsTheCurrentValue() {
        User user = existing("old@example.com", "HASH:before");
        user.setDateOfBirth(LocalDate.of(2000, 1, 31));
        user.setGender(Gender.MALE);
        Map<String, String> row = row("old@example.com", null);
        row.put("Date of Birth", "");
        row.put("Gender", " ");

        ImportResult result = run(row);

        assertEquals(1, result.getSkippedCount());
        assertEquals(LocalDate.of(2000, 1, 31), user.getDateOfBirth());
        assertEquals(Gender.MALE, user.getGender());
    }

    @Test
    void withoutUpdatePermission_aChangeToAnExistingAccountIsRejected() {
        User user = existing("old@example.com", "HASH:before");
        grant("USER_CREATE");

        ImportResult result = run(rowWith("old@example.com", "Roles", "TEACHER"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("permission"));
        assertEquals(Set.of(1L), roleIds(user));
    }

    @Test
    void anUnknownRole_rejectsTheRow_andChangesNothing() {
        User user = existing("old@example.com", "HASH:before");

        ImportResult result = run(rowWith("old@example.com", "Roles", "NOPE"));

        assertEquals(1, result.getFailureCount());
        assertEquals(0, result.getUpdatedCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("NOPE"));
        assertEquals(Set.of(1L), roleIds(user));
    }

    // ---------------------------------------------------------------- date of birth and gender

    @Test
    void dateOfBirthAndGender_areNormalisedForTheMapper() {
        Map<String, String> row = row("new@example.com", "Hoa12345");
        row.put("Date of Birth", "1999-03-05");
        row.put("Gender", "male");

        ImportResult result = run(row);

        assertEquals(1, result.getSuccessCount());
        assertEquals("1999-03-05", row.get("Date of Birth"));
        assertEquals("MALE", row.get("Gender"));
    }

    @Test
    void anIsoDateWithATimePart_isAccepted() {
        Map<String, String> row = row("new@example.com", "Hoa12345");
        row.put("Date of Birth", "1999-03-05T00:00");

        ImportResult result = run(row);

        assertEquals(1, result.getSuccessCount());
        assertEquals("1999-03-05", row.get("Date of Birth"));
    }

    @Test
    void anInvalidDateOfBirth_isRejectedOnItsRow() {
        ImportResult result = run(rowWith("new@example.com", "Date of Birth", "31-13-2000"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("Date of Birth"));
    }

    @Test
    void aDateOfBirthInTheFuture_isRejectedOnItsRow() {
        ImportResult result = run(rowWith("new@example.com", "Date of Birth",
                LocalDate.now().plusDays(1).toString()));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("future"));
    }

    @Test
    void anInvalidGender_isRejectedOnItsRow() {
        ImportResult result = run(rowWith("new@example.com", "Gender", "robot"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("Gender"));
    }

    @Test
    void aDayFirstDate_isRejected_theFormatIsYyyyMmDd() {
        ImportResult result = run(rowWith("new@example.com", "Date of Birth", "31/01/2000"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("yyyy-MM-dd"));
    }

    @Test
    void aVietnameseGenderName_isRejected_genderIsEnglish() {
        ImportResult result = run(rowWith("new@example.com", "Gender", "Nam"));

        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().get(0).getMessage().contains("Male, Female or Other"));
    }

    @Test
    void genderNames_areEnglishAndNotCaseSensitive() {
        Map<String, String> female = rowWith("a@example.com", "Gender", "FEMALE");
        Map<String, String> other = rowWith("b@example.com", "Gender", "other");

        ImportResult result = run(List.of(female, other));

        assertEquals(2, result.getSuccessCount());
        assertEquals("FEMALE", female.get("Gender"));
        assertEquals("OTHER", other.get("Gender"));
    }

    @Test
    void aLeapDay_isAcceptedOnlyInALeapYear() {
        Map<String, String> leap = rowWith("a@example.com", "Date of Birth", "2000-02-29");

        ImportResult accepted = run(leap);

        assertEquals(1, accepted.getSuccessCount());
        assertEquals("2000-02-29", leap.get("Date of Birth"));

        ImportResult rejected = run(rowWith("b@example.com", "Date of Birth", "2001-02-29"));

        assertEquals(1, rejected.getFailureCount());
    }

    @Test
    void datesThatDoNotExist_areRejected() {
        for (String date : List.of("2000-01-32", "2000-02-30", "2000-04-31", "2000-13-01", "1900-02-29")) {
            ImportResult result = run(rowWith("new@example.com", "Date of Birth", date));

            assertEquals(1, result.getFailureCount(), date);
            assertTrue(result.getErrors().get(0).getMessage().contains("yyyy-MM-dd"), date);
        }
    }

    // ---------------------------------------------------------------- date of birth and gender are required

    @Test
    void aNewAccountWithoutDateOfBirth_isRejected() {
        Map<String, String> row = row("new@example.com", "Hoa12345");
        row.remove("Date of Birth");

        ImportResult result = run(row);

        assertEquals(1, result.getFailureCount());
        assertEquals("Date of Birth is required", result.getErrors().get(0).getMessage());
    }

    @Test
    void aNewAccountWithABlankGender_isRejected() {
        ImportResult result = run(rowWith("new@example.com", "Gender", " "));

        assertEquals(1, result.getFailureCount());
        assertEquals("Gender is required", result.getErrors().get(0).getMessage());
    }

    @Test
    void anExistingAccount_mayLeaveBothColumnsOutOfTheFile_andKeepsItsValues() {
        User user = existing("old@example.com", "HASH:before");
        Map<String, String> row = row("old@example.com", null);
        row.remove("Date of Birth");
        row.remove("Gender");

        ImportResult result = run(row);

        assertEquals(1, result.getSkippedCount());
        assertEquals(0, result.getFailureCount());
        assertEquals(LocalDate.of(2000, 1, 31), user.getDateOfBirth());
        assertEquals(Gender.MALE, user.getGender());
    }

    @Test
    void aMonthAndDayWithoutTheLeadingZero_areAccepted_andNormalised() {
        Map<String, String> row = rowWith("new@example.com", "Date of Birth", "2000-1-5");

        ImportResult result = run(row);

        assertEquals(1, result.getSuccessCount());
        assertEquals("2000-01-05", row.get("Date of Birth"));
    }

    @Test
    void tooManyDigitsInTheMonthOrDay_areRejected() {
        ImportResult result = run(rowWith("new@example.com", "Date of Birth", "2000-001-5"));

        assertEquals(1, result.getFailureCount());
    }
}
