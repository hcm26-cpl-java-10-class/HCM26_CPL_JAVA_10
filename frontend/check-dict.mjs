import fs from "node:fs";

const src = fs.readFileSync("src/i18n/phrases.ts", "utf8");
const start = src.indexOf("const EN_VI = `");
const end = src.indexOf("`;", start);
const enVi = src.slice(start, end);

const have = new Set();
for (const line of enVi.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("|");
  if (i < 0) continue;
  have.add(t.slice(0, i).trim().toLowerCase());
}

const need = [
  "Analytics", "Student Analytics", "Course Analytics", "Assessment Management",
  "Curriculum Mapping", "Invitations", "Questions", "Score Appeals", "Score Management",
  "Exam Supervisor", "Book Management", "Books", "Course Online", "Courses", "Categories",
  "Certificates", "Curriculum", "Enrollments", "Unanswered Questions", "Lesson Reports",
  "Enrollment Logs", "Dashboard", "Dashboard Stats", "Project Management", "Sprint",
  "Project Team Allocation", "Sprint Backlogs", "Workspace", "Milestones", "Rubrics",
  "Alerts", "Kanban Board", "Project Template Versions", "RBAC Management", "Users",
  "Roles", "Permissions", "Departments", "Locations", "Student Scores",
  "Topic Mark Gradebook", "Trainees", "My Exams", "My Scores", "My Appeals",
  "Syllabus Management", "Syllabus", "Course Usage", "Syllabus Templates",
  "System Management", "Module Groups", "Modules", "Training Management", "Classes",
  "Training Calendar", "Weekly Timetable", "Topics & Syllabus", "Training Programs",
  "Instructors", "Class", "Sprints", "Syllabuses", "Assessments", "Department",
  "Explore Projects", "Student Home", "Home",
];

const missing = need.filter((n) => !have.has(n.toLowerCase()));
console.log("MISSING (" + missing.length + "):");
for (const m of missing) console.log("  -", m);
