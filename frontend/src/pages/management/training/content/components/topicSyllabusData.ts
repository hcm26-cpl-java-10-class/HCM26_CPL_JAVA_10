import type { TopicItem } from "@/types/features/content";

export interface TopicSession {
  session: number;
  content: string;
  objectives: string;
  deliveryType:
    | "Concept/Lecture"
    | "Assignment/Lab"
    | "Exam"
    | "Guides/Review"
    | "Test/Quiz"
    | "Seminar/Workshop"
    | "Class Meeting";
  duration: string;
  durationHours: number;
  trainingFormat: "Online" | "Offline";
  materials: string;
}

export interface TopicChapter {
  id: number;
  title: string;
  sessions: TopicSession[];
}

export interface AssessmentItem {
  category: string;
  method: string;
  passingScore: string;
  weight: string;
}

export interface TopicSyllabusPackage {
  chapters: TopicChapter[];
  totalSessions: number;
  timeAllocation: {
    lab: number;
    lecture: number;
    exam: number;
    total: number;
  };
  assessmentScheme: AssessmentItem[];
}

// 1. Curated real syllabi matching video (nav_01.jpg, nav_06.jpg, frame_006.jpg)
const CURATED_SYLLABI: Record<string, TopicChapter[]> = {
  // Hibernate (Exact match to nav_01.jpg & nav_06.jpg)
  L2_JA_ORM: [
    {
      id: 1,
      title: "1. Hibernate Mapping and Relationship",
      sessions: [
        {
          session: 1,
          content: "Hibernate Introduction\nHibernate Mapping\nHibernate relationship",
          objectives: "Understand ORM architecture, entity mapping, and table associations (@OneToMany, @ManyToOne)",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://www.linkedin.com/learning/java-persistence-with-jpa-and-hibernate/mapping-entity-fields-to-table-columns",
        },
        {
          session: 2,
          content: "Long Assignment - problem 1",
          objectives: "Hands-on entity mapping and CRUD operations with Hibernate SessionFactory",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Hibernate-Assignment-1.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "2. Queries and Criteria",
      sessions: [
        {
          session: 3,
          content: "Hibernate Queries and Criteria API",
          objectives: "Master JPQL queries, CriteriaBuilder, root queries, and type-safe query formulation",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://www.linkedin.com/learning/java-persistence-with-jpa-and-hibernate/jpql-queries",
        },
        {
          session: 4,
          content: "Long Assignment - problem 2",
          objectives: "Implement dynamic search filters and pagination using JPA Criteria API",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Criteria-Assignment-2.pdf",
        },
      ],
    },
    {
      id: 3,
      title: "3. Hibernate Caching and Validator",
      sessions: [
        {
          session: 5,
          content: "Hibernate Caching\nHibernate Validator",
          objectives: "Understand L1/L2 cache providers, entity lifecycle listeners, and validation constraints",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "Jakarta-Bean-Validation-using-Hibernate-Validator.pdf",
        },
        {
          session: 6,
          content: "Long Assignment - problem 3",
          objectives: "Optimize query caching, avoid N+1 queries, and author custom bean validators",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Caching-Validation-3.pdf",
        },
      ],
    },
    {
      id: 4,
      title: "4. Final Test",
      sessions: [
        {
          session: 7,
          content: "Theory Final Test (60m)\nPractice Final Test (180m)",
          objectives: "Comprehensive evaluation of Hibernate mapping, criteria query performance, and caching",
          deliveryType: "Exam",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Exam-Rubric-Hibernate-v2.pdf",
        },
      ],
    },
  ],

  // Java Core & OOP
  JAVA_CORE: [
    {
      id: 1,
      title: "1. Core Syntax, Memory & Object-Oriented Fundamentals",
      sessions: [
        {
          session: 1,
          content: "Java Virtual Machine (JVM) Architecture, Stack & Heap\nPrimitive Types & Control Structures",
          objectives: "Master memory allocation model, bytecode compilation, and foundational syntax rules",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/",
        },
        {
          session: 2,
          content: "Encapsulation, Inheritance, Polymorphism & Abstraction",
          objectives: "Apply SOLID object-oriented principles to construct scalable class hierarchies",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Java-OOP-BankingSystem.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "2. Collections Framework, Generics & Exception Handling",
      sessions: [
        {
          session: 3,
          content: "List, Set, Map Internals & Complexity Analysis\nCustom Generic Classes & Bounded Wildcards",
          objectives: "Evaluate internal hashing in HashMap, collision resolution, and author type-safe collections",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://www.baeldung.com/java-collections",
        },
        {
          session: 4,
          content: "Exception Hierarchy, Custom Checked/Unchecked Exceptions & Java I/O",
          objectives: "Construct resilient error-handling strategies and read/write structured file streams",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Collections-FileIO.pdf",
        },
      ],
    },
    {
      id: 3,
      title: "3. Modern Java Features & Functional Programming",
      sessions: [
        {
          session: 5,
          content: "Lambda Expressions, Functional Interfaces & Java Stream API Pipelines",
          objectives: "Write declarative parallel and sequential stream processing with map, filter, reduce",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://dev.java/learn/api/streams/",
        },
        {
          session: 6,
          content: "Advanced Stream Operations, Collectors & Optional Class Best Practices",
          objectives: "Refactor legacy loops into clean stream collectors and eliminate NullPointerExceptions",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Streams-Refactoring.pdf",
        },
      ],
    },
    {
      id: 4,
      title: "4. Final Assessment",
      sessions: [
        {
          session: 7,
          content: "Java Core Theory Test (60m) & OOP Console Application Defense (180m)",
          objectives: "Demonstrate complete mastery of Java fundamentals, clean code, and algorithmic problem solving",
          deliveryType: "Exam",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Exam-Java-Core-Assessment.pdf",
        },
      ],
    },
  ],

  // Spring Boot Enterprise
  SPRING_BOOT: [
    {
      id: 1,
      title: "1. Spring Core & Architecture",
      sessions: [
        {
          session: 1,
          content: "Inversion of Control (IoC), Dependency Injection & Bean Lifecycle\nSpring Boot Autoconfiguration",
          objectives: "Understand Spring container mechanics, component scans, and profile-based configuration",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://spring.io/guides/gs/rest-service/",
        },
        {
          session: 2,
          content: "Spring Boot Multi-tier RESTful API Project Setup",
          objectives: "Bootstrap enterprise layered architecture (Controller, Service, Repository, DTO)",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-SpringBoot-Architecture.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "2. RESTful Endpoints & Data Persistence",
      sessions: [
        {
          session: 3,
          content: "RESTful Standards, DTO Validation & @RestControllerAdvice Error Handling",
          objectives: "Author standard API responses, request validation, and uniform exception handlers",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://www.baeldung.com/spring-boot-bean-validation",
        },
        {
          session: 4,
          content: "Spring Data JPA, Custom JPQL Repositories & Specifications",
          objectives: "Implement dynamic filtering, pagination, sorting, and optimistic locking mechanisms",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-SpringDataJPA-Repositories.pdf",
        },
      ],
    },
    {
      id: 3,
      title: "3. Spring Security & Integration Testing",
      sessions: [
        {
          session: 5,
          content: "Spring Security 6, JWT Stateless Authentication & Role-Based Access Control",
          objectives: "Configure SecurityFilterChain, token issuance, filter validation, and @PreAuthorize checks",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html",
        },
        {
          session: 6,
          content: "Automated Integration Testing with MockMvc & Testcontainers",
          objectives: "Author comprehensive end-to-end tests validating secured API endpoints against isolated DB",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Security-Testcontainers.pdf",
        },
      ],
    },
    {
      id: 4,
      title: "4. Capstone Defense",
      sessions: [
        {
          session: 7,
          content: "Enterprise REST API Defense & Code Review Audit",
          objectives: "Deliver production-grade secured REST backend with OpenAPI/Swagger documentation",
          deliveryType: "Exam",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Exam-SpringBoot-Enterprise-Rubric.pdf",
        },
      ],
    },
  ],

  // Relational Database Design
  DATABASE_SQL: [
    {
      id: 1,
      title: "1. Relational Modeling & Schema Normalization",
      sessions: [
        {
          session: 1,
          content: "Entity-Relationship Modeling (ERD) & 1NF/2NF/3NF Normalization Principles",
          objectives: "Design clean relational schemas eliminating update/delete anomalies and data redundancy",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://www.postgresql.org/docs/current/tutorial.html",
        },
        {
          session: 2,
          content: "DDL Scripts, Constraints, Foreign Keys & Cascading Rules",
          objectives: "Author strict schema definitions enforcing referential integrity and composite keys",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-ERD-Schema-Design.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "2. Complex Query Formulation & Window Functions",
      sessions: [
        {
          session: 3,
          content: "Multi-table JOINs, Common Table Expressions (CTEs) & Window Analytical Functions",
          objectives: "Write high-performance reporting queries using PARTITION BY, RANK, and LEAD/LAG",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://mode.com/sql-tutorial/sql-window-functions/",
        },
        {
          session: 4,
          content: "Complex SQL Analytical Query Problem Solving",
          objectives: "Solve business analytics challenges requiring nested aggregations and recursive CTEs",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Complex-SQL-Queries.pdf",
        },
      ],
    },
    {
      id: 3,
      title: "3. Indexing Strategies & Performance Tuning",
      sessions: [
        {
          session: 5,
          content: "B-Tree Indexes, Composite Index Ordering & EXPLAIN ANALYZE Execution Plans",
          objectives: "Diagnose sequential scans, author covering indexes, and tune query execution cost",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://use-the-index-luke.com/",
        },
        {
          session: 6,
          content: "ACID Transactions, Isolation Levels & Stored Procedures",
          objectives: "Prevent dirty reads/phantom reads and author high-throughput stored procedures",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Indexing-Query-Optimization.pdf",
        },
      ],
    },
    {
      id: 4,
      title: "4. Database Final Evaluation",
      sessions: [
        {
          session: 7,
          content: "Theory Test (60m) & Live SQL Performance Optimization Exam (180m)",
          objectives: "Evaluate schema design, query tuning, and index optimization under high concurrency",
          deliveryType: "Exam",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Exam-SQL-Optimization.pdf",
        },
      ],
    },
  ],

  // React & TypeScript
  REACT_FRONTEND: [
    {
      id: 1,
      title: "1. Component Lifecycle, Hooks & Design Systems",
      sessions: [
        {
          session: 1,
          content: "React 18 Architecture, Virtual DOM & Core Hooks (useState, useEffect, useMemo)",
          objectives: "Construct responsive components adhering to clean functional programming paradigms",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://react.dev/learn",
        },
        {
          session: 2,
          content: "Custom Hooks & Tailwind CSS Responsive Component Library",
          objectives: "Extract reusable logic into custom hooks and style responsive UI components",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-React-Component-Library.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "2. State Management & REST API Integration",
      sessions: [
        {
          session: 3,
          content: "Data Fetching with Axios & TanStack Query (React Query)",
          objectives: "Manage server-side caching, background refetching, pagination, and optimistic updates",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://tanstack.com/query/latest",
        },
        {
          session: 4,
          content: "Global State Management with Context API & Zustand",
          objectives: "Maintain clean global auth state, user permissions, and persistent app configuration",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-React-State-API.pdf",
        },
      ],
    },
    {
      id: 3,
      title: "3. Routing, Charts & Data Visualization",
      sessions: [
        {
          session: 5,
          content: "React Router DOM, Protected Routes & Role-Based Navigation Guards",
          objectives: "Enforce route authorization guards and configure dynamic breadcrumbs and sub-navigation",
          deliveryType: "Concept/Lecture",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Online",
          materials: "https://reactrouter.com/",
        },
        {
          session: 6,
          content: "Interactive Dashboards & Recharts Data Visualization",
          objectives: "Render responsive pie charts, time allocation charts, and exportable data tables",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Dashboard-Charts.pdf",
        },
      ],
    },
    {
      id: 4,
      title: "4. Frontend Capstone Exam",
      sessions: [
        {
          session: 7,
          content: "Single Page Application Capstone Defense & Code Quality Review",
          objectives: "Deliver fully responsive enterprise data dashboard with 0 TypeScript/ESLint warnings",
          deliveryType: "Exam",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Exam-React-Frontend-Rubric.pdf",
        },
      ],
    },
  ],

  // Mock Project for Fresher (L4_MOCK_PROJECT)
  L4_MOCK_PROJECT: [
    {
      id: 1,
      title: "1. Project Inception, Architecture & Backlog Refinement",
      sessions: [
        {
          session: 1,
          content: "Business Requirement Specification (BRS) & Technical Architecture Design",
          objectives: "Deconstruct business requirements into domain models and system architecture diagrams",
          deliveryType: "Seminar/Workshop",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "BRS-Fresher-Mock-Project.pdf",
        },
        {
          session: 2,
          content: "Database Schema Design, API Contracts & Gitflow Branching Conventions",
          objectives: "Establish team coding standards, OpenAPI documentation, and CI pipeline checks",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Architecture-API-Specs.pdf",
        },
      ],
    },
    {
      id: 2,
      title: "2. Sprint Execution & Enterprise Feature Development",
      sessions: [
        {
          session: 3,
          content: "Sprint 1 - Core Authentication, User Management & RBAC Permissions",
          objectives: "Implement JWT login, refresh tokens, role authorizations, and audit tracking",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Sprint-1-Backlog.pdf",
        },
        {
          session: 4,
          content: "Sprint 2 - Primary Business Workflow & Transactional Services",
          objectives: "Implement core business entities, optimistic locking, and complex database transactions",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Sprint-2-Backlog.pdf",
        },
        {
          session: 5,
          content: "Sprint 3 - Analytical Dashboards, Chart Visualizations & Batch Import/Export",
          objectives: "Build asynchronous Excel/CSV data ingestion pipelines and interactive Recharts views",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Sprint-3-Backlog.pdf",
        },
      ],
    },
    {
      id: 3,
      title: "3. Quality Assurance & Container Deployment",
      sessions: [
        {
          session: 6,
          content: "Automated Integration Testing & Static Code Analysis with SonarQube",
          objectives: "Ensure 80%+ test coverage with Mockito, MockMvc, and resolve critical security hotspots",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-QA-Testing-SonarQube.pdf",
        },
        {
          session: 7,
          content: "Docker Containerization, Docker Compose & Staging Deployment",
          objectives: "Containerize frontend, backend, and PostgreSQL database for one-click deployment",
          deliveryType: "Assignment/Lab",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Lab-Docker-Staging-Deploy.pdf",
        },
      ],
    },
    {
      id: 4,
      title: "4. Final Defense & Assessment",
      sessions: [
        {
          session: 8,
          content: "Final Project Committee Defense & Customer Acceptance Demonstration",
          objectives: "Present working enterprise system to audit panel, defend architectural trade-offs, and pass review",
          deliveryType: "Exam",
          duration: "4h",
          durationHours: 4,
          trainingFormat: "Offline",
          materials: "Rubric-Mock-Project-Defense.pdf",
        },
      ],
    },
  ],

  // Softskills: Culture & Global Mindset
  L1_AL_CCGM: [
    {
      id: 1,
      title: "1. Corporate Culture & Global Professional Mindset",
      sessions: [
        {
          session: 1,
          content: "Corporate Culture, Values & Professional Ethics in Global Tech Environment",
          objectives: "Align with professional workplace norms, corporate compliance, and team value systems",
          deliveryType: "Concept/Lecture",
          duration: "2h",
          durationHours: 2,
          trainingFormat: "Offline",
          materials: "Global-Mindset-Handbook.pdf",
        },
      ],
    },
  ],
};

// Storage key prefix for custom saved syllabi per topic
const STORAGE_PREFIX = "fams_custom_syllabus_";

export function getCustomTopicSyllabus(topicId: number | string): TopicChapter[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${topicId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read custom syllabus from storage", e);
  }
  return null;
}

export function hasCustomTopicSyllabus(topicId: number | string): boolean {
  return getCustomTopicSyllabus(topicId) !== null;
}

export function saveTopicSyllabusPackage(
  topicId: number | string,
  chapters: TopicChapter[],
  topic: TopicItem
): TopicSyllabusPackage {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${topicId}`, JSON.stringify(chapters));
    if (topic.code) {
      localStorage.setItem(`${STORAGE_PREFIX}${topic.code}`, JSON.stringify(chapters));
    }
  } catch (e) {
    console.error("Failed to save custom syllabus to storage", e);
  }
  return calculateSyllabusPackage(chapters, topic);
}

export function resetTopicSyllabusPackage(topicId: number | string, topicCode?: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${topicId}`);
    if (topicCode) {
      localStorage.removeItem(`${STORAGE_PREFIX}${topicCode}`);
    }
  } catch (e) {
    console.error("Failed to reset custom syllabus from storage", e);
  }
}

// Helper to compute metrics, time allocations and assessment scheme for any chapters list
export function calculateSyllabusPackage(
  chapters: TopicChapter[],
  topic: TopicItem
): TopicSyllabusPackage {
  if (!chapters || chapters.length === 0) {
    return {
      chapters: [],
      totalSessions: 0,
      timeAllocation: {
        lab: 0,
        lecture: 0,
        exam: 0,
        total: 0,
      },
      assessmentScheme: [],
    };
  }

  const code = (topic.code || "").toUpperCase();
  let totalSessions = 0;
  let labHours = 0;
  let lectureHours = 0;
  let examHours = 0;

  chapters.forEach((ch) => {
    ch.sessions.forEach((sess) => {
      totalSessions++;
      const hrs = Number(sess.durationHours) || 0;
      if (sess.deliveryType === "Assignment/Lab" || sess.deliveryType === "Seminar/Workshop") {
        labHours += hrs;
      } else if (sess.deliveryType === "Exam" || sess.deliveryType === "Test/Quiz") {
        examHours += hrs;
      } else {
        lectureHours += hrs;
      }
    });
  });

  const totalCalculatedHours = labHours + lectureHours + examHours;
  const totalH = totalCalculatedHours > 0 ? totalCalculatedHours : (topic.durationHours || 0);

  // Tailor assessment scheme to topic type
  const isSoftSkill = topic.technicalGroup?.toLowerCase().includes("soft") || code.startsWith("L1_AL");
  const isProject = code.includes("PROJECT") || code.includes("MOCK");

  let assessmentScheme: AssessmentItem[];
  if (isProject) {
    assessmentScheme = [
      { category: "Sprint Progress & Tasks", method: "Agile sprint backlog deliverables & git commits", passingScore: ">= 6.0 / 10", weight: "30%" },
      { category: "Code Quality & Automated Tests", method: "SonarQube code smell audit & JUnit 5 test suite", passingScore: ">= 6.0 / 10", weight: "30%" },
      { category: "Final Committee Defense", method: "Live system demo, architecture defense & Q&A review", passingScore: ">= 6.0 / 10", weight: "40%" },
    ];
  } else if (isSoftSkill) {
    assessmentScheme = [
      { category: "Class Attendance & Engagement", method: "Active participation in team exercises & discussions", passingScore: ">= 80%", weight: "20%" },
      { category: "Practical Group Workshop", method: "Team simulation, role-play presentation & peer review", passingScore: ">= 6.0 / 10", weight: "40%" },
      { category: "Final Reflective Assessment", method: "Written scenario evaluation & personal action plan", passingScore: ">= 6.0 / 10", weight: "40%" },
    ];
  } else {
    assessmentScheme = [
      { category: "Quiz", method: "Online multiple-choice quizzes via LMS portal", passingScore: ">= 6.0 / 10", weight: "20%" },
      { category: "Assignment / Lab", method: "Hands-on coding problems & pull request review", passingScore: ">= 6.0 / 10", weight: "30%" },
      { category: "Final Test", method: "Theory examination (60m) + Practice examination (180m)", passingScore: ">= 6.0 / 10", weight: "50%" },
    ];
  }

  return {
    chapters,
    totalSessions,
    timeAllocation: {
      lab: labHours,
      lecture: lectureHours,
      exam: examHours,
      total: totalH,
    },
    assessmentScheme,
  };
}

// Generate template chapters matching exact target hours
export function generateTemplateChapters(topic: TopicItem): TopicChapter[] {
  const targetH = Math.max(topic.durationHours || 40, 4);
  const name = topic.name || "Topic Modules";
  const code = topic.code || "TOPIC";
  const group = topic.technicalGroup || "Engineering";

  // Divide into 3 to 4 chapters
  const numChapters = targetH >= 30 ? 4 : targetH >= 16 ? 3 : 2;
  const sessionsPerChapter = 2;
  const totalSessions = numChapters * sessionsPerChapter;
  const baseSessionH = Math.max(1, Math.floor(targetH / totalSessions));
  const remainder = targetH - baseSessionH * totalSessions;

  const chapters: TopicChapter[] = [];
  let currentSessionNumber = 1;
  let remainingHoursToAdd = remainder;

  const chapterThemes = [
    { title: "1. Core Foundations & Environment Setup", topic: "Fundamentals & Architecture" },
    { title: "2. Deep Dive & Core Implementation", topic: "Advanced Implementation & Clean Code" },
    { title: "3. Applied Scenarios & Best Practices", topic: "Enterprise Patterns & Optimization" },
    { title: "4. Practical Review & Comprehensive Assessment", topic: "Comprehensive Evaluation" },
  ];

  for (let chIdx = 0; chIdx < numChapters; chIdx++) {
    const theme = chapterThemes[chIdx] || {
      title: `${chIdx + 1}. Advanced Module & Practical Lab`,
      topic: "Modular Practices",
    };

    const isLastChapter = chIdx === numChapters - 1;
    const chSessions: TopicSession[] = [];

    // Session 1 of chapter
    let sess1Hours = baseSessionH;
    if (remainingHoursToAdd > 0) {
      sess1Hours += 1;
      remainingHoursToAdd -= 1;
    }

    const sess1Delivery: TopicSession["deliveryType"] = isLastChapter
      ? "Guides/Review"
      : "Concept/Lecture";

    chSessions.push({
      session: currentSessionNumber++,
      content: isLastChapter
        ? `${name} - Comprehensive Review & Q&A Workshop`
        : `${name} - ${theme.topic} Theory & Concepts`,
      objectives: `Understand foundational concepts, workflow architecture, and engineering principles in ${group}`,
      deliveryType: sess1Delivery,
      duration: `${sess1Hours}h`,
      durationHours: sess1Hours,
      trainingFormat: "Online",
      materials: `https://docs.oracle.com/en/java/`,
    });

    // Session 2 of chapter
    let sess2Hours = baseSessionH;
    if (remainingHoursToAdd > 0) {
      sess2Hours += 1;
      remainingHoursToAdd -= 1;
    }

    const sess2Delivery: TopicSession["deliveryType"] = isLastChapter
      ? "Exam"
      : "Assignment/Lab";

    chSessions.push({
      session: currentSessionNumber++,
      content: isLastChapter
        ? `Theoretical Final Test (60m) & Practical Capstone Exam (180m)`
        : `Hands-on Lab Exercise: ${theme.topic} Assignment`,
      objectives: isLastChapter
        ? `Evaluate comprehensive competencies, problem solving, and applied skills in ${name}`
        : `Implement practical exercises, unit tests, and code reviews under mentor guidance`,
      deliveryType: sess2Delivery,
      duration: `${sess2Hours}h`,
      durationHours: sess2Hours,
      trainingFormat: "Offline",
      materials: isLastChapter
        ? `Exam-Rubric-${code}.pdf`
        : `Lab-Assignment-${code}-Ch${chIdx + 1}.pdf`,
    });

    chapters.push({
      id: chIdx + 1,
      title: theme.title,
      sessions: chSessions,
    });
  }

  return chapters;
}

// 3. Main Resolver: returns chapters, accurate time allocations, and tailored assessment scheme
export function getTopicSyllabusPackage(topic: TopicItem): TopicSyllabusPackage {
  // Check custom saved syllabus first (by id or code)
  const custom = (topic.id ? getCustomTopicSyllabus(topic.id) : null) || getCustomTopicSyllabus(topic.code);
  if (custom && custom.length > 0) {
    return calculateSyllabusPackage(custom, topic);
  }

  // Exact match only for specific predefined seed syllabus (e.g. L2_JA_ORM demo from FAMS video)
  const code = (topic.code || "").toUpperCase().trim();
  if (code && CURATED_SYLLABI[code]) {
    return calculateSyllabusPackage(CURATED_SYLLABI[code], topic);
  }

  // If user hasn't added any chapters, keep it completely empty. Do NOT generate fake data!
  return {
    chapters: [],
    totalSessions: 0,
    timeAllocation: {
      lab: 0,
      lecture: 0,
      exam: 0,
      total: 0,
    },
    assessmentScheme: [],
  };
}

