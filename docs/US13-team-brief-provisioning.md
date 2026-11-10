# US-13 — Assign brief → snapshot → project → workspace

Implemented flow when a mentor/admin (or the team leader) assigns a project
brief to a **DRAFT** team (`ProjectTeamTemplateService.applyAssignment`).

```text
ProjectTemplate (published version)
        │  1. TemplateBriefSnapshotWriter
        ▼
ProjectTemplateSnapshot  (new row per team, version "<vX.Y>-T<teamId>",
                          PUBLISHED, isActive = false, full brief in content_json)
        │  2. TemplateAssignmentProvisioningService#createProject
        ▼
projects (code = <classCode>-T<teamId>, class_id, team_id,
          template_snapshot_id, status = PLANNING)
        │  3. workspace + generated components
        ▼
workspaces (ACTIVE, team + project, all 8 sections)
  ├── milestones        ← template milestones (deadline, rubric version,
  │                       checklist, late policy, weight)
  ├── sprint + backlog  ← one PLANNED sprint + one SprintBacklog row per
  │                       template backlog item
  ├── artifacts         ← activity rows per template artifact requirement
  └── activity feed     ← WORKSPACE_COMPONENTS_GENERATED
```

## Components

| Class | Role |
|---|---|
| `system/project/template/assignment/TemplateBriefSnapshotWriter` | Step 1 — copies the active published version into an immutable snapshot (`content_json` includes context, goals, deliverables, constraints, milestones + rubric/checklist/late policy, backlog items, artifacts). |
| `system/project/template/assignment/TemplateAssignmentProvisioningService` | Steps 2 and 3 — project insert, team link, workspace creation (journal + outbox + activity), milestone/sprint/backlog/artifact generation, audit `PROVISION_TEAM_PROJECT`, outbox `TEAM_PROJECT_PROVISIONED`. |
| `Project` (`template_snapshot_id`, `class_id`, `team_id`) | Evidence columns written once by the provisioning service. |
| `ProjectTeamTemplateResponse` | Now also returns `projectId` / `projectCode`. |

## Rules

- Runs inside the assignment transaction (`Propagation.MANDATORY`).
- Idempotent per team: a team that already owns a project is skipped; an
  existing workspace is reused and only re-linked to the project.
- Milestone generation requires a rubric version: the template milestone's
  rubric is preferred, otherwise the first PUBLISHED rubric of the tenant is
  used; when the tenant has no rubric the milestone step is skipped and logged.
- Project status stays `PLANNING`; `WorkspaceProjectStatusInitializer` promotes
  it to `ACTIVE` once the workspace exists (`projectCanStart` accepts both).
- Sample data: `ProjectTeamTemplateDemoDataInitializer` seeds 3 milestones
  (checklist, rubric criteria, late policy), 5 backlog items and 2 artifact
  requirements per `US10-TPL-*` / `US11-TPL-MULTIROLE-4-8` template.
