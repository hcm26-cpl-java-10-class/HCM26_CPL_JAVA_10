import type {
  TopicChapter,
  TopicSession,
  AssessmentItem,
  TopicSyllabusPackage,
  SyllabusDocumentMeta,
} from "./topicSyllabusData";
import type { TopicItem } from "@/types/features/content";

export interface ParsedSyllabus {
  documentCode: string;
  version: string;
  effectiveDate: string;
  technicalGroup: string;
  topicName: string;
  topicCode: string;
  trainingAudience: string;
  courseObjectives: string;
  topicOutline: string;
  timeAllocation: Record<string, { mins: number; percentage: number }>;
  assessmentScheme: AssessmentItem[];
  deliveryPrinciples: Record<string, string>;
  chapters: TopicChapter[];
  totalDurationMins: number;
  totalDurationHours: number;
  totalSessions: number;
}

/**
 * Standard RFC-4180 CSV parser that properly handles multiline cells and quotes.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  // Clean UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.substring(1);
  }

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && nextChar === "\n") {
          i++; // skip \n
        }
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Normalizes delivery type string to valid TopicSession delivery type
 */
function normalizeDeliveryType(raw: string): TopicSession["deliveryType"] {
  const s = (raw || "").trim().toLowerCase();
  if (s.includes("concept") || s.includes("lecture")) return "Concept/Lecture";
  if (s.includes("seminar") || s.includes("workshop")) return "Seminar/Workshop";
  if (s.includes("lab") || s.includes("assignment")) return "Assignment/Lab";
  if (s.includes("guide") || s.includes("review")) return "Guides/Review";
  if (s.includes("quiz") || s.includes("test")) return "Test/Quiz";
  if (s.includes("exam") || s.includes("final")) return "Exam";
  if (s.includes("meeting")) return "Class Meeting";
  return "Concept/Lecture";
}

/**
 * Comprehensive Parser for the official FSOFT / FPT Syllabus CSV structure.
 */
export function parseFsoftSyllabusCsv(csvText: string): ParsedSyllabus {
  const rows = parseCsvRows(csvText);

  let documentCode = "26e-BM/HR/HDCV/FSOFT";
  let version = "1.0";
  let effectiveDate = "";
  let technicalGroup = "Java";
  let topicName = "";
  let topicCode = "";
  let trainingAudience = "";
  let courseObjectives = "";
  let topicOutline = "";
  const timeAllocation: Record<string, { mins: number; percentage: number }> = {};
  const assessmentScheme: AssessmentItem[] = [];
  const deliveryPrinciples: Record<string, string> = {};

  const chapters: TopicChapter[] = [];
  let currentChapter: TopicChapter | null = null;
  let sessionCounter = 1;
  let inScheduleSection = false;
  let scheduleHeaderFound = false;

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    const rowStr = row.join(" ").toLowerCase();

    // 1. Detect Document Metadata
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] || "";
      if (cell.includes("Document Code") && row[c + 1]) {
        documentCode = row[c + 1] || row[c + 2] || row[c + 3] || documentCode;
      }
      if (cell.includes("Effective Date") && row[c + 1]) {
        effectiveDate = row[c + 1] || row[c + 2] || row[c + 3] || effectiveDate;
      }
    }

    // 2. Detect General Topic Properties (Numbered items 1-11)
    const firstCell = (row[0] || "").trim();
    const secondCell = (row[1] || "").trim();
    const thirdCell = (row[2] || "").trim();

    if (secondCell.includes("Technical Group") || firstCell.includes("Technical Group")) {
      technicalGroup = thirdCell || row[3] || row[2] || technicalGroup;
    } else if (secondCell.includes("Topic Name") || firstCell.includes("Topic Name")) {
      topicName = thirdCell || row[3] || row[2] || topicName;
    } else if (secondCell.includes("Topic Code") || firstCell.includes("Topic Code")) {
      topicCode = thirdCell || row[3] || row[2] || topicCode;
    } else if ((secondCell.toLowerCase() === "version" || firstCell.toLowerCase() === "version") && !inScheduleSection) {
      version = thirdCell || row[3] || row[2] || version;
    } else if (secondCell.includes("Training Audience") || firstCell.includes("Training Audience")) {
      trainingAudience = thirdCell || row[3] || row[2] || "";
    } else if (secondCell.includes("Course Objectives") || firstCell.includes("Course Objectives")) {
      courseObjectives = thirdCell || row[3] || row[2] || "";
    } else if (secondCell.includes("Topic Outline") || firstCell.includes("Topic Outline")) {
      topicOutline = thirdCell || row[3] || row[2] || "";
    }

    // 3. Detect Assessment Scheme items
    if (secondCell.includes("Assessment Scheme") || firstCell.includes("Assessment Scheme")) {
      const category = row[2] || "";
      const count = parseInt(row[3] || "1", 10);
      const weight = row[4] ? `${row[4]}%` : "20%";
      const notes = row[5] || "";
      if (category) {
        assessmentScheme.push({
          category,
          count: isNaN(count) ? 1 : count,
          weight,
          notes,
          method: notes || `${category} evaluation`,
          passingScore: ">= 6.0 / 10",
        });
      }
    } else if (
      rIdx > 15 &&
      !inScheduleSection &&
      (secondCell === "" || secondCell === "Pass Criteria") &&
      row[2] &&
      (row[2].includes("Test") || row[2].includes("Quiz") || row[2].includes("Pass Criteria"))
    ) {
      const category = row[2];
      if (category === "Pass Criteria") {
        deliveryPrinciples["Pass Criteria"] = row[4] || row[3] || "";
      } else {
        const count = parseInt(row[3] || "1", 10);
        const weight = row[4] ? `${row[4]}%` : "";
        const notes = row[5] || "";
        assessmentScheme.push({
          category,
          count: isNaN(count) ? 1 : count,
          weight: weight || "30%",
          notes,
          method: notes || `${category} assessment`,
          passingScore: ">= 6.0 / 10",
        });
      }
    }

    // 4. Detect Training Delivery Principles
    if (secondCell.includes("Training Delivery Principles") || firstCell.includes("Training Delivery Principles")) {
      const key = row[2] || "";
      const val = row[3] || row[4] || "";
      if (key) deliveryPrinciples[key] = val;
    } else if (
      rIdx > 20 &&
      !inScheduleSection &&
      row[2] &&
      ["Trainees", "Trainer", "Training", "Re-Test", "Marking", "Waiver Criteria"].includes(row[2].trim())
    ) {
      deliveryPrinciples[row[2].trim()] = row[3] || row[4] || "";
    }

    // 5. Detect Training Schedule (scheduleDetail) section
    if (rowStr.includes("training schedule") || rowStr.includes("schedule breakdown")) {
      inScheduleSection = true;
      continue;
    }

    if (inScheduleSection && (rowStr.includes("training unit") || (rowStr.includes("session") && rowStr.includes("delivery type")))) {
      scheduleHeaderFound = true;
      continue;
    }

    // Check end of schedule section
    if (inScheduleSection && (rowStr.includes("authorship") || rowStr.includes("record of changes") || rowStr.includes("total,1560"))) {
      inScheduleSection = false;
      continue;
    }

    // Parse Schedule Rows
    if (inScheduleSection && scheduleHeaderFound) {
      const colUnitNum = (row[0] || "").trim();
      const colUnitTitle = (row[1] || "").trim();
      const colSession = (row[2] || "").trim();
      const colContent = (row[3] || "").trim();
      const colObjectives = (row[4] || "").trim();
      const colDeliveryType = (row[5] || "").trim();
      const colDurationMins = parseInt((row[6] || "").replace(/[^0-9]/g, ""), 10);
      const colFormat = (row[7] || "").trim();
      const colMaterials = (row[8] || "").trim();

      // If this row starts a new Unit/Chapter
      if (colUnitNum && !isNaN(parseInt(colUnitNum, 10)) && colUnitTitle) {
        currentChapter = {
          id: parseInt(colUnitNum, 10),
          unitNumber: parseInt(colUnitNum, 10),
          title: `${colUnitNum}. ${colUnitTitle}`,
          sessions: [],
        };
        chapters.push(currentChapter);
      } else if (colUnitTitle && !currentChapter) {
        currentChapter = {
          id: chapters.length + 1,
          unitNumber: chapters.length + 1,
          title: `${chapters.length + 1}. ${colUnitTitle}`,
          sessions: [],
        };
        chapters.push(currentChapter);
      }

      // If this row has a session or content activity
      if (colContent && colDeliveryType) {
        if (!currentChapter) {
          currentChapter = {
            id: 1,
            unitNumber: 1,
            title: "1. Core Module Units",
            sessions: [],
          };
          chapters.push(currentChapter);
        }

        const sessNum = colSession && !isNaN(parseInt(colSession, 10))
          ? parseInt(colSession, 10)
          : sessionCounter;
        sessionCounter = Math.max(sessionCounter, sessNum + 1);

        const durationMins = isNaN(colDurationMins) ? 120 : colDurationMins;
        const durationHours = Math.round((durationMins / 60) * 10) / 10;

        const sessionItem: TopicSession = {
          session: sessNum,
          content: colContent,
          objectives: colObjectives || `Master ${colContent.split("\n")[0] || "core concept"} and practice effectively`,
          deliveryType: normalizeDeliveryType(colDeliveryType),
          duration: `${durationHours}h (${durationMins}m)`,
          durationHours,
          durationMins,
          trainingFormat: colFormat.toLowerCase().includes("online") ? "Online" : "Offline",
          materials: colMaterials || "Official Course Materials / LMS",
        };

        currentChapter.sessions.push(sessionItem);
      }
    }
  }

  // Calculate totals from parsed chapters
  let totalMins = 0;
  let totalSessions = 0;
  for (const ch of chapters) {
    for (const s of ch.sessions) {
      totalSessions++;
      totalMins += s.durationMins || Math.round(s.durationHours * 60);
    }
  }
  const totalDurationHours = Math.round((totalMins / 60) * 10) / 10;

  // Fallback assessment scheme if file didn't specify one
  if (assessmentScheme.length === 0) {
    assessmentScheme.push(
      { category: "Daily Quizzes", count: 2, weight: "20%", passingScore: ">= 6.0/10", method: "Online quick quiz", notes: "2 quizzes" },
      { category: "Final Theory Test", count: 1, weight: "30%", passingScore: ">= 6.0/10", method: "Theoretical test", notes: "Final theory" },
      { category: "Final Practice Test", count: 1, weight: "50%", passingScore: ">= 6.0/10", method: "Capstone practical evaluation", notes: "Final practice" }
    );
  }

  return {
    documentCode,
    version: version || "1.0",
    effectiveDate: effectiveDate || new Date().toLocaleDateString("en-GB"),
    technicalGroup: technicalGroup || "Java",
    topicName: topicName || "Imported Topic",
    topicCode: topicCode || "TOPIC-01",
    trainingAudience,
    courseObjectives,
    topicOutline,
    timeAllocation,
    assessmentScheme,
    deliveryPrinciples,
    chapters,
    totalDurationMins: totalMins,
    totalDurationHours,
    totalSessions,
  };
}

/**
 * Exports a Topic and its Syllabus Schedule Detail to the exact official FSOFT CSV template.
 */
export function exportFsoftSyllabusCsv(topic: TopicItem, pkg: TopicSyllabusPackage): string {
  const meta: SyllabusDocumentMeta = pkg.meta || {};
  const docCode = meta.documentCode || "26e-BM/HR/HDCV/FSOFT";
  const ver = topic.version || meta.version || "1.0";
  const effDate = meta.effectiveDate || "24/04/2020";
  const name = topic.name || "Topic";
  const code = topic.code || "TOPIC";
  const group = topic.technicalGroup || "Java";
  const audience = meta.trainingAudience || "Trainees with basic programming background";
  const objectives = topic.description || meta.courseObjectives || "Introduce essential domain knowledge and skills.";
  const outline = meta.topicOutline || pkg.chapters.map((c) => `- ${c.title}`).join("\n");

  const lines: string[] = [];

  // Header document block
  lines.push(",,,,,,,,");
  lines.push(`,Fresher,,,,,,,`);
  lines.push(`,${name.toUpperCase()} SYLLABUS,,,,,,,`);
  lines.push(",,,,,,,,");
  lines.push(`,,,,,Document Code,,,${docCode}`);
  lines.push(`,,,,,Version,,,${ver}`);
  lines.push(`,,,,,Effective Date,,,${effDate}`);
  lines.push(`${name} Syllabus,,,,,`);

  // Section 1-11
  lines.push(`1,Technical Group,"${group}",,,`);
  lines.push(`2,Topic Name,"${name}",,,`);
  lines.push(`3,Topic Code,"${code}",,,`);
  lines.push(`4,Version,"${ver}",,,`);
  lines.push(`5,Training Audience,"${audience.replace(/"/g, '""')}",,,`);
  lines.push(`6,Course Objectives,"${objectives.replace(/"/g, '""')}",,,`);
  lines.push(`7,Topic Outline,"${outline.replace(/"/g, '""')}",,,`);

  // Section 8: Time Allocation
  const time = pkg.timeAllocation;
  const totalH = time.total || 32;
  lines.push(`8,Time Allocation,Concept/Lecture,${(time.lecture / (totalH || 1)).toFixed(3)},"Concepts, theory","${pkg.totalSessions} Sessions"`);
  lines.push(`,,Assignment/Lab,${(time.lab / (totalH || 1)).toFixed(3)},"Assignment, Lab",`);
  lines.push(`,,Exam,${(time.exam / (totalH || 1)).toFixed(3)},"Pre-Test, Final Topic Test",`);

  // Section 9: Materials
  lines.push(`9,Training Materials & Environments,Text book,N/A,,`);
  lines.push(`,,References,N/A,,`);
  lines.push(`,,Technical requirements,N/A,,`);

  // Section 10: Assessment Scheme
  lines.push(`10,Assessment Scheme,,,,`);
  for (const a of pkg.assessmentScheme) {
    const w = typeof a.weight === "string" ? a.weight.replace("%", "") : a.weight;
    lines.push(`,,"${a.category}",${a.count || 1},${w},"${(a.notes || a.method || "").replace(/"/g, '""')}"`);
  }
  lines.push(`,,Pass Criteria,6,"Total topic GPA >= 6/10\\nCompleted 100% Online video, Quiz, Assignments, Labs, Final Test",`);

  // Section 11: Training Delivery Principles
  lines.push(`11,Training Delivery Principles,Trainees,"Qualified entry test and passed interview",,`);
  lines.push(`,,Trainer,"Trainer and mentor has good domain knowledge",,`);
  lines.push(`,,Re-Test,2,"Only allow each student to retake the test up to 2 times",`);

  // Schedule Detail Section
  lines.push(`,,,,,,,,`);
  lines.push(`${name} - Training Schedule,,,,,,,,`);
  lines.push(`Training Unit/Chapter,,Session,Content,Learning Objectives,Delivery Type,Duration (mins),Training Format,"Training Materials / Logistics & General Notes"`);

  for (let chIdx = 0; chIdx < pkg.chapters.length; chIdx++) {
    const ch = pkg.chapters[chIdx];
    const unitNum = ch.unitNumber || chIdx + 1;
    const cleanTitle = ch.title.replace(/^\d+[\.\s-]+/, "");

    for (let sIdx = 0; sIdx < ch.sessions.length; sIdx++) {
      const s = ch.sessions[sIdx];
      const durationMins = s.durationMins || Math.round((s.durationHours || 2) * 60);

      const colUnit = sIdx === 0 ? `${unitNum}` : "";
      const colTitle = sIdx === 0 ? `"${cleanTitle.replace(/"/g, '""')}"` : "";
      const colSess = `${s.session}`;
      const colContent = `"${(s.content || "").replace(/"/g, '""')}"`;
      const colObj = `"${(s.objectives || "").replace(/"/g, '""')}"`;
      const colType = s.deliveryType;
      const colMins = `${durationMins}`;
      const colFormat = s.trainingFormat || "Offline";
      const colNotes = `"${(s.materials || "").replace(/"/g, '""')}"`;

      lines.push(`${colUnit},${colTitle},${colSess},${colContent},${colObj},${colType},${colMins},${colFormat},${colNotes}`);
    }
  }

  // Authorship
  lines.push(`,,,,,,,,`);
  lines.push(`AUTHORSHIP,,,,,`);
  lines.push(`,Role,Name,Account,Unit,Notes`);
  lines.push(`,Creator,Course Lead,Lead01,FSA.NLS,`);

  return lines.join("\r\n");
}
