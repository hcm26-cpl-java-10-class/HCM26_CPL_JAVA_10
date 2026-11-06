package com.example.starter_project_2025.system.exam.audit;

/**
 * Các hành động được ghi lại vào nhật ký lời mời.
 */
public enum InvitationAuditAction {
    CREATE,
    BATCH_CREATE,
    RESEND,
    REVOKE,
    EXPIRE,
    DELETE
}
