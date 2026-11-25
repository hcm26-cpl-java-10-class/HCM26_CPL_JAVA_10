# Trainer cutover rollback plan

> Execution update, 2026-11-12: the user approved this plan and rollback was executed after SMTP health failed. The guarded old runtime is on 8080 with a separate restored recovery database and schema action none. See [deployment result](DEPLOYMENT_RESULT_2026-11-12.md) for actual checks, paths and remaining health blocker. The original text below records the plan as prepared before approval.

Prepared and rehearsed on 2026-11-12. **No execution at port 8080 is approved.** The default old application launch is unsafe for preservation: its initializer/scheduler gates do not exist. Use the reviewed recovery package, not an unqualified Maven/old-main startup.

## Preserved material

- Latest verified H2 cold archive and its SHA: see [FINAL_PRE_CUTOVER.md](FINAL_PRE_CUTOVER.md).
- Old class/resource archive: workspace-root `.run/td/backups/old-target-classes.zip`; SHA `bd565f37bfbca35efd067b9ff7ffac94d17ffd6e2365383011f52083e2f3201d`. The 2,226 files were verified against the previously running old binary and extracted to `rollback-old-classes`.
- Recovery package: `.run/td/final-precutover/recovery-package`. It contains the compiled startup guard and copies of all 142 original dependencies, with per-file hashes and exact original classpath order in `dependencies.json`.
- Source launcher: `.run/td/final-precutover/SafeOldRollbackBoot.java`; explicit startup inventory: `rollback-startup-allowlist.txt`. Package source/class/argument hashes are recorded in `recovery-package/manifest.json`.
- Original reviewed dotenv snapshot: `.run/td/final-precutover/2026-11-12/companion-backup/backend/.env`, with its hash in the companion manifest. Keep its contents local; no secret values are included in the report.

Keep these directories and manifests intact. The classes ZIP alone is not an executable Boot JAR. The argument file preserves dependency order and avoids Windows command-line length limits.

## What was tested

The original archive's `ddl-auto=validate` fails at the old VARCHAR/CLOB mapping. The recovery path deliberately uses `ddl-auto=none`, `generate-ddl=false` and SQL init=never, with an external guard that suppresses the explicit reviewed startup-only components, legacy pre-Hibernate factory and scheduler processor. Unknown application lifecycle callbacks fail closed. Three required filters inheriting GenericFilterBean were inspected and retained; they do not override its initialization hooks to write data.

The guarded old binary starts on loopback 18081, preserves security, and returns the original eight Classes, three Programs and 247 Users. Existing operation/topic JSON is readable. The new Trainer API is absent, as expected for the old feature set. No permission grant or menu insertion occurs. Authentication changes only the copied refresh-token table. Full original-table fingerprints after shutdown match the source backup except that expected token rotation.

All 142 original dependency bytes are preserved, including DevTools; JVM property `spring.devtools.restart.enabled=false` prevents automatic restart. The old services/job beans remain available, while automatic scheduling stays paused for maintenance verification.

## Recovery sequence after explicit approval

1. **Keep writes frozen.** Stop the approved new backend gracefully and confirm its Hikari/EntityManagerFactory closed. Preserve the failed migrated database and logs for diagnosis. Do not replace or reset it.
2. Verify the fresh pre-cutover ZIP checksum. Restore into a new empty `.run/td/recovery-check/<timestamp>` location with H2 2.2.224; do not overwrite a prior restore. Open it with IFEXISTS and ACCESS_MODE_DATA=r, then compare all 177 original table fingerprints/counts with the pre-cutover manifest.
3. After closing that verification connection, copy the verified cold restored file into a new `training-management/data/recovery/<timestamp>/fams_lms_after_merge.mv.db`. Compare source/target file SHA. Never copy an open H2 file or overwrite the failed original DB.
4. Verify recovery-package class/JAR/allowlist hashes. Copy `approved-recovery.args.template` to a new reviewed argument file. Replace only the recovery database base path and original dotenv placeholders; use absolute paths with Java argument-file quoting. The database base path has no `.mv.db` suffix.
5. From `training-management/backend`, the approved recovery invocation is `D:/jdk21/bin/java.exe @<absolute-reviewed-recovery-argument-file>`. The argument file pins verification.workspaceRoot separately so the original backend working directory and relative storage paths are retained. The prepared template sets port 8080, schema action none, DevTools restart disabled and the exact old classpath. **This command has not been executed.** The launcher refuses the original failed DB path, missing restore/config, wrong production working directory or an occupied port. Production mode uses the original configuration/dependencies rather than isolated localhost:1 test settings and does not expose the trial shutdown endpoint.
6. Keep maintenance active while confirming old Class/Program/User access, old Master Trainer strings, source sample status and unmodified role grants. The new Trainer feature is unavailable under the old binary. Reopen writes only after recovery acceptance; automatic jobs remain paused until their pending work and resumption are reviewed.

## Validity window

This is a point-in-time rollback while user writes remain frozen. After writes reopen, restoring the old snapshot would discard newer edits or real Trainer records. Do not perform that restore automatically: reconcile/export newer data or choose a reviewed forward repair first.

The port/path/config production branch is prepared and reviewed but cannot be executed during this preflight because the user explicitly forbids starting/restarting Backend 8080. The common guard, archived runtime, dependency set and data-preservation behavior were exercised on 18081. Cutover approval must include acceptance of this recovery plan and the old runtime's explicit schema-none setting.
