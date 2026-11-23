### 5.1. Workspace Analytics

#### 5.1.10. US-ANL-010 – Export Sprint & Backlog Analytics Report (CSV / PDF + Audit Log) ([Author Name])

#### 5.1.10.1. Objective

Allow authorized Mentors, Program Managers, Administrators, and active Student Team Leaders to export the currently filtered Sprint & Backlog analytics dataset as a secure binary download—**CSV** (UTF-8 BOM flat daily trends + item-level metrics), **PDF** (executive A4 snapshot of KPIs, trend tables, and item breakdown), or multi-sheet **Excel (.xlsx)** workbook—while strictly blocking unauthorized roles and empty datasets and recording an immutable download audit trail (`project_analytics_export_audit_log`) for every successful export.

#### 5.1.10.2. Actors

- **Primary Actors:**
  - **Mentor / Teacher / Trainer:** Exports Sprint & Backlog analytics reports for assigned projects to support reviews and grading.
  - **Program Manager (PM) / Class Admin:** Exports reports across managed class projects for program tracking and stakeholder reporting.
  - **Student Team Leader:** Exports analytics reports exclusively for the project where they hold an active Team Leader role.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `SYSTEM_ADMIN` / `PO`):** Exports analytics reports for any active project within their tenant.
- **Restricted Actor (Denied Export):**
  - **Regular Student (Non-Leader Team Member):** Can view read-only analytics (**US-ANL-001**), but cannot export reports (`canExport = false`; button disabled in UI and blocked with HTTP `403` on the backend).
- **Supporting Actor:**
  - **System (`AnalyticsHeader`, `ProjectAnalyticsPage`, `projectAnalyticsApi`, `ProjectAnalyticsController`, `ProjectAnalyticsAccess`, `ProjectAnalyticsExportService`, and `ProjectAnalyticsExportAuditRepository`):** Enforces dual-layer export RBAC, prevents double-submission, generates formula-safe CSV/XLSX or iText 7 PDF streams, sets secure download headers, and persists immutable export audit entries.

#### 5.1.10.3. Preconditions

- The user is authenticated and authorized to view the target project's Analytics workspace (`PROJECT_ANALYTICS_READ` per **US-ANL-001**).
- The user's active role holds the `PROJECT_ANALYTICS_EXPORT` permission **and** either belongs to an eligible management/staff role or is an active Student Team Leader on the target project (`shell.canExport = true`).
- The target project and currently applied analytics filters contain at least one work item or trend data point (`scopeIsEmpty = false`).
- No analytics query or export request is currently in flight (`!isBusy && exportingFormat === null`).

#### 5.1.10.4. Postconditions

- **Success:**
  - The browser downloads the generated report file named `<projectCode>-analytics-<scopeOrSprint>-<yyyyMMdd>.<csv|pdf|xlsx>` with response headers `Content-Disposition: attachment`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and `X-Correlation-Id`.
  - Exactly one immutable row is persisted in `project_analytics_export_audit_log` capturing `id`, `actor_id`, `exported_at`, `project_id`, `tenant_id`, `filter_scope`, `export_format`, and `correlation_id`.
  - The frontend revokes the temporary `Blob` URL, re-enables the **Export report** button, and displays the success toast `"Analytics <FORMAT> report downloaded."`.
- **Failure / Access Denied (`403`) / Empty or Invalid Request (`422`):**
  - No report binary is returned and **no** audit log row is created; the UI re-enables the button and displays an appropriate error toast.

#### 5.1.10.5. Trigger

The user clicks the **Export report** dropdown button in the `AnalyticsHeader` of the Project Analytics workspace and selects **Export as CSV**, **Export as PDF**, or **Export as Excel (.xlsx)**.

#### 5.1.10.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Opens the Project Analytics workspace (optionally applying Scope, Sprint, Date Range, and Work Item Type filters per **US-ANL-002**). |
| 2 | Frontend | Enables the **Export report** dropdown button because `shell.canExport === true`, data is non-empty (`!scopeIsEmpty`), and no fetch/export is active. |
| 3 | User | Clicks **Export report** and selects a format (**Export as CSV**, **Export as PDF**, or **Export as Excel (.xlsx)**). |
| 4 | Frontend | Sets `exportingFormat` (disabling the button with a spinning `Loader2` and `"Exporting <FORMAT>..."` label to prevent double-submit) and sends `POST /api/v1/projects/{projectId}/analytics/export` with `{ format, scope, sprintId, startDate, endDate, itemType }` and `responseType: "blob"`. |
| 5 | Backend | Verifies `@PreAuthorize("hasAuthority('PROJECT_ANALYTICS_EXPORT')")`, parses `format` (`CSV`, `PDF`, or `XLSX`/`EXCEL`), and runs `analyticsService.exportSnapshot(...)` which enforces `access.requireUser()`, `access.requireProject(...)`, and `access.requireExportAccess(user, project)` before reading any work item data. |
| 6 | Backend | Validates that the filtered dataset is non-empty (`!isEmptyDataset`), resolves `correlationId` (`X-Correlation-Id` header → MDC `correlationId` → new UUID), serializes `filterScope`, and renders the binary report: UTF-8 BOM CSV (7 structured sections with formula-injection sanitization), iText 7 A4 PDF executive summary (KPI strip, 4 trend tables, up to 120 item rows), or Apache POI 7-sheet XLSX workbook. |
| 7 | Backend | Inside `@Transactional`, persists one immutable `ProjectAnalyticsExportAuditLog` entry to `project_analytics_export_audit_log` and builds the attachment filename `<projectCode>-analytics-<scopeOrSprint>-<yyyyMMdd>.<ext>`. |
| 8 | Backend | Returns HTTP `200 OK` streaming the binary `byte[]` with `Content-Type` (`text/csv; charset=UTF-8`, `application/pdf`, or `.xlsx` MIME), `Content-Disposition: attachment`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and `X-Correlation-Id`. |
| 9 | Frontend | Extracts the filename from `Content-Disposition` (with safe fallback), creates a temporary object URL to trigger the browser file download, revokes the URL, resets `exportingFormat` to `null`, and displays `"Analytics <FORMAT> report downloaded."`. |

#### 5.1.10.7. Alternative Flows and Exceptions

**5.1.10.7.1. Unauthorized User / Regular Student Attempting Export (HTTP `403 Forbidden`)**

1. **UI Guard:** When `shell.canExport === false` (e.g., regular non-leader Student), `AnalyticsHeader` disables the **Export report** button wrapped in a tooltip: *"Only Mentors, Program Managers, and Team Leaders can export reports"*.
2. **Backend Enforcement:** If an unauthorized caller invokes `POST /api/v1/projects/{projectId}/analytics/export` directly (missing `PROJECT_ANALYTICS_EXPORT`, cross-tenant project, out-of-scope project, or non-leader Student), `ProjectAnalyticsAccess.requireExportAccess` throws `AccessDeniedException` before querying work items or writing any audit entry, returning HTTP `403 Forbidden`. The frontend shows the error toast *"You do not have permission to export analytics for this project."*

**5.1.10.7.2. Empty Dataset Export Blocked (HTTP `422 Unprocessable Entity`)**

1. **UI Guard:** When `scopeIsEmpty === true` (no work items or trend points in the active filter), the **Export report** button is disabled with tooltip *"No data available to export"*.
2. **Backend Defense-in-Depth:** If an empty-scope export request reaches the API directly, `isEmptyDataset(...)` returns `true` and throws `ProjectAnalyticsValidationException("filters", "No data available to export")` → HTTP `422 Unprocessable Entity`, writing zero audit entries. The frontend shows toast *"No data available to export for the selected filters."*

**5.1.10.7.3. Missing or Unsupported Export Format (HTTP `422 Unprocessable Entity`)**

1. If `format` is blank or not one of `CSV`, `XLSX` (`EXCEL`), or `PDF`, `parseFormat(...)` throws `ProjectAnalyticsValidationException("format", "Export format must be CSV, XLSX or PDF")` → HTTP `422 Unprocessable Entity` with `errors.format`.

**5.1.10.7.4. Large Dataset Truncation Note in PDF Reports (`> 120` Items)**

1. When exporting **PDF** for a scope containing more than `MAX_PDF_ITEM_ROWS = 120` work items, Section 5 renders the first 120 rows and appends an explanatory footer note: *"Showing first 120 of N items. Export Excel (XLSX) or CSV for the full item-level dataset."* CSV and XLSX exports always include all matching work items without truncation.

**5.1.10.7.5. Transient Generation or Network Failure (HTTP `500`)**

1. If PDF/XLSX rendering or network transport fails, the transaction rolls back (so no misleading audit log is stored), `exportingFormat` resets in `finally`, and the frontend displays toast *"Unable to generate the `<FORMAT>` report right now. Please try again."*

#### 5.1.10.8. Business Rules and Notes

1. **Dual-Layer Export RBAC (`PROJECT_ANALYTICS_EXPORT` + Role/Leadership Scope):**
   - Eligible staff roles (`EXPORT_STAFF_ROLES`): `ADMIN`, `SUPER_ADMIN`, `SYSTEM_ADMIN`, `PO`, `PROGRAM_MANAGER`, `PM`, `MENTOR`, `TEACHER`, `TRAINER`, `CLASS_ADMIN`, `TEAM_LEADER`.
   - Active Student Team Leaders are verified dynamically against the target project via `ProjectAnalyticsWorkItemRepository.isProjectTeamLeader(userId, project)` (covering `ProjectTeam.leaderMemberId`, `ProjectMember.role`, and legacy `TeamMember.projectRole`).
2. **Immutable Audit Log Schema (`project_analytics_export_audit_log`):**
   - Every column is `nullable = false, updatable = false`: `id` (UUID), `actor_id`, `exported_at` (`Instant`), `project_id`, `tenant_id`, `filter_scope` (`scope=...;sprintId=...;sprint=...;itemType=...;window=...;tz=...`), `export_format` (`CSV | XLSX | PDF`), and `correlation_id`.
   - Written strictly after authorization, empty-check, and report generation succeed inside `@Transactional`.
3. **Export Formats & Structures:**
   - **CSV (`text/csv; charset=UTF-8` with UTF-8 BOM):** 7 sections — Metadata & Active Filters, KPI Summary, Work Item Creation Trend, Work Item Cycle Time, Work Item Lead Time, Work Item Completion Trend, and Item-Level Cycle & Lead Metrics.
   - **PDF (`application/pdf`, iText 7 A4):** Executive Header + 4-column KPI Strip + 4 Trend Tables + Section 5 Item-Level Metrics (capped at 120 rows), using Unicode font `DejaVuSans.ttf` (with Arial/Helvetica fallback).
   - **XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, Apache POI):** 7 styled sheets (`Summary`, `Creation Trend`, `Cycle Time`, `Lead Time`, `Completion Trend`, `Flow & Burndown`, `Work Items`) with frozen header rows, auto-filters, and auto-sized columns.
4. **Spreadsheet Formula-Injection Defense:** Both CSV and XLSX writers pass all user-authored text through `sanitizeSpreadsheetText(...)`, prefixing a single quote (`'`) whenever a cell begins with `=`, `+`, `-`, `@`, `\t`, or `\r`.
5. **Security & Cache Headers:** Every export response includes `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, UTF-8 `Content-Disposition: attachment`, and `X-Correlation-Id`.
6. **Anti-Double-Submit Guard:** Frontend tracks `exportingFormat` state and ignores concurrent export clicks until the active request resolves in `finally`.

### 5.1.10.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying binary report export (`CSV` / `PDF` / `XLSX`), immutable audit log persistence, and RBAC `403` / empty-data `422` enforcement.

#### Test Case 1 – Export Filtered Analytics Report as CSV / PDF (`200 OK` + Audit Log)

- **API:** `POST /api/v1/projects/{projectId}/analytics/export` *(also mapped at `/api/projects/{projectId}/analytics/export`)*
- **Request Data:**
  - **Headers:** `Authorization: Bearer <mentor_pm_or_team_leader_jwt>`, optional `X-Correlation-Id: test-export-001`
  - **Path Parameter:** `projectId = 1`
  - **Request Body (`application/json`):**
    ```json
    {
      "format": "PDF",
      "scope": "SPRINT",
      "sprintId": 4,
      "startDate": "2026-11-01",
      "endDate": "2026-11-23",
      "itemType": "ALL"
    }
    ```
    *(Repeat with `"format": "CSV"` and optionally `"format": "XLSX"` to verify all supported formats.)*
- **Expected Result:** HTTP `200 OK` binary attachment download with headers:
  - `Content-Type: application/pdf` *(or `text/csv; charset=UTF-8`)*
  - `Content-Disposition: attachment; filename*=UTF-8''prj-ecom-01-analytics-sprint-4-20261123.pdf`
  - `Cache-Control: no-store`
  - `X-Content-Type-Options: nosniff`
  - `X-Correlation-Id: test-export-001`
  - One immutable audit row recorded in `project_analytics_export_audit_log` matching `actor_id`, `project_id`, `filter_scope`, `export_format`, and `correlation_id`.
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, response headers, downloaded filename, and confirmation of audit log entry]`

![Swagger test result for POST /api/v1/projects/{projectId}/analytics/export 200 OK](images/us-anl-010-swagger-export-200.png)

**Figure 5.1.10-1. Swagger API test result for exporting a filtered Analytics Report (`POST /api/v1/projects/{projectId}/analytics/export` – `200 OK`)**

---

#### Test Case 2 – Unauthorized Role Export Rejection (`403 Forbidden`) & Empty Scope Rejection (`422`)

- **API:** `POST /api/v1/projects/{projectId}/analytics/export`
- **Request Data:**
  - **Header:** `Authorization: Bearer <regular_student_non_leader_jwt>` *(for `403`)*, or authorized token with an empty date range `startDate=2025-01-01&endDate=2025-01-07` *(for `422`)*
  - **Path Parameter:** `projectId = 1`
  - **Request Body:** `{ "format": "CSV", "scope": "ALL" }`
- **Expected Result:**
  - For regular non-leader Student: HTTP `403 Forbidden` with `{ "status": 403, "message": "Only authorized Mentors, Program Managers, and Team Leaders may export project analytics", "errors": {} }` and **zero** audit log entries created.
  - For empty dataset: HTTP `422 Unprocessable Entity` with `{ "status": 422, "message": "The analytics filters are not valid", "errors": { "filters": ["No data available to export"] } }` and **zero** audit log entries created.
- **Actual Result:** `[Insert HTTP status code, e.g., 403 Forbidden / 422 Unprocessable Entity, and actual error response body]`

![Swagger test result for unauthorized export 403 Forbidden](images/us-anl-010-swagger-export-403.png)

**Figure 5.1.10-2. Swagger API test result confirming RBAC rejection for unauthorized export (`403 Forbidden`)**

### 5.1.10.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens and exported report outputs for this Use Case.

![Export report dropdown menu in Project Analytics header](images/us-anl-010-ui-export-dropdown.png)

**Figure 5.1.10-3. Export report dropdown in the Project Analytics header offering Excel (.xlsx), CSV, and PDF formats with download toast confirmation**

![Disabled Export report button with RBAC tooltip for regular students](images/us-anl-010-ui-export-disabled-tooltip.png)

**Figure 5.1.10-4. Disabled Export report button displaying contextual tooltip for restricted roles or empty datasets**

![Exported PDF executive summary and CSV/XLSX report preview](images/us-anl-010-output-report-preview.png)

**Figure 5.1.10-5. Sample exported Sprint & Backlog Analytics PDF executive report and CSV/XLSX dataset**
