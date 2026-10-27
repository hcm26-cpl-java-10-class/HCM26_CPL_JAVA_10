import type {
  LearningCourse,
  DailyActivity,
  LearningStatsSummary,
  CertificateInfo,
} from "./learning.types";
import type { Enrollment } from "@/types";

export const INITIAL_LEARNING_COURSES: LearningCourse[] = [
  {
    id: "c-1",
    courseId: 101,
    title: "Advanced Java Microservices",
    skill: "Java",
    provider: "LearnQuest",
    lastAccessed: "2 hours ago",
    progress: 65,
    status: "in_progress",
    estimatedCompletion: "Nov 19, 2026",
    nextItem: {
      title: "Static Members - Knowledge Check",
      type: "assignment",
      duration: "Practice Assignment (9 minutes)",
      link: "/courses",
    },
  },
  {
    id: "c-2",
    courseId: 102,
    title: "Agile Leadership & Scrum Master",
    skill: "Agile",
    provider: "Scrum Alliance / FAMS",
    lastAccessed: "Yesterday",
    progress: 40,
    status: "in_progress",
    estimatedCompletion: "Dec 05, 2026",
    nextItem: {
      title: "Sprint Planning & Estimation Workshop",
      type: "lesson",
      duration: "Interactive Workshop (25 minutes)",
      link: "/courses",
    },
  },
  {
    id: "c-3",
    courseId: 103,
    title: "Modern Curriculum Design & Assessment",
    skill: "Curriculum",
    provider: "UC Irvine / FAMS Academy",
    lastAccessed: "3 days ago",
    progress: 85,
    status: "in_progress",
    estimatedCompletion: "Nov 08, 2026",
    nextItem: {
      title: "Rubric Generation & Peer Review",
      type: "quiz",
      duration: "Graded Quiz (15 minutes)",
      link: "/courses",
    },
  },
  {
    id: "c-4",
    courseId: 104,
    title: "Java Core & Spring Boot 3 Deep Dive",
    skill: "Java",
    provider: "LearnQuest",
    lastAccessed: "Oct 15, 2026",
    progress: 100,
    status: "completed",
    completedDate: "Oct 15, 2026",
    score: 95,
    certificate: {
      id: "CERT-JV-2026-9812",
      courseTitle: "Java Core & Spring Boot 3 Deep Dive",
      issuer: "LearnQuest & FAMS Academy",
      issuedDate: "October 15, 2026",
      score: 95,
      grade: "Passed with Distinction",
      recipientName: "Admin User",
    },
  },
  {
    id: "c-5",
    courseId: 105,
    title: "Agile Project Delivery & Kanban Workshop",
    skill: "Agile",
    provider: "Scrum Alliance",
    lastAccessed: "Sep 28, 2026",
    progress: 100,
    status: "completed",
    completedDate: "Sep 28, 2026",
    score: 92,
    certificate: {
      id: "CERT-AG-2026-4431",
      courseTitle: "Agile Project Delivery & Kanban Workshop",
      issuer: "Scrum Alliance",
      issuedDate: "September 28, 2026",
      score: 92,
      grade: "Passed",
      recipientName: "Admin User",
    },
  },
  {
    id: "c-6",
    courseId: 106,
    title: "Instructional Design & Curriculum Standard",
    skill: "Curriculum",
    provider: "UC Irvine",
    lastAccessed: "Aug 19, 2026",
    progress: 100,
    status: "completed",
    completedDate: "Aug 19, 2026",
    score: 88,
    certificate: {
      id: "CERT-ID-2026-1189",
      courseTitle: "Instructional Design & Curriculum Standard",
      issuer: "UC Irvine Extension",
      issuedDate: "August 19, 2026",
      score: 88,
      grade: "Passed",
      recipientName: "Admin User",
    },
  },
  {
    id: "c-7",
    courseId: 107,
    title: "Enterprise Java Concurrency & Reactive Systems",
    skill: "Java",
    provider: "Oracle University & FAMS",
    lastAccessed: "Jul 04, 2026",
    progress: 100,
    status: "completed",
    completedDate: "Jul 04, 2026",
    score: 94,
    certificate: {
      id: "CERT-EJ-2026-7732",
      courseTitle: "Enterprise Java Concurrency & Reactive Systems",
      issuer: "Oracle University",
      issuedDate: "July 04, 2026",
      score: 94,
      grade: "Passed with Distinction",
      recipientName: "Admin User",
    },
  },
];

export const INITIAL_SAVED_COURSES: LearningCourse[] = [];

// Merges backend enrollments with learning courses
export function mergeEnrollmentsWithCourses(
  existingCourses: LearningCourse[],
  backendEnrollments: Enrollment[] = []
): LearningCourse[] {
  if (!backendEnrollments || backendEnrollments.length === 0) {
    return existingCourses;
  }

  const existingCourseIds = new Set(existingCourses.map((c) => c.courseId));
  const newFromBackend: LearningCourse[] = [];

  for (const enrollment of backendEnrollments) {
    if (!existingCourseIds.has(enrollment.courseId)) {
      newFromBackend.push({
        id: `enrollment-${enrollment.id}`,
        courseId: enrollment.courseId,
        title: enrollment.courseName || `Course #${enrollment.courseId}`,
        skill: "LMS",
        provider: enrollment.instructor || "FAMS Academy",
        lastAccessed: enrollment.enrolledAt ? `Enrolled ${enrollment.enrolledAt.slice(0, 10)}` : "Recently",
        progress: 0,
        status: "in_progress",
        estimatedCompletion: "TBD",
        nextItem: {
          title: "Introduction & Course Overview",
          type: "lesson",
          duration: "Introductory module (10 minutes)",
          link: `/courses`,
        },
      });
    }
  }

  return [...existingCourses, ...newFromBackend];
}

// Learning statistics calculator
export function calculateLearningSummary(courses: LearningCourse[]) {
  const inProgressCourses = courses.filter((c) => c.status === "in_progress");
  const completedCourses = courses.filter((c) => c.status === "completed");
  const savedCourses = courses.filter((c) => c.status === "saved");
  const certificates = courses
    .filter((c) => !!c.certificate)
    .map((c) => c.certificate as CertificateInfo);

  const total = inProgressCourses.length + completedCourses.length;
  const overallProgress = total > 0 ? Math.round((completedCourses.length / total) * 100) : 0;

  return {
    inProgressCount: inProgressCourses.length,
    completedCount: completedCourses.length,
    savedCount: savedCourses.length,
    totalEnrolled: total,
    certificatesCount: certificates.length,
    overallProgress,
    certificates,
    inProgressCourses,
    completedCourses,
    savedCourses,
  };
}

// Activity data corresponding to current month (October 2026)
export const MONTHLY_ACTIVITY_DATA: Record<string, DailyActivity> = {
  "2026-10-05": { date: "2026-10-05", completedGoals: 1, allGoalsCompleted: false, minutesLearned: 35, itemsCount: 2 },
  "2026-10-07": { date: "2026-10-07", completedGoals: 2, allGoalsCompleted: true, minutesLearned: 60, itemsCount: 3 },
  "2026-10-12": { date: "2026-10-12", completedGoals: 1, allGoalsCompleted: false, minutesLearned: 40, itemsCount: 1 },
  "2026-10-14": { date: "2026-10-14", completedGoals: 2, allGoalsCompleted: true, minutesLearned: 75, itemsCount: 4 },
  "2026-10-19": { date: "2026-10-19", completedGoals: 1, allGoalsCompleted: false, minutesLearned: 25, itemsCount: 1 },
  "2026-10-21": { date: "2026-10-21", completedGoals: 2, allGoalsCompleted: true, minutesLearned: 50, itemsCount: 2 },
  "2026-10-26": { date: "2026-10-26", completedGoals: 1, allGoalsCompleted: false, minutesLearned: 45, itemsCount: 2 },
  "2026-10-27": { date: "2026-10-27", completedGoals: 1, allGoalsCompleted: false, minutesLearned: 30, itemsCount: 1 },
};

export const LEARNING_STATS_LAST_4_WEEKS: LearningStatsSummary = {
  dailyGoalsCompleted: 8,
  itemsCompleted: 16,
  minutesLearned: 360,
};
