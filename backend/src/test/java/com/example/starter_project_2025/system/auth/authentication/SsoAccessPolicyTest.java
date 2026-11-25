package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Rules for who may sign in with Google. */
class SsoAccessPolicyTest {

    private static String codeOf(Runnable action) {
        return assertThrows(SsoLoginException.class, action::run).getCode();
    }

    @Test
    void unverifiedEmailIsRefused() {
        SsoAccessPolicy policy = new SsoAccessPolicy("", false);

        assertEquals(SsoLoginException.EMAIL_UNVERIFIED,
                codeOf(() -> policy.checkEmail("a@school.edu", false)));
        assertDoesNotThrow(() -> policy.checkEmail("a@school.edu", true));
    }

    @Test
    void noDomainListMeansAnyDomain() {
        SsoAccessPolicy policy = new SsoAccessPolicy("", false);

        assertDoesNotThrow(() -> policy.checkEmail("a@gmail.com", true));
    }

    @Test
    void onlyListedDomainsAreAccepted_ignoringCaseSpacesAndAtSign() {
        SsoAccessPolicy policy = new SsoAccessPolicy(" @School.edu , company.com ", false);

        assertDoesNotThrow(() -> policy.checkEmail("a@school.edu", true));
        assertDoesNotThrow(() -> policy.checkEmail("B@COMPANY.COM", true));
        assertEquals(SsoLoginException.DOMAIN_NOT_ALLOWED,
                codeOf(() -> policy.checkEmail("a@gmail.com", true)));
    }

    @Test
    void unknownEmailsAreNotCreatedUnlessSwitchedOn() {
        assertFalse(new SsoAccessPolicy("", false).autoCreateUsers());
        assertTrue(new SsoAccessPolicy("", true).autoCreateUsers());
        assertEquals(SsoLoginException.NOT_REGISTERED,
                new SsoAccessPolicy("", false).notRegistered("a@school.edu").getCode());
    }

    @Test
    void lockedAndInactiveAccountsCannotSignIn() {
        SsoAccessPolicy policy = new SsoAccessPolicy("", false);

        User locked = new User();
        locked.setIsActive(true);
        locked.setLocked(true);
        assertEquals(SsoLoginException.ACCOUNT_LOCKED, codeOf(() -> policy.checkAccount(locked)));

        User inactive = new User();
        inactive.setIsActive(false);
        inactive.setLocked(false);
        assertEquals(SsoLoginException.ACCOUNT_DISABLED, codeOf(() -> policy.checkAccount(inactive)));

        User fine = new User();
        fine.setIsActive(true);
        fine.setLocked(false);
        assertDoesNotThrow(() -> policy.checkAccount(fine));
    }
}
