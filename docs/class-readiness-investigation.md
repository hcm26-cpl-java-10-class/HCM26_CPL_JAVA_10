# Class Readiness — HCM26_CA_JAVA_01

> Historical snapshot before Class Setup implementation. Class Setup is now implemented; use [CLASS_SETUP_IMPLEMENTATION.md](CLASS_SETUP_IMPLEMENTATION.md) and [the current routing/runtime report](FRONTEND_ROUTING_404_FIX_REPORT.md). Statements below about missing Setup forms/APIs describe the earlier investigation, not the current source or later live backend.

Investigation date: 09/11/2026, Asia/Saigon. Sources: the running application on port 8080, authenticated GET requests, source inspection, and SELECT-only queries through the running application's H2 console. No live records were created or updated and no Git write operation was used.

## Verified current data

- Internal class ID: **6**. Profile: `GET http://localhost:8080/api/classes/6`.
- Readiness: `GET /api/classes/6/readiness`.
- Database: `jdbc:h2:mem:base_crud`; `training_classes.id=6` has code/name `HCM26_CA_JAVA_01`, status `planning`, program `FR_NFP_DOTNET`, skills `Java`, site `HCM (TP. Hồ Chí Minh)`, master trainer `NgaTTT45`, delivery type `Class`, format type `Offline`, location `Center Building, HCM`, planned size `20`, dates `2026-12-09`–`2027-03-09`.
- `class_training_programs`, `teaching_assignments`, `class_enrollments`, `sessions`, and `training_calendars` each have **zero rows with class_id=6**. Missing links are not evidence of links to a different class.
- `/api/classes/6/calendars` returns a computed Live overview with `classId=6` and `id=0`, derived from the saved class dates. It is not a persisted session or a teaching schedule. Readiness correctly stays NOT_READY with zero sessions.
- The current shared class directory returns IDs 2–4 with other codes. This class is internal; its calendar must use `/api/classes/6/calendars` and `/api/sessions?classId=6`, not `/api/external/classes/6/...`.

## Location and Room API

`GET /api/external/rooms` succeeds with HTTP 200. It calls `http://localhost:9090/api/rooms`. However, port 9090 is the existing `mock-server.js` process started during local setup, **not a verified real room service**.

That fixture returns `Center Building Room 101` (ID 1, capacity 30) and `Center Building Room 102` (ID 2, capacity 25). Neither name exactly matches saved Location `Center Building, HCM`. Both fixture capacities are numerically >= 20, but neither proves that a real room exists or is suitable. Do not copy these fixture names into the class merely to make readiness green.

**BLOCKED: verification against the real room directory.** Obtain the actual upstream API URL and credentials, configure `EXTERNAL_API_BASE_URL`/`EXTERNAL_API_TOKEN`, then check its `/api/rooms` response. If that service is unreachable, returns an error or only sample data, room identity/capacity remains unverified. No room is fabricated or substituted.

The previous `/api/external/data-source` value `sampleData=false` only distinguished the local fallback implementation; it did not recognize an HTTP server serving fixtures. The change adds support for `X-Data-Source: sample` response metadata and `EXTERNAL_API_SAMPLE_DATA=true` for known sample upstreams. The existing mock server now labels its responses. This reports provenance; it does not create new data. A successful HTTP response alone cannot establish that an unmarked upstream is authoritative.

## Code changes

- Readiness gives the saved Location, match count, room ID/capacity and planned capacity where applicable; distinguishes missing, ambiguous, undersized and unverifiable rooms.
- Failed or sample directory checks return BLOCKED. BLOCKED and UNKNOWN remain outside the verified-check denominator; neither becomes READY.
- `Blended` uses the same physical-room validation as `Hybrid`/`Offline`, matching the existing form option. Relative/non-HTTP Online locations return NOT_READY instead of causing a null-scheme exception.
- Trainer readiness also verifies that the assigned active trainer matches saved Master Trainer, and rejects inactive linked programs.
- Missing program links and MAIN assignments explain the internal class ID, date coverage and required next steps.
- The panel explains each non-ready result, shows BLOCKED separately, and identifies the internal class. Class Info exposes Delivery Type, accepts the real Program code/name, and no longer substitutes a building for an empty Location.
- Calendar provides a Manage Sessions link using the internal class ID. Calendar overviews and draft versions are explicitly described as insufficient session evidence.

## What to enter in each form

1. **Class Info** (`/classes/6?tab=info` → Edit Class Info): keep the real code/name and correct site. Use Planned Size `20` only if that is the actual plan. Use `09/12/2026`–`09/03/2027` only if those are the actual approved dates. Choose the actual Delivery Type, e.g. `Class` when accurate. For `Offline`, `Hybrid` or `Blended`, enter the exact unique room name returned by the **real** Room API, with capacity >= 20. For genuinely Online delivery, use `Online` and the actual HTTP(S) meeting URL. Do not switch delivery format just to avoid room verification.

2. **Training Programs / Program field**: `FR_NFP_DOTNET` currently has no matching active program in the local training-program catalog. Existing active programs include `FR_NFP_JAVA_2`, `FULLSTACK_JAVA`, and `BACKEND_JAVA`; use one only if it represents the actual curriculum. If this is truly .NET training, create the actual .NET program, version and subjects through Training Programs and activate it. Enter its exact code/name in Class Info. Saving that text alone does not create `ClassTrainingProgram`.

3. **Class Setup — program link and teaching assignment**: this version has entities/repositories but **no registered setup form or application API that creates these records** (also confirmed against the running OpenAPI paths). This step is BLOCKED by missing functionality. It needs a supported application workflow linking `classId=6` to the chosen ACTIVE program, and an active MAIN assignment on `classId=6`, using a subject of that linked program and a real active directory trainer. Effective From must be <= `2026-12-09`; Effective To must be null/open-ended or >= `2027-03-09`. Master Trainer must match that trainer's directory name or email. These are requirements for the missing workflow, not instructions to execute SQL. No existing Class Info input can substitute for these relationships. This fix does not add an entire assignment-management feature.

4. **Trainee List** (`/classes/6?tab=trainees`): add/import genuine trainees and save at least one enrollment with status ACTIVE, linked to internal class 6. ACTIVE plus RESERVED seats must not exceed 20. Selecting rows without saving does not count.

5. **Calendar → Manage Sessions** (`/sessions?classId=6`): create an actual session with Class ID 6, valid topic/trainer IDs, title, start/end time, and correct location. Each counted session must be active, not CANCELLED, and end after it starts. It must fall within the class date range. For example, `09/12/2026 09:00–11:00` is within the saved range, but use it only if that is the actual agreed teaching slot. Merely editing calendar metadata, a topic overview or a draft version does not create a session. Refresh readiness after saving sessions.

All five checks require real evidence. At present, program/assignment setup is unavailable and the real room/trainer source is not configured, so **all READY cannot honestly be achieved through the available forms alone**.

## Validation and running application

Backend regression tests run from an isolated source copy under `.run/readiness-validation`, using separate test databases; they do not build into the live backend's watched `target` directory. Tests cover room API failure/provenance, capacities, ambiguity, Blended/Hybrid, saved operational fields, trainer identity/date range, cross-class IDs, and no invented links/sessions. Frontend regression tests cover explanations, BLOCKED, saved form payloads and internal-class calendar navigation.

Validation result: **29 selected backend tests passed** (21 readiness, 5 calendar, 3 room-directory transport/provenance); the 3 transport/provenance tests were re-run successfully after preserving upstream HTTP 5xx status codes. **44 frontend tests passed** across readiness, navigation, Class Info and calendar. `npm run build` succeeded. `node --check mock-server.js` succeeded.

Read-only evidence files in the workspace: `.run/class-6-api-evidence.json` and `.run/class-6-db-readonly.html`. Test logs: `.run/readiness-validation/backend-tests-final.log` and `.run/readiness-validation/room-api-final.log`.

The live backend was deliberately **not restarted**: its H2 database is in RAM with `spring.jpa.hibernate.ddl-auto=create-drop`, and restarting can discard the user's class edits. Backend changes and the mock response header become active only after the corresponding process restarts. Frontend source changes are available through Vite. Before deploying/restarting, arrange supported data persistence/export for the current in-memory records; this investigation does not modify or restore the database directly.
