package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDateTime;

/**
 * GI-06: result of "Connect GitHub account". CONNECTED: the account is mapped in the master
 * project ({@code account} set). AUTHORIZE_REQUIRED: send the browser to {@code authorizeUrl}.
 */
public record GitAccountConnectResponse(
        Outcome outcome,
        String authorizeUrl,
        LocalDateTime expiresAt,
        GitAccountView account,
        GitLinkDetails.ProjectSummary master,
        String message) {

    public enum Outcome { CONNECTED, AUTHORIZE_REQUIRED }

    /** A verified GitHub account; {@code login} is for display, the id is the identity. */
    public record GitAccountView(Long githubUserId, String login, String avatarUrl) {
    }

    @Override
    public String toString() {
        return "GitAccountConnectResponse[outcome=" + outcome + ", master=" + (master == null ? null : master.id()) + "]";
    }
}
