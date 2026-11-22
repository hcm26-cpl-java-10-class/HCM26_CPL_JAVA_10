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

    /**
     * SY-04: retries of a webhook event after its first failed run (backoff 1m, 5m, 15m, 1h, 6h);
     * once used up the event becomes FAILED. 5 retries = up to 6 runs.
     */
    private int webhookMaxRetries = 5;

    /** SY-04: a RECEIVED event is left to the fast path for this long before the fallback scheduler takes it. */
    private long webhookReceivedGraceSeconds = 10;

    /** SY-04: threads and queue of the {@code gitWebhookTaskExecutor} (tasks beyond the queue are discarded). */
    private int webhookWorkerCore = 2;

    private int webhookWorkerMax = 4;

    private int webhookQueueCapacity = 200;

    /** SY-04: safety cap on GitHub pages (100 commits each) read to complete one truncated push. */
    private int pushMaxApiPages = 50;

    /**
     * SY-03: days the raw payload of a finished webhook event is kept before it is purged
     * (the event row stays). 15 days for the H2 + mock-project setup (decided 16/11/2026).
     */
    private int webhookPayloadRetentionDays = 15;

    /** SY-03: a PROCESSING event older than this is considered abandoned and is queued again. */
    private long webhookStuckAfterMinutes = 10;

    /** SY-03: process an event right after it is stored (tests turn this off). */
    private boolean webhookDispatchEnabled = true;

    /** SY-03: background poller for due/abandoned events (tests turn this off). */
    private boolean webhookPollerEnabled = true;

    /** SY-01: GraphQL endpoint; NULL = {@code {api-base-url}/graphql} (GitHub Enterprise Server uses {@code /api/graphql}). */
    private String graphqlUrl;

    /** SY-01: commits per GraphQL history page (GitHub allows at most 100). */
    private int syncCommitPageSize = 100;

    /** SY-02: pull requests per GraphQL page, and submitted reviews read with each of them. */
    private int syncPullRequestPageSize = 50;

    private int syncReviewPageSize = 50;

    /** SY-01: commit (SY-02: and pull request) pages one run of a job imports before it yields the worker. */
    private int syncMaxPagesPerRun = 50;

    /** SY-01: below this many GraphQL points left, a job stops after the current page and resumes at reset. */
    private int syncRateLimitReserve = 100;

    /** SY-01: "Sync now" right after a successful sync returns that sync instead of queuing another one. */
    private long syncManualCooldownSeconds = 60;

    /** SY-01: periodic reconcile of every active repository (tests turn this off). */
    private boolean syncReconcileEnabled = true;

    /** SY-01: a reconcile reads commits from this long before the last complete history import. */
    private java.time.Duration syncReconcileOverlap = java.time.Duration.ofDays(1);

    /** SY-01: repositories synchronized successfully this recently are skipped by the reconcile. */
    private long syncReconcileSkipRecentMinutes = 60;

    /** SY-01: reconcile jobs are spread over this many minutes so they do not all call GitHub at once. */
    private int syncReconcileSpreadMinutes = 60;

    private int connectTimeoutMillis = 5000;

    private int readTimeoutMillis = 10000;

    /** SY-03: webhooks are accepted only when the integration is on and a secret is configured (fail closed). */
    public boolean webhooksEnabled() {
        return enabled && StringUtils.hasText(webhookSecret);
    }

    /**
     * GI-06: GitHub App user authorization (no {@code scope}: a GitHub App user token only
     * holds the App's permissions, and GET /user needs none). Returns to {@link #callbackUrl}.
     */
    public String authorizeUrl(String state) {
        return org.springframework.web.util.UriComponentsBuilder
                .fromHttpUrl(trimTrailingSlash(webBaseUrl) + "/login/oauth/authorize")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", callbackUrl)
                .queryParam("state", state)
                .encode()
                .build()
                .toUriString();
    }

    public String resolvedGraphqlUrl() {
        return StringUtils.hasText(graphqlUrl) ? graphqlUrl : trimTrailingSlash(apiBaseUrl) + "/graphql";
    }

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
        if (webhookPayloadRetentionDays < 1) {
            missing.add("app.github.webhook-payload-retention-days must be at least 1");
        }
        if (webhookMaxRetries < 0) {
            missing.add("app.github.webhook-max-retries must not be negative");
        }
        if (webhookWorkerCore < 1 || webhookWorkerMax < webhookWorkerCore || webhookQueueCapacity < 1) {
            missing.add("app.github.webhook-worker-core/-max/queue-capacity must be positive and max >= core");
        }
        if (syncCommitPageSize < 1 || syncCommitPageSize > 100) {
            missing.add("app.github.sync-commit-page-size must be between 1 and 100");
        }
        if (syncPullRequestPageSize < 1 || syncPullRequestPageSize > 100 || syncReviewPageSize < 1 || syncReviewPageSize > 100) {
            missing.add("app.github.sync-pull-request-page-size / sync-review-page-size must be between 1 and 100");
        }
        if (syncMaxPagesPerRun < 1) {
            missing.add("app.github.sync-max-pages-per-run must be at least 1");
        }
        if (pushMaxApiPages < 1) {
            missing.add("app.github.push-max-api-pages must be at least 1");
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
