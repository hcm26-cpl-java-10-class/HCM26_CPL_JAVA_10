package com.example.starter_project_2025.system.audit;

/**
 * All action names written to the audit log.
 */
public final class AuditAction {

    private AuditAction() {
    }

    // generic CRUD (written automatically by AuditLogAspect)
    public static final String CREATE = "CREATE";
    public static final String UPDATE = "UPDATE";
    public static final String DELETE = "DELETE";

    // authentication
    public static final String LOGIN = "LOGIN";
    public static final String LOGOUT = "LOGOUT";
    public static final String REGISTER = "REGISTER";
    public static final String VERIFY_EMAIL = "VERIFY_EMAIL";
    public static final String FORGOT_PASSWORD = "FORGOT_PASSWORD";
    public static final String RESET_PASSWORD = "RESET_PASSWORD";

    // data in / out
    public static final String IMPORT = "IMPORT";
    public static final String EXPORT = "EXPORT";

    // exam / session
    public static final String ADD_QUESTION = "ADD_QUESTION";
    public static final String REMOVE_QUESTION = "REMOVE_QUESTION";
    public static final String CANCEL = "CANCEL";

    // invitation
    public static final String INVITE = "INVITE";
    public static final String BATCH_INVITE = "BATCH_INVITE";
    public static final String RESEND = "RESEND";
    public static final String REVOKE = "REVOKE";
}
