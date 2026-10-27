# UFR-PRJ-003-02 — Backlog item + Milestone linking (demo guide)

> Feature: **Create & manage Backlog items linked to a Milestone**
> Status: implemented for the `sprint_backlog` module (the old `backlog_temp` module is gone).

---

## 1. What was connected

| Layer | Change |
| --- | --- |
| Backend | `SprintBacklog` now owns `project_id` and a real `@ManyToOne` relation to `milestones` (`milestone_id`), exposed as `milestoneId` / `milestoneName` / `milestoneDueDate` in `SprintBacklogDTO`. |
| Backend | Create/update resolve and validate the milestone: unknown or cancelled (`is_active = false`) → **404** `"Milestone không tồn tại hoặc đã bị thay đổi"` (AC03); a milestone of another project than the sprint → **422**. |
| Backend | Validation messages match the acceptance criteria: `Vui lòng nhập tên Backlog item`, `Mô tả không được vượt quá 2000 ký tự` (422, per-field map). |
| Backend | Audit log snapshot now records `projectId` / `milestoneId` / `milestoneName`; every create/update also writes an **outbox event** (`SPRINT_BACKLOG_ITEM_CREATED` / `..._UPDATED`) that the existing relay publishes (AC01). |
| Backend | New read endpoint `GET /api/sprint-backlogs/milestone-options` (active milestones of the tenant, earliest deadline first). |
| Backend | Sprint Planning board (`SprintPlanningItemDTO`) now returns the linked milestone, so the planning panels can group/warn by milestone. |
| Frontend | `/backlogs` create bar has: work type, name, **description (with counter)**, **milestone picker**, due date, assignee, `Lưu Backlog Item`. Field level 422 errors are highlighted without losing the other values; 404 keeps the form and shows the AC03 message. |
| Frontend | Backlog rows show the milestone chip; the right-hand detail panel can link / unlink the milestone; milestone options are scoped to the project of the box. |
| Seed | Demo data: 3 sprints + 10 backlog items, 7 of them linked to 4 project-1 milestones. |

---

## 2. Start the demo

```powershell
# 1) backend (port 8080 must be free — stop any old instance first!)
cd backend
.\mvnw.cmd "-Dmaven.test.skip=true" package
java -jar target\starter_project_2025-0.0.1-SNAPSHOT.jar

# 2) frontend (new terminal)
cd frontend
npm run dev
```

* Frontend: <http://localhost:5173>
* Swagger UI: <http://localhost:8080/swagger-ui/index.html>
* H2 console: <http://localhost:8080/h2-console> — JDBC URL `jdbc:h2:file:./data/fams_lms`, user `sa`, empty password (run the backend from the `backend` folder).

Login accounts (seeded):

| Account | Password | Role |
| --- | --- | --- |
| `student@example.com` | `password123` | STUDENT (owns the backlog permissions) |
| `admin@example.com` | `password123` | ADMIN |

Open **Project Management → Backlogs** (`/backlogs`).

---

## 3. Seeded demo data

Product backlog box (bottom of the page) — these are the rows used for AC01:

| Backlog item | Status | Linked milestone |
| --- | --- | --- |
| Clarify release acceptance criteria | TODO | Testing and Quality Gate |
| Audit accessibility of the checkout flow | TODO | Testing and Quality Gate |
| Write the API documentation | TODO | Final Documentation |
| Prepare the regression test plan | TODO | Testing and Quality Gate |

Sprint boxes:

| Sprint | Items with milestone |
| --- | --- |
| Sprint 1 - Discovery | Map current user journeys → *Requirements and Architecture Review*; Gather stakeholder requirements → *Requirements and Architecture Review* |
| Sprint 2 - Design System | Define design tokens → *Core Feature MVP*; Deliver shared component library → *Core Feature MVP* |
| Sprint 3 - Build | Implement landing page → *Core Feature MVP*; Update brand guidelines → *Final Documentation* |

Milestone options (project 1): *Project Kickoff and Scope Confirmation*, *Requirements and Architecture Review*, *Core Feature MVP*, *Sprint Demo 1*, *Testing and Quality Gate*, *Final Documentation*, *Final Product Presentation*.

---

## 4. Demo script

### AC01 — Happy path: create an item linked to a milestone

1. Stay on `/backlogs`, scroll to the bottom **Backlog** box.
2. Click **+ Create**.
3. Fill in:
   * Name: `Viết tài liệu kiến trúc hệ thống`
   * Description: `Mô tả kiến trúc 3 lớp, sơ đồ triển khai và các quyết định kỹ thuật chính.`
   * Click the **Milestone** button → choose `Project 1 · Core Feature MVP`.
   * Due date (defaults to today) and optional assignee.
4. Click **Lưu Backlog Item**.

Expected:

* Toast **“Đã tạo công việc trong Backlog.”**
* The new row appears in the Backlog box, with the violet **Core Feature MVP** chip.
* Opening the row (right panel) shows the same milestone in **Details → Milestone**.
* Audit + outbox rows exist — see section 5.

> The sprint boxes (`Sprint 1 - Discovery`, …) work the same way, but their milestone picker only lists milestones of that sprint's project.

### AC02 — Missing name / description over 2000 characters (422)

1. Open **+ Create** in the Backlog box.
2. Leave the name empty and click **Lưu Backlog Item**.
   * The bar turns red and shows **“Vui lòng nhập tên Backlog item”**.
3. Type a name, then paste **2001+ characters** into the description (the counter turns red: `2001/2000`).
4. Click **Lưu Backlog Item**.

Expected:

* The API answers **422 Unprocessable Entity** (`errors.description = ["Mô tả không được vượt quá 2000 ký tự"]`).
* The description field is highlighted red and the message shown; **name, milestone, due date and assignee stay filled in**.
* Shorten the description and save again → item is created.

> Show the raw 422 in Swagger UI → `POST /api/sprint-backlogs` with a 2001-character `description` (Student token). The response body is the per-field map the UI consumes.

### AC03 — Milestone no longer exists (404)

1. Open **+ Create** in the Backlog box, type a name + description.
2. Pick milestone **Core Feature MVP** but **do not save yet**.
3. In the H2 console run:

```sql
UPDATE milestones SET is_active = FALSE WHERE title = 'Core Feature MVP';
```

4. Back in the browser, click **Lưu Backlog Item**.

Expected:

* Red toast **“Milestone không tồn tại hoặc đã bị thay đổi”** and the form keeps every typed value so another milestone can be chosen.
* The item is **not** created (check the list / database).

Restore the demo data and reload the page before continuing:

```sql
UPDATE milestones SET is_active = TRUE WHERE title = 'Core Feature MVP';
```

> Same result from Swagger: `POST /api/sprint-backlogs` with
> `"milestoneId": "00000000-0000-0000-0000-000000000000"` → **404**.

### Bonus — change / unlink the milestone later

Open any backlog row → right panel → **Details → Milestone**:
* pick another milestone → saved immediately (audit `UPDATE` + outbox event),
* pick **No milestone** → link removed (`clearMilestone`), row chip disappears.

---

## 5. Prove the audit log + outbox event

### H2 console

```sql
-- backlog items with their milestone
SELECT sb.sprint_backlog_id, sb.title, sb.project_id, m.title AS milestone
FROM sprint_backlog sb
LEFT JOIN milestones m ON m.milestone_id = sb.milestone_id
ORDER BY sb.sprint_backlog_id;

-- audit trail of the last mutations (actor, before/after JSON, correlation id)
SELECT sprint_backlog_id, action, actor_email, correlation_id, after_state, created_at
FROM sprint_backlog_audit_log
ORDER BY id DESC
LIMIT 10;

-- outbox events emitted by the backlog module
SELECT event_type, aggregate_id, correlation_id, status, payload
FROM sprint_outbox_event
WHERE aggregate_type = 'SPRINT_BACKLOG'
ORDER BY id DESC
LIMIT 10;
```

* `sprint_outbox_event.status` is `PENDING` right after saving and `PUBLISHED` after the relay runs (10 s).
* The relay log line proves the notification delivery:

```
[SPRINT-OUTBOX] publish eventId=... type=SPRINT_BACKLOG_ITEM_CREATED aggregateId=...
  payload={"eventType":"SPRINT_BACKLOG_ITEM_CREATED","sprintBacklogId":...,"projectId":1,...}
```

### REST API

```http
GET /api/sprint-backlogs/milestone-options        # milestone picker source
GET /api/sprint-backlogs/{id}/audit-logs          # audit trail of one item
GET /api/sprint-backlogs?milestoneId=<uuid>       # filter items by milestone
```

---

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Port 8080 was already in use` | An old backend is still running — stop it and start the freshly packaged jar, otherwise the demo runs the previous code. |
| Milestone picker is empty | `milestone.mock.seed-enabled` must be `true` (default) and the backend must start without the `milestone-real-integrations` profile. |
| `Project không khớp với Sprint / Milestone đã chọn` (422) | The picked milestone belongs to another project than the sprint. Use the product backlog box or a milestone of the same project. |
| Milestone of AC03 still missing after restore | The picker caches options for 60 s — reload the page. |
| `403` on the milestone options | Log in as `student@example.com` (has `SPRINT_BACKLOG_READ`) or `admin@example.com`. |
