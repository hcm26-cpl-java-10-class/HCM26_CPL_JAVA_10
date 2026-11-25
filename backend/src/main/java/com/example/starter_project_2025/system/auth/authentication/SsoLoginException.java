package com.example.starter_project_2025.system.auth.authentication;

import lombok.Getter;

/**
 * Single sign-in (Google) was refused. {@link #getCode()} is sent to the login page as ?error=CODE so
 * the user sees why, instead of a generic failure.
 */
@Getter
public class SsoLoginException extends RuntimeException {

    public static final String AUTH_FAILED = "google_auth_failed";
    public static final String EMAIL_UNVERIFIED = "google_email_unverified";
    public static final String DOMAIN_NOT_ALLOWED = "google_domain_not_allowed";
    public static final String NOT_REGISTERED = "google_not_registered";
    public static final String ACCOUNT_DISABLED = "google_account_disabled";
    public static final String ACCOUNT_LOCKED = "google_account_locked";

    private final String code;

    public SsoLoginException(String code, String message) {
        super(message);
        this.code = code;
    }
}
