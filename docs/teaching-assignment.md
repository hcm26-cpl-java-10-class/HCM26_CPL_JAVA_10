# Teaching assignments

The management page is available at `/teaching-assignments` under **Training Operations → Teaching Assignments**.
It uses the existing application layout, theme, permissions and UI components. Labels are in English; names from the shared system are displayed as supplied.

## Run locally

From the repository root, start the backend with the existing sample-data profile:

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The local profile seeds one class with an active program and sample trainer profiles. The second active class must be assigned a program in class setup before it becomes eligible for a new teaching assignment.
Sample data uses an in-memory database and is cleared on restart. The default profile uses the configured external class/trainer service and never falls back to local samples on upstream failure.

## Create an assignment

1. Sign in with an account that has `ASSIGNMENT_READ` and `ASSIGNMENT_CREATE`.
2. Open **Teaching Assignments** and click **New assignment**.
3. Select an eligible class, then one of its active program subjects.
4. Select an active trainer from the trainer directory and the Main or Assistant role.
5. Set the effective start date and optional end date, then click **Create assignment**.

If the page is already filtered by class, that class is preselected when eligible. Changing the class clears the subject selection. Errors retain the form values, and a successful create closes the dialog and refreshes list/filter queries while keeping the current list filters.

## Creation rules

- Classes and their assigned programs must be active. A subject must belong to the selected class program, have `isActive=true` and status `ACTIVE`.
- Trainer IDs come from the shared trainer directory, not from the general user list. Only profiles with active status are accepted, even if an upstream filter incorrectly returns an inactive profile.
- Start/end dates are inclusive; a same-day assignment is allowed. The end cannot precede the start.
- The period must stay within the class dates when those bounds are provided. An omitted end uses the class end date when available, otherwise it remains open-ended.
- There can be one Main trainer per class subject at a time. Multiple different Assistant trainers are allowed. The same trainer cannot have overlapping assignments for the same class subject, including across roles.
- An existing program-subject row is locked before overlap checks and writes, including when the first assignment is created. Participating create/update writes use the same lock, so concurrent conflicting creates cannot both commit.
- Shared-service failures do not save an assignment. Malformed or reversed upstream class date ranges are reported as upstream errors.

The backend revalidates on submission. Field errors return HTTP 400, overlaps return 409 and missing create permission returns 403. Loading/retry states, pending-submit guards and query cancellation protect the form from duplicate submissions and stale class-subject responses.

## API additions

Both lookup endpoints require `ASSIGNMENT_CREATE`, without requiring class/program management permissions:

- `GET /api/teaching-assignments/create-options`: eligible classes and active trainers.
- `GET /api/teaching-assignments/create-context?classId=...`: selected class dates, program/version and eligible program subjects.

The existing `POST /api/teaching-assignments` contract is preserved.

## Validation commands

```powershell
# backend
.\mvnw.cmd test

# frontend (form tests verified with Node 24)
npm run build
npm run test:teaching-assignment
npm exec -- eslint src/pages/management/teaching-assignment src/api/features/class-setup.api.ts
```

The create integration tests cover permissions, creation lookups, date boundaries, invalid input, inactive/foreign data, overlap policies, service failures and simultaneous Main assignment requests. Existing list and class-setup tests remain regression coverage.

Session impact previews, safe trainer changes on used assignments, ending assignments and deletion rules are subsequent implementation stages.
