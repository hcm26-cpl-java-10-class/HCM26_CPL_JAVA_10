# SMTP health investigation — 2026-11-12

**BLOCKED: the SMTP password is empty.** The user confirmed no approved valid SMTP credential file is available and requested that deployment remain blocked. Backend 8080 was not restarted, no active or preserved main H2 database was migrated/reset/merged/overwritten, and no credentials were created or changed.

## Exact cause and running configuration

Read the actual `JavaMailSenderImpl`, Spring Environment, health registry and DataSource from the owned running JVM. The same diagnostic was first exercised on the isolated new JAR. No public `env`, `configprops`, H2 console or new diagnostic endpoint was enabled.

- Live PID: **24224**, unchanged; profile **preserved-old-rollback**.
- Workspace/working directory: `training-management/backend` in the nested project.
- Provider: **Gmail**.
- Host: **smtp.gmail.com**.
- Port: **587**, protocol smtp with **STARTTLS enabled**; this is not implicit SSL on port 465.
- Username: **npsdn1906@gmail.com**. This value comes directly from classpath `application.properties`, not a `MAIL_USERNAME` binding.
- Authentication: SMTP AUTH is enabled. The isolated actual transport selected **LOGIN**, not XOAUTH2. Mechanism selection is otherwise left to the mail provider defaults.
- Password: `spring.mail.password` resolves `MAIL_APP_PASSWORD`. That property is **defined but empty** in runtime system properties, in the reviewed archived dotenv and in the original `backend/.env`. `JavaMailSenderImpl.getPassword()` is blank on both the live old code and isolated new JAR.
- The process uses the pinned configuration snapshot `.run/td/final-precutover/2026-11-12/companion-backup/backend/.env`. Merely editing another `.env` will not change this already-running process or its pinned launch configuration.

The source and effective runtime mail settings match on both versions. The isolated probe observed the STARTTLS command, then LOGIN authentication rejection **535-5.7.8**. Gmail was reached and the failure occurred at authentication. The specific confirmed missing input is the SMTP password; there is no evidence that host or port is wrong. No provider-account login, App Password creation, token exchange or email delivery was attempted.

Gmail documents port 587 with STARTTLS and also supports SASL XOAUTH2: [Google SMTP protocol documentation](https://developers.google.com/workspace/gmail/imap/imap-smtp). For the existing password-based integration, the configuration owner must supply an approved App Password for the exact configured account, subject to Google account/organization policy; App Passwords require 2-Step Verification. OAuth2 would require an explicitly reviewed SMTP integration, not reuse of a web Google client secret as a password: [Google App Password guidance](https://support.google.com/accounts/answer/185833?hl=en).

## Which health check fails

The actual contributor is **`org.springframework.boot.actuate.mail.MailHealthIndicator`**, named **mail**. Both existing configurations include mail and db in aggregate `/actuator/health`. Neither baseline currently defines separate readiness/liveness health groups. Therefore the observed 503 is **aggregate health DOWN**, not an existing separately configured readiness endpoint failing.

The isolated actual MailHealthIndicator returned **DOWN**, with 535 authentication rejection, while the actual DataSource indicator returned **UP**. A final live `/actuator/health` request still returned **503/DOWN**. No status mapping, disabled mail indicator or fabricated UP result was used.

Spring Boot supports separate health groups and advises making an explicit dependency decision for external services in readiness: [Spring Boot 3.3 health groups and probes](https://docs.spring.io/spring-boot/3.3/reference/actuator/endpoints.html).

## Is SMTP optional?

It is **not a direct dependency of Trainer/Class CRUD**: no mail sender or email service reference was found in those source packages. However, it is required by application workflows:

- `AuthServiceImpl.register` creates an inactive account and calls `VerificationServiceImpl.sendEmailVerification`.
- `VerificationServiceImpl.sendForgotPassword` creates the password-reset token/link and sends it through `MailUtil`; there is no alternate delivery path in that flow.
- `MailUtil.buildAndSendMail` calls the real JavaMailSender. Failures prevent the intended account email from being delivered.
- Notification `EmailService` catches send failures and logs them, so some notification flows can continue with lost notifications.
- `ExamResultEmailService` records delivery status FAILED and attempt/error information when the real sender fails. Core result persistence and mail delivery are distinct concerns.

Consequently, the full system cannot safely be declared ready merely because Trainer APIs work. **Keep SMTP in full-application readiness until the business owner explicitly approves a reduced scope.** The user has not approved treating account verification/password recovery as unavailable optional features.

If a future approved deployment explicitly serves only features that tolerate unavailable email, a separate core readiness group could include readinessState/db, while aggregate health and a dedicated SMTP group remain DOWN. That requires visible degraded-service handling and an external monitor alerting on the SMTP group. This alternative was not applied or represented as full-system readiness.

## Proposed safe health configuration

Prepared [smtp-required-health.properties](smtp-required-health.properties) as a **reviewable proposal**, not an automatically active profile. It is not under application resources and was not loaded by Backend 8080.

It keeps mail enabled and defines:

- liveness: livenessState only; SMTP failure must not trigger a process restart loop.
- readiness: readinessState, db, mail; SMTP authentication failure remains **503/DOWN**.
- smtp: mail only, for separate dependency monitoring; failure remains **503/DOWN**.
- Hidden health details/components, SMTP connect/read/write timeouts of 5 seconds, required STARTTLS and server identity verification.
- HTTP request/response body processor loggers at INFO, so DEBUG authentication body serialization does not reveal credentials during preflight. SMTP health warnings are retained.

Current SecurityConfig allows the exact aggregate `/actuator/health` path publicly, but health subpaths require authentication. The isolated test confirmed readiness without a token returns **401**. Authenticated readiness/smtp/liveness checks work. No RBAC change was made. A future infrastructure probe must use an approved monitor authentication method or a separately reviewed endpoint exposure policy; do not assume these subpaths are public or reuse an end-user token as a permanent monitor credential.

The SMTP endpoint is prepared for monitoring; **no external alert receiver/rule has been installed** by this task. Before activation, the operations owner must route non-200 SMTP health to an existing monitoring channel without depending on the broken SMTP service itself.

## Test results

Tests used Java 21, the unchanged approved JAR and Spring Boot 3.3.3. The new application ran only on **127.0.0.1:18082**, against a fresh restore inside `.run/td/smtp-health-2026-11-12/trial-db`. Only the three previously reviewed schema scripts were applied to that isolated restore. No Trainer data was seeded. Both isolated application processes were stopped through normal JVM/Spring shutdown hooks and Hikari shutdown completed.

- New JAR startup with safe-deployment and **ddl-auto=validate: PASS** before and after the health proposal.
- Actual SMTP probe: **STARTTLS observed, AUTH LOGIN, 535-5.7.8, Mail DOWN; DB UP**. The probe used the same configured empty credential, not a fabricated replacement. It invoked the connection/authentication health check only; **0 email messages sent**.
- **13 policy assertions PASS**, using real Boot health grouping/HTTP status mapping and simulated provider availability. Cases include missing SMTP, failed DB, healthy dependencies, refusing traffic, broken liveness, and disabled DEBUG authentication-body logging. Simulated UP cases do not demonstrate real Gmail success.
- **10 actual HTTP checks PASS** on the isolated packaged backend: aggregate 503/DOWN, unauthenticated readiness 401, authenticated readiness 503/DOWN, SMTP 503/DOWN, liveness 200/UP, existing Class/Program/User reads and Trainer INTERNAL provenance.
- Existing isolated data remained 8 Classes, 3 Programs, 247 Users, 6 Roles. Offline full-table verification after clean shutdown found only the expected refresh-token change from isolated sign-in, relative to the post-migration trial baseline.
- An initial test-only harness omitted explicit availability indicator registration; it was corrected without disabling group-membership validation. The first HTTP assertion was also corrected to allow Boot's public group-name list while still forbidding health details/components. These were verification-tool corrections, not production failures or source-module changes.

During the isolated HTTP test, existing DEBUG request-body logging wrote one test-account password to a local test log. It was not displayed in tool output; the value has been redacted in that test-owned log. The proposal now disables the two body serializer DEBUG loggers, verified by two of the 13 assertions. No SMTP password or JWT was retained in the audit reports; SMTP tracing retained only mechanism, STARTTLS flag and SMTP error code. Backend 8080 logging was not changed.

## Actual databases and new-write risk

The live DataSource metadata, not a default property file, identifies:

`jdbc:h2:file:<workspace>/training-management/data/recovery/2026-11-12-1046/fams_lms_after_merge`

All 177 tables were fingerprinted using SELECT statements on the running app's own DataSource, within a read-only SERIALIZABLE transaction followed by rollback. No H2 file was copied while open. The latest comparison still shows:

- **8 Classes, 3 Programs, 247 Users, 6 Roles**.
- **Only REFRESH_TOKEN differs** from the verified restored baseline; no business-table, user, role, membership, grant or menu differences were found.
- The preserved migrated main file `training-management/data/fams_lms_after_merge.mv.db` is not the active DataSource. Its SHA remains `705dfe552d1ba821629e4941803957c0098ee0ad9a013a0134d4c07a3cca4aa2`, identical to the post-rollback preservation record.

The active recovery DB can still receive future writes through the running application. The audit proves its state at the snapshot time, not that no later writes are possible. **Treat the recovery DB as the source of truth.** Do not merge or overwrite it with the old migrated file. The previous cold backup remains a historical rollback point and must not replace a fresh backup for a later cutover.

## Safe repair and redeployment conditions

1. Configuration owner supplies an approved valid SMTP credential through a private environment file for the configured Gmail account; do not paste secrets into chat. The user confirmed none is currently available, so this remains blocked.
2. Preserve the old pinned snapshot. Create/review a new configuration snapshot for isolated verification; do not overwrite recovery evidence. Check only presence/binding in reports.
3. Re-test actual SMTP authentication on the isolated backend with required TLS and bounded timeouts. Require Mail UP, DB UP and full readiness UP. Separately verify message delivery with an approved recipient/content when authorized; the health check does not prove deliverability.
4. Plan a controlled write freeze and take a consistent fresh backup of the **active recovery DB**, using the active H2 engine's supported backup facility or an explicitly approved closed-database window. Restore and fingerprint every table. No such main-DB backup/migration/restart was performed in this task.
5. Rehearse the three Trainer schema/catalog scripts and the exact approved menu/ADMIN READ/CREATE/UPDATE grants on that fresh restore, preserving all newer recovery data and keeping DELETE ungranted.
6. Obtain a deployment window that explicitly permits the currently forbidden 8080 restart. Reuse the safe-deployment/validate safeguards, but point at the reviewed source derived from the active recovery DB, not blindly at the historical preserved migrated file.

**Not ready to redeploy.** Missing credentials are the remaining SMTP blocker; the proposed health policy deliberately preserves that failure instead of hiding it.

## Files and evidence

Repository additions are this report and `smtp-required-health.properties`. Only documentation/proposed configuration was changed; Trainer, Class, Auth, Session, Program, RBAC and application source/resources were not edited. No Git write was performed.

Workspace-root `.run/td/smtp-health-2026-11-12/smtp-health-proof.json` aggregates sanitized source/runtime configuration, observed provider/authentication, database fingerprints, isolated process manifests, actual SMTP result, policy and HTTP test reports, clean shutdown and log-redaction results. Private dotenv contents and credential values are not included. The test policy's health settings were verified over HTTP; the later added logger settings were verified by the 13-assertion harness and were not applied to 8080.
