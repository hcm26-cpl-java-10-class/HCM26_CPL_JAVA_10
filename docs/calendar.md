# Class calendar

The Class Details Calendar tab uses `/api/classes/{classId}/calendars`, backed by the same internal class database as Class List. It does not use the external master class IDs or substitute sample calendars on errors.

- Every class automatically has a Live calendar, even without sessions or saved versions. Its planned date range, program, trainer and location come directly from Class Info; users do not need to create a calendar. Changes to Class Info appear on the next calendar fetch.
- Saved drafts live in `training_calendars`. Metadata edits and new versions are persisted; every read, update, version creation, and export is scoped to the class ID. Class Start Date comes from Class Info. Topic and lesson ranges are validated on the server.
- **Live** (ID `0`) is a read-only view of the class plan, or current active, non-cancelled sessions when those exist. Session rescheduling, completion, cancellation, and deletion are reflected on refetch. Adjusting Live creates a separate draft; a draft does not change session times or mark calendar readiness as ready.
- Detailed Excel exports use the same internal calendar data. Missing trainer/material information stays blank.
- API errors are shown with retry; they never produce a sample schedule.

Restart the backend after updating. With the project's MySQL setup, keep `SPRING_JPA_HIBERNATE_DDL_AUTO=update` to create the new table and preserve data. H2 in-memory with `create-drop` still loses all data on restart.

Calendar API access requires `CLASS_READ` plus `SESSION_READ` for reads/exports or `SESSION_UPDATE` for writes.

For an existing MySQL `training_calendars` table that has `last_modified_date` and `topics_json` but lacks `created_at` / `updated_at`, run `backend/calendar-schema-upgrade.sql` once before restarting. It adds the audit columns and preserves their historical timestamps. The entity retains the original required columns, and the reader supports existing rows whose `schedule` is empty.
