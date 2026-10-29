# Repository Guidelines

## Project Structure & Modules

This repository contains a Java/Spring Boot backend in `backend/` and a React, TypeScript, and Vite frontend in `frontend/`. Backend code and resources are under `backend/src/main/`; tests are under `backend/src/test/`. Frontend code is in `frontend/src/`, organized into API, components, hooks, router, state, and types. Project notes live in `docs/`; container assets are in `docker/`, and sample data is in `data/`. Do not commit generated output such as `backend/target`, `frontend/dist`, or `frontend/node_modules`.

## Build, Test, and Development

Run commands from the relevant module directory:

- `cd backend && ./mvnw spring-boot:run` starts the backend locally.
- `cd backend && ./mvnw test` runs the backend JUnit/Spring test suite.
- `cd backend && ./mvnw package` builds the backend artifact.
- `cd frontend && npm run dev` starts the Vite development server.
- `cd frontend && npm run build` type-checks and builds the frontend.
- `cd frontend && npm run lint` runs ESLint; `npm run preview` serves a production build locally.

## Coding Style & Naming

Follow nearby conventions. Java uses four-space indentation, lowercase packages, and `UpperCamelCase` classes; keep Spring layers in the existing package structure. Frontend components use `PascalCase`, while hooks and helpers use `camelCase` (hooks begin with `use`). Use TypeScript types for API and component data. ESLint is the frontend lint tool; no repository-wide formatter is configured.

## Testing Guidelines

Place backend tests in the matching package under `backend/src/test/java`; use JUnit 5 and Spring test support already declared in Maven. Name tests descriptively and cover behavior at the service or web boundary being changed. Frontend scripts currently provide build and lint checks but no dedicated test command. Run the relevant module checks before submitting changes.

## Commits & Pull Requests

Recent history favors short, imperative subjects with prefixes such as `feat:`, `fix:`, or a feature scope, for example `fix(rubric): ...`. Keep commits focused. Pull requests should explain the behavior changed, link the related issue or acceptance item, list validation commands and results, and include screenshots for visible UI changes. Call out configuration or database changes explicitly.

## Configuration & Data

Keep credentials and machine-specific settings out of commits. Review local configuration changes before staging, and avoid modifying shared/demo data during acceptance scenarios; the procedures in `docs/workspace-acceptance/` describe their fixtures and cleanup expectations.
