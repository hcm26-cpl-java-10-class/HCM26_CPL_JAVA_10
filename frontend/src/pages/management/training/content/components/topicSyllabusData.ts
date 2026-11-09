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
  durationMins?: number;
  trainingFormat: "Online" | "Offline";
  materials: string;
}

export interface TopicChapter {
  id: number;
  unitNumber?: number;
  title: string;
  sessions: TopicSession[];
}

export interface AssessmentItem {
  category: string;
  count?: number;
  method: string;
  passingScore: string;
  weight: string;
  notes?: string;
}

export interface SyllabusDocumentMeta {
  documentCode?: string;
  version?: string;
  effectiveDate?: string;
  trainingAudience?: string;
  courseObjectives?: string;
  topicOutline?: string;
  deliveryPrinciples?: Record<string, string>;
}

export interface TopicSyllabusPackage {
  meta?: SyllabusDocumentMeta;
  chapters: TopicChapter[];
  totalSessions: number;
  totalMins?: number;
  timeAllocation: {
    lab: number;
    lecture: number;
    exam: number;
    total: number;
  };
  assessmentScheme: AssessmentItem[];
}

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

  let totalSessions = 0;
  let labHours = 0;
  let lectureHours = 0;
  let examHours = 0;

  for (const ch of chapters) {
    for (const sess of ch.sessions || []) {
      totalSessions += 1;
      const h = sess.durationHours || 0;
      if (sess.deliveryType === "Assignment/Lab" || sess.deliveryType === "Seminar/Workshop") {
        labHours += h;
      } else if (sess.deliveryType === "Exam" || sess.deliveryType === "Test/Quiz") {
        examHours += h;
      } else {
        lectureHours += h;
      }
    }
  }

  const totalCalculated = labHours + lectureHours + examHours;
  const targetDuration = topic.durationHours || totalCalculated;

  // Derive realistic assessment items from chapters
  const hasExam = examHours > 0;
  const assessmentScheme: AssessmentItem[] = [
    {
      category: "Class Participation & Attendance",
      count: 1,
      method: "Daily attendance roll-call, seminar discussion & active engagement",
      passingScore: ">= 80%",
      weight: "10%",
      notes: "Daily roll-call",
    },
    {
      category: "Hands-on Assignments & Lab Exercises",
      count: 2,
      method: "Evaluation of practical lab problems, code cleanlines & Git commit history",
      passingScore: ">= 6.0 / 10",
      weight: hasExam ? "40%" : "50%",
      notes: "Practical assignments",
    },
  ];

  if (hasExam) {
    assessmentScheme.push(
      {
        category: "Final Practical Examination",
        count: 1,
        method: "Comprehensive capstone coding exam covering core competencies",
        passingScore: ">= 6.0 / 10",
        weight: "35%",
        notes: "Final practice test",
      },
      {
        category: "Final Knowledge Quiz",
        count: 1,
        method: "Multiple-choice online assessment on key concepts & best practices",
        passingScore: ">= 6.0 / 10",
        weight: "15%",
        notes: "Final theory test",
      }
    );
  } else {
    assessmentScheme.push({
      category: "Capstone Mini-Project",
      count: 1,
      method: "End-of-module functional prototype review & presentation",
      passingScore: ">= 6.0 / 10",
      weight: "40%",
      notes: "Final capstone project",
    });
  }

  return {
    chapters,
    totalSessions,
    totalMins: Math.round(totalCalculated * 60),
    timeAllocation: {
      lab: labHours,
      lecture: lectureHours,
      exam: examHours,
      total: totalCalculated > 0 ? totalCalculated : targetDuration,
    },
    assessmentScheme,
  };
}

// 2. Blueprint generator used ONLY when user clicks "Auto-generate Template" in outline editor
export function generateTemplateChapters(topic: TopicItem): TopicChapter[] {
  const targetH = topic.durationHours && topic.durationHours > 0 ? topic.durationHours : 32;
  const name = topic.name || "Topic";
  const code = topic.code || "TOPIC";
  const group = topic.technicalGroup || "Engineering";

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
      duration: `${sess1Hours}h (${sess1Hours * 60}m)`,
      durationHours: sess1Hours,
      durationMins: sess1Hours * 60,
      trainingFormat: "Online",
      materials: `https://docs.oracle.com/en/java/`,
    });

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
      duration: `${sess2Hours}h (${sess2Hours * 60}m)`,
      durationHours: sess2Hours,
      durationMins: sess2Hours * 60,
      trainingFormat: "Offline",
      materials: isLastChapter
        ? `Exam-Rubric-${code}.pdf`
        : `Lab-Assignment-${code}-Ch${chIdx + 1}.pdf`,
    });

    chapters.push({
      id: chIdx + 1,
      unitNumber: chIdx + 1,
      title: theme.title,
      sessions: chSessions,
    });
  }

  return chapters;
}

// 3. Main Resolver: returns custom syllabus if configured by user; otherwise returns completely empty state.
export function getTopicSyllabusPackage(topic: TopicItem): TopicSyllabusPackage {
  // Check custom saved syllabus first (by id or code)
  const custom = (topic.id ? getCustomTopicSyllabus(topic.id) : null) || getCustomTopicSyllabus(topic.code);
  if (custom && custom.length > 0) {
    return calculateSyllabusPackage(custom, topic);
  }

  // If user has not added any chapters yet, return empty state. NO hardcoded fake data!
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
