import type { ProjectTemplate, ProjectTemplateRoleQuota } from "@/types";

/**
 * US-09 is not backed by a real endpoint yet: the Project Template module is
 * owned by another team. These mock briefs mirror the snapshot payload the
 * backend will eventually return, so the Explore Projects page can be built
 * and demoed without the API.
 *
 * The list intentionally contains `DRAFT` and `ARCHIVED` rows: the page must
 * hide them, exactly like the backend rule "only status = ACTIVE".
 */

/** Class/cohort the catalogue is scoped to (backend data scope stand-in). */
export const MOCK_CLASS_CONTEXT = {
  classId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  className: "SE1701",
  programName: "Software Engineering",
} as const;

const quotas = (
  pm: [number, number],
  ba: [number, number],
  dev: [number, number],
  qa: [number, number],
): ProjectTemplateRoleQuota[] => [
  { role: "PM", label: "Project Manager", min: pm[0], max: pm[1] },
  { role: "BA", label: "Business Analyst", min: ba[0], max: ba[1] },
  { role: "DEV", label: "Developer", min: dev[0], max: dev[1] },
  { role: "QA", label: "Quality Assurance", min: qa[0], max: qa[1] },
];

export const MOCK_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    projectId: "0d1f6a2b-3c4d-4e5f-8a9b-1c2d3e4f5a6b",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
    name: "Smart Campus Service Portal",
    code: "TPL-CAMPUS-01",
    description:
      "Unify room booking, facility support and request tracking for students and staff. The team delivers a single portal where learners reserve study rooms, raise facility incidents and follow every request until it is resolved.",
    domain: "Education",
    level: "INTERMEDIATE",
    durationWeeks: 8,
    minMembers: 4,
    maxMembers: 5,
    roleQuotas: quotas([1, 1], [1, 1], [2, 3], [1, 1]),
    technologies: ["React", "API", "UX"],
    milestones: [
      {
        id: "campus-m1",
        name: "Discovery & scope sign-off",
        offsetWeeks: 1,
        deliverable: "Personas, problem statement and acceptance criteria agreed with the campus operations team.",
        weight: 10,
        rubric: [
          { criterion: "Stakeholder interviews completed", weight: 5 },
          { criterion: "Scope and non-goals documented", weight: 5 },
        ],
      },
      {
        id: "campus-m2",
        name: "Service blueprint & API contract",
        offsetWeeks: 3,
        deliverable: "Booking and incident flows mapped end-to-end, REST contract reviewed and frozen.",
        weight: 20,
        rubric: [
          { criterion: "Flow completeness", weight: 10 },
          { criterion: "API contract quality", weight: 10 },
        ],
      },
      {
        id: "campus-m3",
        name: "Booking module beta",
        offsetWeeks: 6,
        deliverable: "Working room booking flow with conflict detection, notifications and automated tests.",
        weight: 35,
        rubric: [
          { criterion: "Functional coverage", weight: 20 },
          { criterion: "Automated tests", weight: 10 },
          { criterion: "UX review", weight: 5 },
        ],
      },
      {
        id: "campus-m4",
        name: "Pilot & handover",
        offsetWeeks: 8,
        deliverable: "Pilot demo with real users, operations runbook and retrospective.",
        weight: 35,
        rubric: [
          { criterion: "Pilot adoption evidence", weight: 20 },
          { criterion: "Handover documentation", weight: 15 },
        ],
      },
    ],
    startDate: "2026-11-02",
    endDate: "2026-12-28",
    status: "ACTIVE",
    createdAt: "2026-09-15T08:30:00Z",
    updatedAt: "2026-10-18T10:05:00Z",
  },
  {
    projectId: "1e2f7b3c-4d5e-4f6a-9b0c-2d3e4f5a6b7c",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e",
    name: "GreenRoute Logistics",
    code: "TPL-LOGI-02",
    description:
      "Plan low-emission delivery routes and give dispatchers live exception visibility. The solution balances fuel consumption, delivery windows and driver capacity while surfacing delays as they happen.",
    domain: "Logistics",
    level: "ADVANCED",
    durationWeeks: 10,
    minMembers: 5,
    maxMembers: 6,
    roleQuotas: quotas([1, 1], [1, 1], [3, 3], [1, 1]),
    technologies: ["Maps", "Data", "Mobile"],
    milestones: [
      {
        id: "green-m1",
        name: "Route baseline study",
        offsetWeeks: 1,
        deliverable: "Historic delivery data analysed and baseline emissions per route quantified.",
        weight: 10,
        rubric: [
          { criterion: "Data quality assessment", weight: 5 },
          { criterion: "Baseline methodology", weight: 5 },
        ],
      },
      {
        id: "green-m2",
        name: "Optimisation engine prototype",
        offsetWeeks: 4,
        deliverable: "Routing heuristic validated on three depots with measurable emission reduction.",
        weight: 25,
        rubric: [
          { criterion: "Algorithm correctness", weight: 15 },
          { criterion: "Benchmark results", weight: 10 },
        ],
      },
      {
        id: "green-m3",
        name: "Dispatcher cockpit",
        offsetWeeks: 7,
        deliverable: "Live map, exception feed and re-plan action shipped to the dispatcher mobile app.",
        weight: 30,
        rubric: [
          { criterion: "Realtime accuracy", weight: 15 },
          { criterion: "Usability with dispatchers", weight: 15 },
        ],
      },
      {
        id: "green-m4",
        name: "Operations hardening",
        offsetWeeks: 10,
        deliverable: "Load test report, alerting playbook and final defence with the logistics partner.",
        weight: 35,
        rubric: [
          { criterion: "Performance under load", weight: 20 },
          { criterion: "Operational readiness", weight: 15 },
        ],
      },
    ],
    startDate: "2026-11-02",
    endDate: "2027-01-11",
    status: "ACTIVE",
    createdAt: "2026-09-12T09:00:00Z",
    updatedAt: "2026-10-20T14:20:00Z",
  },
  {
    projectId: "2f3a8c4d-5e6f-4a7b-8c9d-3e4f5a6b7c8d",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    name: "Student Finance Coach",
    code: "TPL-FINC-03",
    description:
      "Help students plan monthly spending, savings goals and payment reminders. The coach turns raw transaction data into a friendly budget plan and nudges learners before tuition or rent is due.",
    domain: "Fintech",
    level: "INTERMEDIATE",
    durationWeeks: 8,
    minMembers: 4,
    maxMembers: 5,
    roleQuotas: quotas([1, 1], [1, 1], [2, 3], [1, 1]),
    technologies: ["Fintech", "Security", "Charts"],
    milestones: [
      {
        id: "finance-m1",
        name: "Money-persona research",
        offsetWeeks: 1,
        deliverable: "Student spending personas and privacy constraints validated with 10 interviews.",
        weight: 10,
        rubric: [
          { criterion: "Interview evidence", weight: 5 },
          { criterion: "Privacy requirements", weight: 5 },
        ],
      },
      {
        id: "finance-m2",
        name: "Budget engine & data model",
        offsetWeeks: 3,
        deliverable: "Categorisation rules, budget model and savings projection reviewed by a finance mentor.",
        weight: 20,
        rubric: [
          { criterion: "Model accuracy", weight: 10 },
          { criterion: "Data protection design", weight: 10 },
        ],
      },
      {
        id: "finance-m3",
        name: "Coach dashboard",
        offsetWeeks: 6,
        deliverable: "Responsive dashboard with spending charts, goal tracking and reminder settings.",
        weight: 35,
        rubric: [
          { criterion: "Feature completeness", weight: 20 },
          { criterion: "Accessibility", weight: 15 },
        ],
      },
      {
        id: "finance-m4",
        name: "Security review & demo",
        offsetWeeks: 8,
        deliverable: "Threat model, penetration test summary and final demo to the scholarship office.",
        weight: 35,
        rubric: [
          { criterion: "Security findings resolved", weight: 20 },
          { criterion: "Demo storytelling", weight: 15 },
        ],
      },
    ],
    startDate: "2026-11-02",
    endDate: "2026-12-28",
    status: "ACTIVE",
    createdAt: "2026-09-18T07:45:00Z",
    updatedAt: "2026-10-21T11:40:00Z",
  },
  {
    projectId: "3a4b9d5e-6f7a-4b8c-9d0e-4f5a6b7c8d9e",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a",
    name: "MediTrack Appointment Hub",
    code: "TPL-HEAL-04",
    description:
      "Give small clinics a shared appointment hub with triage queues, realtime doctor availability and secure patient notifications. Built for low-bandwidth waiting rooms.",
    domain: "Healthcare",
    level: "ADVANCED",
    durationWeeks: 14,
    minMembers: 5,
    maxMembers: 6,
    roleQuotas: quotas([1, 1], [1, 1], [3, 3], [1, 1]),
    technologies: ["Realtime", "API", "Security"],
    milestones: [
      {
        id: "medi-m1",
        name: "Clinic workflow audit",
        offsetWeeks: 2,
        deliverable: "Queue and triage workflow mapped with two partner clinics.",
        weight: 10,
        rubric: [
          { criterion: "Workflow coverage", weight: 5 },
          { criterion: "Compliance checklist", weight: 5 },
        ],
      },
      {
        id: "medi-m2",
        name: "Realtime scheduling core",
        offsetWeeks: 6,
        deliverable: "Availability engine with conflict resolution and offline-tolerant queue sync.",
        weight: 30,
        rubric: [
          { criterion: "Concurrency handling", weight: 15 },
          { criterion: "Offline behaviour", weight: 15 },
        ],
      },
      {
        id: "medi-m3",
        name: "Patient notification service",
        offsetWeeks: 10,
        deliverable: "SMS and in-app reminders with opt-out and audit trail.",
        weight: 25,
        rubric: [
          { criterion: "Delivery reliability", weight: 15 },
          { criterion: "Consent handling", weight: 10 },
        ],
      },
      {
        id: "medi-m4",
        name: "Pilot readiness",
        offsetWeeks: 14,
        deliverable: "Clinic pilot report, incident runbook and security sign-off.",
        weight: 35,
        rubric: [
          { criterion: "Pilot metrics", weight: 20 },
          { criterion: "Security sign-off", weight: 15 },
        ],
      },
    ],
    startDate: "2026-11-02",
    endDate: "2027-02-08",
    status: "ACTIVE",
    createdAt: "2026-09-20T13:10:00Z",
    updatedAt: "2026-10-22T09:15:00Z",
  },
  {
    projectId: "4b5c0e6f-7a8b-4c9d-8e1f-5a6b7c8d9e0f",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b",
    name: "Campus Marketplace",
    code: "TPL-COMM-05",
    description:
      "Launch a trusted marketplace where students buy, sell and donate textbooks and lab equipment. Focus on simple listings, safe meet-up points and a lightweight payment handshake.",
    domain: "E-commerce",
    level: "BEGINNER",
    durationWeeks: 6,
    minMembers: 4,
    maxMembers: 4,
    roleQuotas: quotas([1, 1], [1, 1], [2, 2], [1, 1]),
    technologies: ["React", "Payments", "UX"],
    milestones: [
      {
        id: "market-m1",
        name: "Listing journey prototype",
        offsetWeeks: 1,
        deliverable: "Clickable prototype tested with five students.",
        weight: 15,
        rubric: [
          { criterion: "Prototype usability", weight: 10 },
          { criterion: "Test feedback captured", weight: 5 },
        ],
      },
      {
        id: "market-m2",
        name: "Marketplace MVP",
        offsetWeeks: 4,
        deliverable: "Create/search listing flows with photo upload and moderation flags.",
        weight: 45,
        rubric: [
          { criterion: "Feature completeness", weight: 25 },
          { criterion: "Code quality", weight: 20 },
        ],
      },
      {
        id: "market-m3",
        name: "Trust & handover",
        offsetWeeks: 6,
        deliverable: "Meet-up safety guide, moderation playbook and launch demo.",
        weight: 40,
        rubric: [
          { criterion: "Safety features", weight: 20 },
          { criterion: "Launch readiness", weight: 20 },
        ],
      },
    ],
    startDate: "2026-11-02",
    endDate: "2026-12-14",
    status: "ACTIVE",
    createdAt: "2026-09-22T10:00:00Z",
    updatedAt: "2026-10-19T16:25:00Z",
  },
  {
    projectId: "5c6d1f7a-8b9c-4d0e-9f2a-6b7c8d9e0f1a",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "0f1a2b3c-4d5e-4f6a-9b7c-8d9e0f1a2b3c",
    name: "Green Campus Analytics",
    code: "TPL-SUST-06",
    description:
      "Measure and reduce campus energy and water usage with a shared sustainability dashboard. Sensor data is aggregated into actionable weekly recommendations for facility managers.",
    domain: "Sustainability",
    level: "INTERMEDIATE",
    durationWeeks: 12,
    minMembers: 4,
    maxMembers: 5,
    roleQuotas: quotas([1, 1], [1, 1], [2, 3], [1, 1]),
    technologies: ["Data", "Charts", "IoT"],
    milestones: [
      {
        id: "sustain-m1",
        name: "Sensor data inventory",
        offsetWeeks: 2,
        deliverable: "Building meter inventory and data quality report.",
        weight: 15,
        rubric: [
          { criterion: "Coverage of meters", weight: 10 },
          { criterion: "Quality remediation plan", weight: 5 },
        ],
      },
      {
        id: "sustain-m2",
        name: "Analytics pipeline",
        offsetWeeks: 6,
        deliverable: "Ingestion pipeline with anomaly detection on consumption spikes.",
        weight: 30,
        rubric: [
          { criterion: "Pipeline reliability", weight: 15 },
          { criterion: "Anomaly precision", weight: 15 },
        ],
      },
      {
        id: "sustain-m3",
        name: "Sustainability dashboard",
        offsetWeeks: 9,
        deliverable: "Role-based dashboard with weekly recommendation digest.",
        weight: 25,
        rubric: [
          { criterion: "Insight clarity", weight: 15 },
          { criterion: "Accessibility", weight: 10 },
        ],
      },
      {
        id: "sustain-m4",
        name: "Campus showcase",
        offsetWeeks: 12,
        deliverable: "Measured savings report and showcase for the sustainability office.",
        weight: 30,
        rubric: [
          { criterion: "Measured impact", weight: 20 },
          { criterion: "Stakeholder presentation", weight: 10 },
        ],
      },
    ],
    startDate: "2026-11-02",
    endDate: "2027-01-25",
    status: "ACTIVE",
    createdAt: "2026-09-25T08:00:00Z",
    updatedAt: "2026-10-23T12:30:00Z",
  },
  {
    projectId: "6d7e2a8b-9c0d-4e1f-8a3b-7c8d9e0f1a2b",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "1a2b3c4d-5e6f-4a7b-8c8d-9e0f1a2b3c4d",
    name: "Campus Event Finder",
    code: "TPL-EVENT-07",
    description:
      "A campus-wide event discovery feed with personalised recommendations. Still being drafted by the program team.",
    domain: "Education",
    level: "BEGINNER",
    durationWeeks: 6,
    minMembers: 4,
    maxMembers: 4,
    roleQuotas: quotas([1, 1], [1, 1], [2, 2], [1, 1]),
    technologies: ["React", "API"],
    milestones: [],
    startDate: "2026-11-02",
    endDate: "2026-12-14",
    status: "DRAFT",
    createdAt: "2026-10-01T08:00:00Z",
    updatedAt: "2026-10-01T08:00:00Z",
  },
  {
    projectId: "7e8f3b9c-0d1e-4f2a-9b4c-8d9e0f1a2b3c",
    classId: MOCK_CLASS_CONTEXT.classId,
    snapshotId: "2b3c4d5e-6f7a-4b8c-9d9e-0f1a2b3c4d5e",
    name: "Legacy Library Kiosk",
    code: "TPL-LIBR-08",
    description:
      "Self-service kiosk for borrowing and returning library books. Archived after the library moved to a commercial platform.",
    domain: "Education",
    level: "BEGINNER",
    durationWeeks: 10,
    minMembers: 4,
    maxMembers: 5,
    roleQuotas: quotas([1, 1], [1, 1], [2, 2], [1, 1]),
    technologies: ["React", "API"],
    milestones: [],
    startDate: "2026-02-02",
    endDate: "2026-04-13",
    status: "ARCHIVED",
    createdAt: "2026-01-05T08:00:00Z",
    updatedAt: "2026-06-30T08:00:00Z",
  },
];

/** Only ACTIVE templates are browsable (US-09 business rule). */
export const getActiveProjectTemplates = (): ProjectTemplate[] =>
  MOCK_PROJECT_TEMPLATES.filter((template) => template.status === "ACTIVE");
