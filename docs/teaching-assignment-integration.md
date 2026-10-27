# Teaching assignment integration (P6)

This implements Thang's assignment integration scope using the agreed `Api-Thang.docx`, on top of P1–P5 and the shared StudySession backend. Business IDs remain numbers and schedule timestamps remain local ISO date/time in `Asia/Ho_Chi_Minh`. This change does not apply the different String-ID/offset migration proposed in the earlier group API table.

## Availability for Danh and Phat

Existing callers can still use:

```http
GET /api/classes/1/teaching-assignments/available?date=2026-11-02
```

New callers can filter a class curriculum subject and the full session interval:

```http
GET /api/classes/1/teaching-assignments/available?programSubjectId=21&from=2026-11-02T09:00:00&to=2026-11-02T11:00:00
```

`from` and `to` must be provided together, with `to > from`; they cannot be combined with `date`. Invalid parameters return 400. No match returns `200 []`. The class/program/subject/assignment and trainer must be active, the subject must belong to the class program, and the interval must fit the inclusive assignment/class dates when supplied. Both Main and Assistant assignments are returned. Lookup never records usage.

## Persisted session sources

New weekly generation writes `StudySession` only. Existing `Session` rows remain in place. There is no dual write or automatic migration of existing rows. Scheduling checks read active, non-cancelled occupancy from both sources; completed active bookings also block overlaps. Historical assignment queries count every status and active flag. Adjacent intervals do not overlap.

The pair `{source, id}` identifies a row. Sources are `DEMO_SESSION` and `STUDY_SESSION`. Equal numbers in the two tables remain different rows. Assignment session/impact responses preserve the previous summary fields and add `source`; frontend row keys include it.

The existing history, edit context, impact preview, lifecycle context, ending and deletion endpoints now include both sources. Any linked history blocks trainer changes/deletion. A sticky usage marker continues to protect assignments after references are physically removed. Cancelled rows do not block shortening dates, and are retained in history. No session is moved or cancelled by an assignment operation.

## Scoped schedule preview

```http
POST /api/schedule-checks/scoped
Content-Type: application/json

{
  "sessions": [{
    "replacedKey": null,
    "teachingAssignmentId": 100,
    "classId": 1,
    "subjectId": 5,
    "programSubjectId": 21,
    "trainerId": 7,
    "title": "Java integration lesson",
    "startTime": "2026-11-02T09:00:00",
    "endTime": "2026-11-02T11:00:00",
    "roomId": null,
    "meetingUrl": "https://example.com/lesson"
  }]
}
```

For an edit, `replacedKey` is `{ "source": "STUDY_SESSION", "id": 123 }`. Only that source/ID is excluded. The edited row must exist, and a replacement key cannot repeat in a batch. The server determines the source scope; the caller cannot disable a source or provide a list of unrelated exclusions.

Structure errors return 400. A completed preview returns `200 {valid, issues}` even when invalid. Each issue includes `code`, `field`, `message`, `candidateIndex`, `relatedCandidateIndex` and `relatedEntryKey`. Read/lookup failures are not treated as empty successful results. Unknown resource identity on an existing active booking blocks scheduling until resolved.

New-session preview accepts `STUDY_SESSION_CREATE` or the generator's `SESSION_CREATE`. Edit previews require the update permission appropriate to the source (`STUDY_SESSION_UPDATE` or `SESSION_UPDATE`). Preview never grants write permissions. Real writes always repeat validation. A rejected write returns 409 with `message`, `errors`, `valid:false` and `issues`. This endpoint does not record usage or save sessions. The older `/schedule-checks` and version-qualified validation contracts remain available for existing callers; the earlier preparatory `validateScoped` API remains diagnostic, not a write gate.

Assignment identity is checked from the local repository. Class/trainer/room/holiday resources come from the configured reference provider, without relying on its legacy external assignment list. `subjectId`, `programSubjectId` and a domain `topicId` are not interchangeable. The integrated proposal has no `topicId` field.

## StudySession CRUD and import

`POST /api/study-sessions` and `PUT /api/study-sessions/{id}` retain Danh's DTO: separate `sessionDate`, `startTime`, `endTime`, plus `title`, `lecturer`, `type` and the scalar links. The resolver verifies and derives official program-subject/trainer IDs. Linked creates/edits check active eligibility, effective dates, resource rules, holidays and cross-source conflicts under the shared write lock. Updates preserve record identity/audit fields.

Existing unlinked legacy records retain their prior CRUD contract. No name is converted into a resource ID. Linked imports support `Room ID` and `Meeting URL`; each row validates, records usage and saves in one transaction. A rejected row rolls back without undoing independently committed valid rows. Single-session deletion/reassignment preserves previous assignment usage. Reactivation rechecks linked scheduling eligibility.

The English `/study-sessions` page uses the existing layout/theme and permission system. Its create/edit form loads class subjects and interval-specific available assignments; dates/class/subject changes invalidate the assignment selection. It supports list pagination/search, edit, cancel and complete using Danh's current service rules. Source history displays through the existing Teaching Assignments dialogs.

## Weekly generation

The existing endpoints remain:

```http
GET  /api/classes/{classId}/schedule-generation/context
POST /api/classes/{classId}/schedule-generation/preview
POST /api/classes/{classId}/schedule-generation/save
```

Context/preview rows now carry `programSubjectId` and `subjectId`. A domain `topicId` is left null for curriculum-based generation; legacy algorithm callers with an explicit topic retain their existing key. Overrides can target `programSubjectId` without equating it to a topic. No sample class, curriculum, trainer or room is fabricated on failure.

Preview selects an assignment for each generated date. An explicit trainer override is respected. Otherwise one eligible Main is preferred; if there is no unique Main, only one unambiguous eligible assignment may be selected. Missing/ambiguous assignments are row errors. Selection changes at effective-date boundaries. Preview also validates resource rules and existing/intra-batch conflicts. It never records usage. A batch is limited to 200 rows and session duration must be at least one minute.

Save requires `SESSION_READ` and `SESSION_CREATE`, ignores client preview status as evidence, repeats full validation under the lock and inserts StudySessions atomically. Its response adds `createdSessions:[{source:"STUDY_SESSION",id:...}]`. All-or-nothing applies to the row inserts and usage markers.

`Idempotency-Key` is scoped to the authenticated actor and class. Its payload fingerprint and response are stored in `bulk_schedule_receipts` in the same transaction. Same key/payload replays the committed response; a changed payload returns 409. Failed transactions leave no receipt. The frontend retains its key for retries of the same payload and obtains a new key after edits. Persistence across application restarts follows the configured database; the local in-memory profile clears all data on restart.

## Verification and ownership boundary

Run the backend with `local,schedule-demo` for standalone sample resources, then start the frontend normally. Local profiles are explicit demo fixtures, not fallbacks for an upstream outage. The local class-program link supplies the assignment program; scheduling resource dates come from `schedule-demo`.

Full-stack tests exercise availability, history with equal IDs across sources, impact/end/delete protections, preview without usage writes, adjacent/conflicting bookings, legacy writes against StudySession occupancy, committed bulk replay, changed-key content, row-level CSV import, batch rollback, date-specific trainer handover and concurrent creation/ending. P1–P5 remain regression coverage.

This integration preserves Danh/Phat's current version behavior. `StudySessionVersionLock` is still their existing mock; production version association/activation and Tân's calendar projection require their respective module contracts and tests. Those behaviors are not certified by the assignment integration tests, and the older group document's DRAFT/ACTIVE policy is not silently applied here.
