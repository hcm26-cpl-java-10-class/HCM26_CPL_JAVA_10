package com.example.starter_project_2025.system.git_integration.config;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * GitHub App settings bound from {@code app.github.*}.
 * <p>
 * Secrets (client secret, webhook secret, private key) come from environment
 * variables or a key file outside the repository. They are excluded from
 * {@link #toString()} so they never reach logs.
 */
@Getter
@Setter
@ToString
@ConfigurationProperties(prefix = "app.github")
public class GitHubAppProperties {

    /** Feature switch. Disabled by default so local startup works without a GitHub App. */
    private boolean enabled = false;

    /** Numeric App ID shown on the GitHub App settings page; used as JWT issuer. */
    private String appId;

    /** App slug, used to build https://github.com/apps/{slug}/installations/new. */
    private String appSlug;

    /** OAuth client ID of the GitHub App (user-to-server authorization). */
    private String clientId;

    @ToString.Exclude
    private String clientSecret;

    /** Path to the downloaded .pem private key. Preferred over {@link #privateKey}. */
    private String privateKeyPath;

    /** Inline PEM content (literal "\n" allowed) for environments without a key file. */
    @ToString.Exclude
    private String privateKey;

    @ToString.Exclude
    private String webhookSecret;

    /**
     * Frontend route GitHub redirects to after installation + user authorization.
     * Must exactly match the "Callback URL" registered in the GitHub App settings,
     * and is sent as redirect_uri when exchanging the OAuth code on the backend.
     */
    private String callbackUrl;

    private String apiBaseUrl = "https://api.github.com";

    private String webBaseUrl = "https://github.com";

    private String apiVersion = "2022-11-28";

    /** Lifetime of the anti-CSRF state issued when the user clicks Connect GitHub. */
    private long stateTtlSeconds = 600;

    /** GitHub caps App JWTs at 10 minutes; keep a margin for clock drift. */
    private long jwtTtlSeconds = 540;

    /** GI-03: how long the repository list of an installation is cached in memory. */
    private long repositoryCacheTtlSeconds = 300;

    /** GI-03: safety cap on GitHub pages (100 repositories each) fetched per installation. */
    private int repositoryMaxPages = 10;

    /** GI-04: attempts per synchronization job before it is marked FAILED. */
    private int syncMaxAttempts = 3;

    /** GI-04: a RUNNING job older than this is considered abandoned and is queued again. */
    private long syncStuckAfterMinutes = 10;

    /** GI-04: safety cap on branch pages (100 each) read by a synchronization. */
    private int syncMaxBranchPages = 10;

    /** GI-04: run a job right after the transaction that queued it commits (tests turn this off). */
    private boolean syncDispatchEnabled = true;

    /** GI-04: background poller for due/abandoned jobs (tests turn this off). */
    private boolean syncPollerEnabled = true;

    private int connectTimeoutMillis = 5000;

    private int readTimeoutMillis = 10000;

    public String installUrl() {
        return trimTrailingSlash(webBaseUrl) + "/apps/" + appSlug + "/installations/new";
    }

    /** Names of required settings that are missing while the integration is enabled. */
    public List<String> missingRequiredSettings() {
        List<String> missing = new ArrayList<>();
        if (!enabled) {
            return missing;
        }
        requireText(missing, appId, "app.github.app-id (GITHUB_APP_ID)");
        requireText(missing, appSlug, "app.github.app-slug (GITHUB_APP_SLUG)");
        requireText(missing, clientId, "app.github.client-id (GITHUB_APP_CLIENT_ID)");
        requireText(missing, clientSecret, "app.github.client-secret (GITHUB_APP_CLIENT_SECRET)");
        requireText(missing, callbackUrl, "app.github.callback-url (GITHUB_APP_CALLBACK_URL)");
        if (!StringUtils.hasText(privateKeyPath) && !StringUtils.hasText(privateKey)) {
            missing.add("app.github.private-key-path (GITHUB_APP_PRIVATE_KEY_PATH) "
                    + "or app.github.private-key (GITHUB_APP_PRIVATE_KEY)");
        }
        if (stateTtlSeconds <= 0) {
            missing.add("app.github.state-ttl-seconds must be positive");
        }
        if (jwtTtlSeconds <= 0 || jwtTtlSeconds > 600) {
            missing.add("app.github.jwt-ttl-seconds must be between 1 and 600");
        }
        return missing;
    }

    private static void requireText(List<String> missing, String value, String name) {
        if (!StringUtils.hasText(value)) {
            missing.add(name);
        }
    }

    private static String trimTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
