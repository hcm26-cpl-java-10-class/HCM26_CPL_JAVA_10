# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FAMS LMS — a training & exam management system (team HCM26_CPL_JAVA_10). Monorepo with a Spring Boot backend (`backend/`) and a React + Vite + TypeScript frontend (`frontend/`). Feature specs, implementation plans and verification notes live in `docs/` (e.g. `MILESTONE_BACKEND_GUIDE.md`, `MILESTONE_FRONTEND_GUIDE.md`, `PROJECT_HUB.md`) — check there before designing a feature in the project/milestone area.

## Commands

### Backend (`backend/`, Java 21, Spring Boot 3.3, Maven wrapper)

```bash
./mvnw spring-boot:run                       # run on :8080 (Swagger UI enabled, H2 console at /h2-console)
./mvnw compile                               # compile
./mvnw test                                  # all tests
./mvnw test -Dtest=NotificationServiceTest   # single test class
./mvnw test -Dtest=NotificationServiceTest#methodName   # single test method
```

- Config is read from OS env vars, then `backend/.env` (loaded by `config/DotenvEnvironmentPostProcessor`), then defaults in `application.properties`. Template: `backend/backend.env.example`. AI features (essay grading, exam similarity) need `GEMINI_API_KEY`.
- Default datasource is a file-based **H2** DB (`./data/...`) with `ddl-auto=update`; set `DB_URL`/`DB_DRIVER`/`DB_DIALECT` for MySQL. `docker/docker-compose.yml` starts MySQL (host port 3307) and Redis.
- Many demo seeders run at startup and are toggled by `app.seed.*` / `*_DEMO_ENABLED` properties.
- `architecture/SourcePackageStructureTest` fails the build if a Java file's `package` doesn't match its folder — keep them in sync when moving files.

### Frontend (`frontend/`)

```bash
npm run dev                          # Vite dev server (:5173)
npm run build                        # tsc -b && vite build
npm run lint                         # eslint
npx tsc --noEmit -p tsconfig.app.json  # type-check app sources
```

- API base URL: `VITE_API_URL` (defaults to `http://localhost:8080/api`). Template: `frontend/frontend.env.example`.
- There is no frontend test runner configured.
- ESLint includes `react-hooks/set-state-in-effect`: don't call `setState` directly inside `useEffect`; derive state during render instead.

## Architecture

### Backend (`com.example.starter_project_2025`)

- `base/crud` — generic CRUD stack (`BaseEntity`, `BaseCrudController`, `BaseCrudService(Impl)`, `BaseCrudMapper` via MapStruct, `AutoSpecBuilder` that builds JPA Specifications from `@FilterField` annotations on filter DTOs). Simple entities extend these instead of hand-writing controllers. `base/dataio` provides generic import/export (Excel/CSV/PDF).
- `security` — stateless JWT (RSA keys) + Google OAuth2 login. Authorization is permission-based: `@PreAuthorize("hasAuthority('RESOURCE_ACTION')")`, e.g. `COURSE_READ`. Permissions/roles/users live in `system/rbac`.
- `system/menu` — `module_groups` / `module` tables drive the sidebar **and** the frontend's dynamic routes (each module has a URL and required permission).
- `system/<feature>` — feature modules (exam, question, project, notification, dashboard, …). The larger `system/project` area (teams, allocation, board, milestone, submission) is layered as `controller / service / domain / dto / repository` and also uses idempotency records, a transactional outbox (`milestone/outbox`) and ports (`submission/port`) for cross-module calls.
- Validation errors are returned as field-keyed maps (e.g. `criteria[0].feedback`), which the frontend maps back onto form fields.

### Frontend (`src/`)

- `@` alias → `src/`. UI is shadcn/ui (`components/ui`) + Tailwind v4; forms use react-hook-form + zod.
- Server state: TanStack Query. Client state: Redux Toolkit (`store/`, mainly auth/role). HTTP: `api/axios.ts` (adds the bearer token and handles refresh/logout); per-feature API clients live in `api/features/*.api.ts`.
- **Routing is partly data-driven**: `router/build-router.ts` globs `pages/management/**/index.tsx`. A page that exports `entityConfig` gets a route at `entityConfig.path` (its default export, or the generic `AutoCrudPage` if there is none), plus optional create/edit/detail action routes. `App.tsx` only mounts those module-driven routes for URLs that appear in the backend menu (`useActiveModuleGroups`), wrapped in `ProtectedRoute` with the module's permission. Other pages are registered as static routes in `router/component-registry.ts`.
- Permissions/role: `hooks/usePermissions` + `utils/rbac.utils`. Students get `StudentNavbar`; other roles get the sidebar layout (`components/layout/MainLayout`). Each page renders its own `MainLayout`, so the sidebar remounts on every navigation; any sidebar UI state that must survive navigation has to be persisted (cookie / local/session storage).

## Conventions (from `docs/COMMIT_GUIDE.md`)

- Branches: `feature/*`, `fix/*`, `hotfix/*`, `chore/*` off `dev`; PRs target `dev` (`main` is release only).
- Conventional Commits: `type(scope): subject` (no trailing period); one logical change per commit; stage specific files rather than `git add .`.
- Before committing: backend `./mvnw test` passes, frontend type-check and `npm run lint` show no new errors, and no new `console.log` / `System.out.println`.
