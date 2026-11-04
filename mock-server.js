const http = require('http');

// ======================== SEED DATA ========================

let classes = [
  {
    id: 1,
    code: "HCM26_FR_FU_KS_JAVA_01",
    name: "HCM26_FR_FU_KS_JAVA_01",
    site: "HCM",
    traineeType: "Fresher",
    program: "[FSA.HCM] FR_NFP_JAVA_KS",
    trainingProgram: "[FSA.HCM] FR_NFP_JAVA_KS",
    programId: 1,
    classAdmin: "NhiNLY4, UyenHTM",
    enrolledTrainees: 23,
    plannedSize: 23,
    startDate: "2026-01-23",
    endDate: "2026-07-23",
    masterTrainer: "NgaTTT45",
    status: "completed",
    deliveryType: "Class",
    formatType: "Offline",
    skills: "Java",
    location: "Center Building, HCM",
    subjectType: "IT Technical",
    plannedRevenue: "0 VND",
    scope: "Unit",
    supplierPartner: "SCM",
    keyProgram: "No",
    globalSe: "No",
    jobRecommendation: "No"
  },
  {
    id: 2,
    code: "HCM26_FR_JAVA_03",
    name: "HCM26_FR_JAVA_03",
    site: "TP. Ho Chi Minh",
    traineeType: "Fresher",
    program: "FR_NFP_JAVA_2",
    trainingProgram: "[NFP] Fresher Full-stack Java Developer for SCM 1.0",
    programId: 2,
    classAdmin: "AnhVNP2, BinhHBB",
    enrolledTrainees: 10,
    plannedSize: 10,
    startDate: "2026-05-23",
    endDate: "2026-11-22",
    masterTrainer: "NgaTTT45",
    status: "active",
    deliveryType: "Class",
    formatType: "Offline",
    skills: "Java",
    location: "Center Building, HCM",
    subjectType: "IT Technical",
    plannedRevenue: "0 VND",
    scope: "Unit",
    supplierPartner: "SCM",
    keyProgram: "No",
    globalSe: "No",
    jobRecommendation: "No"
  },
  {
    id: 3,
    code: "HCM26_FR_JAVA_02",
    name: "HCM26_FR_JAVA_02",
    site: "HCM",
    traineeType: "Fresher",
    program: "FR_NFP_JAVA",
    trainingProgram: "FR_NFP_JAVA",
    programId: 3,
    classAdmin: "AnhLNP2, DuyenNPK3",
    enrolledTrainees: 11,
    plannedSize: 10,
    startDate: "2026-04-23",
    endDate: "2026-10-23",
    masterTrainer: "NgaTTT45",
    status: "active",
    deliveryType: "Class",
    formatType: "Offline",
    skills: "Java",
    location: "Center Building, HCM",
    subjectType: "IT Technical",
    plannedRevenue: "0 VND",
    scope: "Unit",
    supplierPartner: "SCM",
    keyProgram: "No",
    globalSe: "No",
    jobRecommendation: "No"
  },
  {
    id: 4,
    code: "HCM26_FR_JAVA_01",
    name: "HCM26_FR_JAVA_01",
    site: "HCM",
    traineeType: "Fresher",
    program: "FR_NFP_JAVA",
    trainingProgram: "FR_NFP_JAVA",
    programId: 4,
    classAdmin: "AnhLNP2, DuyenNPK3",
    enrolledTrainees: 18,
    plannedSize: 20,
    startDate: "2026-04-23",
    endDate: "2026-10-23",
    masterTrainer: "NgaTTT45",
    status: "active",
    deliveryType: "Class",
    formatType: "Offline",
    skills: "Java",
    location: "Center Building, HCM",
    subjectType: "IT Technical",
    plannedRevenue: "0 VND",
    scope: "Unit",
    supplierPartner: "SCM",
    keyProgram: "No",
    globalSe: "No",
    jobRecommendation: "No"
  }
];

const trainers = [
  { id: 1, name: "NgaTTT45", email: "ngattt45@fpt.com", status: "active" },
  { id: 2, name: "AnhVNP2", email: "anhvnp2@fpt.com", status: "active" },
  { id: 3, name: "NhiNLY4", email: "nhinly4@fpt.com", status: "active" }
];

const rooms = [
  { id: 1, name: "Center Building Room 101", capacity: 30 },
  { id: 2, name: "Center Building Room 102", capacity: 25 }
];

// Trainee pool
let allTrainees = [
  { id: 101, code: "HV001", fullName: "Nguyen Van An", email: "anvn@fsoft.com.vn", phone: "0901234567", university: "HCMUT", gpa: 3.5, status: "studying" },
  { id: 102, code: "HV002", fullName: "Tran Thi Bich", email: "bichtt@fsoft.com.vn", phone: "0902345678", university: "HCMUS", gpa: 3.2, status: "studying" },
  { id: 103, code: "HV003", fullName: "Le Minh Duc", email: "duclm@fsoft.com.vn", phone: "0903456789", university: "UIT", gpa: 3.8, status: "studying" },
  { id: 104, code: "HV004", fullName: "Pham Thi Em", email: "empth@fsoft.com.vn", phone: "0904567890", university: "HCMUT", gpa: 3.1, status: "studying" },
  { id: 105, code: "HV005", fullName: "Hoang Van Phuc", email: "phuchv@fsoft.com.vn", phone: "0905678901", university: "RMIT", gpa: 3.6, status: "studying" },
  { id: 106, code: "HV006", fullName: "Nguyen Thi Giang", email: "giangnt@fsoft.com.vn", phone: "0906789012", university: "HCMUS", gpa: 3.4, status: "studying" },
  { id: 107, code: "HV007", fullName: "Do Van Hai", email: "haidv@fsoft.com.vn", phone: "0907890123", university: "TDTU", gpa: 3.0, status: "studying" },
  { id: 108, code: "HV008", fullName: "Vo Thi Lan", email: "lanvt@fsoft.com.vn", phone: "0908901234", university: "UEH", gpa: 3.7, status: "studying" },
  { id: 109, code: "HV009", fullName: "Bui Quoc Minh", email: "minhbq@fsoft.com.vn", phone: "0909012345", university: "VGU", gpa: 3.3, status: "studying" },
  { id: 110, code: "HV010", fullName: "Dang Thi Nga", email: "ngadt@fsoft.com.vn", phone: "0900123456", university: "HCMUTE", gpa: 3.9, status: "studying" },
  { id: 111, code: "HV011", fullName: "Ly Thanh Phong", email: "phonglt@fsoft.com.vn", phone: "0901234560", university: "HCMUT", gpa: 3.5, status: "studying" },
  { id: 112, code: "HV012", fullName: "Truong Minh Quan", email: "quantm@fsoft.com.vn", phone: "0902345670", university: "HUTECH", gpa: 2.9, status: "dropped" }
];

// Class-trainee enrollment mapping (classId -> traineeIds[])
let enrollments = {
  1: [101,102,103,104,105,106,107,108,109,110,111,112, 101,102,103,104,105,106,107,108,109,110,111],
  2: [103,104,105,106,107,108,109,110],
  3: [101,102,103,104,105,106,107,108,109,110,111],
  4: [101,103,105,107,109,111,102,104,106,108,110,112, 101,103,105,107,109,111]
};
// Deduplicate
Object.keys(enrollments).forEach(k => {
  enrollments[k] = [...new Set(enrollments[k])];
});

// Attendance records: { classId_sessionId_traineeId: status }
let attendanceRecords = {};

// Class sessions (schedule)
let classSessions = [
  // Class 2 sessions
  { id: 1, classId: 2, date: "2026-05-23", slot: "Morning (08:30-12:00)", topic: "Java OOP Fundamentals", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lecture", status: "completed" },
  { id: 2, classId: 2, date: "2026-05-24", slot: "Afternoon (13:30-17:30)", topic: "Java Collections Framework", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lecture", status: "completed" },
  { id: 3, classId: 2, date: "2026-05-25", slot: "Morning (08:30-12:00)", topic: "Exception Handling & I/O", trainer: "AnhVNP2", room: "Center Building Room 102", type: "lab", status: "completed" },
  { id: 4, classId: 2, date: "2026-06-01", slot: "Morning (08:30-12:00)", topic: "Spring Boot Introduction", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lecture", status: "completed" },
  { id: 5, classId: 2, date: "2026-06-02", slot: "Afternoon (13:30-17:30)", topic: "RESTful APIs with Spring", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lab", status: "completed" },
  { id: 6, classId: 2, date: "2026-06-15", slot: "Morning (08:30-12:00)", topic: "Database Design & JPA", trainer: "AnhVNP2", room: "Center Building Room 102", type: "lecture", status: "upcoming" },
  { id: 7, classId: 2, date: "2026-06-16", slot: "Afternoon (13:30-17:30)", topic: "JPA Relationships & Queries", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lab", status: "upcoming" },
  // Class 3 sessions
  { id: 8, classId: 3, date: "2026-04-23", slot: "Morning (08:30-12:00)", topic: "Java Basics Review", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lecture", status: "completed" },
  { id: 9, classId: 3, date: "2026-04-24", slot: "Afternoon (13:30-17:30)", topic: "Git & Project Setup", trainer: "AnhVNP2", room: "Center Building Room 102", type: "lab", status: "completed" },
  { id: 10, classId: 3, date: "2026-05-01", slot: "Morning (08:30-12:00)", topic: "Spring MVC Pattern", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lecture", status: "completed" },
  // Class 4 sessions
  { id: 11, classId: 4, date: "2026-04-23", slot: "Morning (08:30-12:00)", topic: "Welcome & Orientation", trainer: "NgaTTT45", room: "Center Building Room 101", type: "orientation", status: "completed" },
  { id: 12, classId: 4, date: "2026-04-24", slot: "Morning (08:30-12:00)", topic: "Java Fundamentals", trainer: "NgaTTT45", room: "Center Building Room 101", type: "lecture", status: "completed" },
];
let sessionIdCounter = 20;

// Audit records
let auditRecords = [
  {
    id: 1, classId: 2, classCode: "HCM26_FR_JAVA_03",
    auditDate: "2026-06-01", auditor: "QATeamLead",
    trainerProfessionalism: 5, materialQuality: 4, studentsEngagement: 4,
    syllabusCompliance: 5, overallScore: 4.5, result: "pass",
    notes: "Trainer demonstrated strong Java expertise. Students were attentive.",
    actionItems: []
  },
  {
    id: 2, classId: 3, classCode: "HCM26_FR_JAVA_02",
    auditDate: "2026-05-15", auditor: "QATeamLead",
    trainerProfessionalism: 3, materialQuality: 3, studentsEngagement: 2,
    syllabusCompliance: 3, overallScore: 2.75, result: "warning",
    notes: "Several students were distracted. Trainer pace was too fast.",
    actionItems: [
      { id: 1, description: "Slow down Spring MVC lecture pace", dueDate: "2026-05-22", status: "open" },
      { id: 2, description: "Add more hands-on exercises", dueDate: "2026-05-29", status: "done" }
    ]
  }
];
let auditIdCounter = 10;

// Budget records per class
let budgets = {
  1: {
    classId: 1, classCode: "HCM26_FR_FU_KS_JAVA_01",
    plannedRevenue: 0,
    items: [
      { id: 1, category: "Trainer Fee", description: "NgaTTT45 - 120 hours x 150,000 VND", amount: 18000000, type: "expense", actual: 18000000 },
      { id: 2, category: "Facility", description: "Room rental Center Building", amount: 5000000, type: "expense", actual: 4800000 },
      { id: 3, category: "Materials", description: "Printed learning materials", amount: 2300000, type: "expense", actual: 2100000 },
      { id: 4, category: "Software License", description: "JetBrains license", amount: 1500000, type: "expense", actual: 1500000 },
    ]
  },
  2: {
    classId: 2, classCode: "HCM26_FR_JAVA_03",
    plannedRevenue: 0,
    items: [
      { id: 1, category: "Trainer Fee", description: "NgaTTT45 - 80 hours x 150,000 VND", amount: 12000000, type: "expense", actual: 7200000 },
      { id: 2, category: "Facility", description: "Room rental Center Building", amount: 3000000, type: "expense", actual: 1800000 },
      { id: 3, category: "Materials", description: "Printed learning materials", amount: 1000000, type: "expense", actual: 600000 },
    ]
  },
  3: {
    classId: 3, classCode: "HCM26_FR_JAVA_02",
    plannedRevenue: 0,
    items: [
      { id: 1, category: "Trainer Fee", description: "NgaTTT45 + AnhVNP2 - 100 hours", amount: 15000000, type: "expense", actual: 9000000 },
      { id: 2, category: "Facility", description: "Room rental Center Building", amount: 4000000, type: "expense", actual: 2400000 },
    ]
  },
  4: {
    classId: 4, classCode: "HCM26_FR_JAVA_01",
    plannedRevenue: 0,
    items: [
      { id: 1, category: "Trainer Fee", description: "NgaTTT45 - 100 hours x 150,000 VND", amount: 15000000, type: "expense", actual: 9000000 },
      { id: 2, category: "Facility", description: "Room rental Center Building", amount: 4000000, type: "expense", actual: 2400000 },
      { id: 3, category: "Software License", description: "JetBrains license", amount: 1800000, type: "expense", actual: 1800000 },
    ]
  }
};

// Status transition log
let statusLogs = {};

// ======================== HELPERS ========================

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Get trainees enrolled in a class with attendance summary
function getClassTrainees(classId, sessions) {
  const ids = enrollments[classId] || [];
  const classSess = sessions.filter(s => s.classId === classId && s.status === 'completed');
  const totalSessions = classSess.length;

  return allTrainees
    .filter(t => ids.includes(t.id))
    .map(t => {
      const attended = classSess.filter(s => {
        const key = `${classId}_${s.id}_${t.id}`;
        const att = attendanceRecords[key];
        return att === 'present' || att === 'late';
      }).length;
      const attendance = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null;
      return { ...t, attendance, totalSessions };
    });
}

// CLASS LIFECYCLE RULES
const STATUS_TRANSITIONS = {
  planning:   ['assigned', 'cancelled'],
  assigned:   ['active', 'cancelled'],
  active:     ['pending_close', 'cancelled'],
  pending_close: ['completed', 'active'],
  completed:  ['closed'],
  closed:     [],
  cancelled:  []
};

const STATUS_LABELS = {
  planning: 'Planning',
  assigned: 'Assigned',
  active: 'In progress',
  pending_close: 'Pending close',
  completed: 'Training completed',
  closed: 'Closed',
  cancelled: 'Cancelled'
};

// ======================== SERVER ========================

const calendarVersions = new Map();

// ==================== FAMS OPERATION & ACTIVITIES STORAGE ====================
function formatFamsTimestamp(date = new Date()) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  return pad(date.getDate()) + "-" + months[date.getMonth()] + "-" + date.getFullYear() + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

function getInitials(name = "Admin") {
  const clean = String(name).trim();
  if (!clean) return "AD";
  const caps = clean.replace(/[^A-Z]/g, "");
  if (caps.length >= 2) return caps.slice(0, 2);
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function createDefaultMilestones(classId) {
  return [
    {
      id: 1, name: "Feb - 2026", status: "Baselined", checkpointType: "STANDARD", salaryPaid: "Yes",
      startDate: "2026-02-01", endDate: "2026-02-28",
      topics: [
        { id: 101, topic: "[L1_AL_DF] [NFP] Database Fundamentals For All by FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 868 },
        { id: 102, topic: "[L1_AL_ECWL] [NFP] Effective Communication with LEAP Technique (Instructor Led) (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 360 },
        { id: 103, topic: "[L1_AL_DSAA] [NFP] Data Structures and Algorithms for ALL by FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 810 },
        { id: 104, topic: "[L1_AL_APWS] [NFP] Agile Practitioner with Scrum For All By FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 210 }
      ]
    },
    {
      id: 2, name: "Mar - 2026", status: "Baselined", checkpointType: "STANDARD", salaryPaid: "Yes",
      startDate: "2026-03-01", endDate: "2026-03-31",
      topics: [
        { id: 201, topic: "[L1_AL_VCG] [NFP] Version Control - Git for ALL by FSA (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 264 },
        { id: 202, topic: "[L4_MOCK_PROJECT] [NFP] Mock Project for Fresher (1.0) - Phase 1", maxScore: 10, passingScore: 6, weightedNumber: 5520 }
      ]
    },
    {
      id: 3, name: "Apr - 2026", status: "Baselined", checkpointType: "STANDARD", salaryPaid: "Yes",
      startDate: "2026-04-01", endDate: "2026-04-30",
      topics: [
        { id: 301, topic: "[L4_MOCK_PROJECT] [NFP] Mock Project for Fresher (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 9840 },
        { id: 302, topic: "[FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - April", maxScore: 10, passingScore: 6, weightedNumber: 3060 }
      ]
    },
    {
      id: 4, name: "May - 2026", status: "Baselined", checkpointType: "STANDARD", salaryPaid: "Yes",
      startDate: "2026-05-01", endDate: "2026-05-31",
      topics: [
        { id: 401, topic: "[L2_JA_JS] [NFP] Java SE/Java Language Programing (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 2880 },
        { id: 402, topic: "[FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - May", maxScore: 10, passingScore: 6, weightedNumber: 1260 }
      ]
    },
    {
      id: 5, name: "Jun - 2026", status: "Baselined", checkpointType: "STANDARD", salaryPaid: "Yes",
      startDate: "2026-06-01", endDate: "2026-06-30",
      topics: [
        { id: 501, topic: "[L2_JA_ORM] [NFP] ORM Framework - Hibernate (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 2400 },
        { id: 502, topic: "[L2_JA_FEF(JS.KS)] [NFP] Front-end Fundamentals (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 4230 },
        { id: 503, topic: "[L3_JSFW] [NFP] JavaScript Framework - React (1.0)", maxScore: 10, passingScore: 6, weightedNumber: 4000 }
      ]
    }
  ];
}

function createDefaultTopicAssessments() {
  const titles = [
    "1. L1_AL_CCGM - [NFP] Company Culture & Global Mindset (Instructor Led)",
    "2. [FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - Jan&Feb",
    "3. L1_AL_GC - [NFP] Global Collaboration",
    "4. L1_AL_PSE - [NFP] Problem Solving",
    "5. L1_AL_TME - [NFP] Time Management (E-learning)",
    "6. L1_AL_DF - [NFP] Database Fundamentals For All by FSA",
    "7. L1_AL_APWS - [NFP] Agile Practitioner with Scrum For All By FSA",
    "8. L1_AL_ECWL - [NFP] Effective Communication with LEAP Technique (Instructor Led)",
    "9. L1_AL_DSAA - [NFP] Data Structures and Algorithms for ALL by FSA",
    "10. L1_AL_VCG - [NFP] Version Control - Git for ALL by FSA",
    "11. FR_FU_KOR_IM - FR_FU_KOR_IM",
    "12. [L4_MOCK_PROJECT] [NFP] Mock Project for Fresher (1.0) - Phase 1",
    "13. [FR_FU_KOR_IM] FR_FU_KOR_IM (1.0) - April",
    "14. L4_MOCK_PROJECT - [NFP] Mock Project for Fresher"
  ];
  return titles.map((title, idx) => {
    const topicNum = idx + 1;
    if (topicNum === 6) {
      return {
        id: topicNum, title,
        assessments: [
          { id: 601, name: "Assignments", weightedNumber: 30, quantity: 2, note: "(2 assignments)", action: "Keep", changeStatus: "none" },
          { id: 602, name: "Final Theory Test", weightedNumber: 28, quantity: 1, note: "", action: "Keep", changeStatus: "confirmed" },
          { id: 603, name: "Final Final Test", weightedNumber: 42, quantity: 1, note: "", action: "Keep", changeStatus: "none" }
        ]
      };
    }
    if (topicNum === 9) {
      return {
        id: topicNum, title,
        assessments: [
          { id: 901, name: "Assignments", weightedNumber: 30, quantity: 3, note: "", action: "Keep", changeStatus: "waiting" },
          { id: 902, name: "Final Theory Test", weightedNumber: 30, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
          { id: 903, name: "Final Practice Test", weightedNumber: 40, quantity: 1, note: "", action: "Keep", changeStatus: "none" }
        ]
      };
    }
    return {
      id: topicNum, title,
      assessments: [
        { id: topicNum * 100 + 1, name: "Assignments", weightedNumber: 30, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
        { id: topicNum * 100 + 2, name: "Final Theory Test", weightedNumber: 30, quantity: 1, note: "", action: "Keep", changeStatus: "none" },
        { id: topicNum * 100 + 3, name: "Final Practice Test", weightedNumber: 40, quantity: 1, note: "", action: "Keep", changeStatus: "none" }
      ]
    };
  });
}

let budgetOperations = {};
let topicAssessmentsByClass = {};
let classActivities = {
  1: [
    { id: 1, classId: 1, author: "UyenHTM", initials: "UH", content: "has updated trainee allocation info.", timestamp: "06-Aug-2026 09:41:25", type: "history" },
    { id: 2, classId: 1, author: "UyenHTM", initials: "UH", content: "has updated trainee status.", timestamp: "06-Aug-2026 09:34:35", type: "history" },
    { id: 3, classId: 1, author: "UyenHTM", initials: "UH", content: "has reverted to in progress the class with following reason:\nUPDATE MILESTONE.", timestamp: "28-Jul-2026 15:19:32", type: "history" },
    { id: 4, classId: 1, author: "UyenHTM", initials: "UH", content: "has edited trainee mark.", timestamp: "27-Jul-2026 17:02:19", type: "history" },
    { id: 5, classId: 1, author: "UyenHTM", initials: "UH", content: "has updated class milestone.", timestamp: "27-Jul-2026 16:26:47", type: "history" },
    { id: 6, classId: 1, author: "NgaTTT45", initials: "NT", content: "All trainees completed Final Practice Exam for Milestone Jun - 2026. Ready for graduation review.", timestamp: "26-Jul-2026 14:10:05", type: "comment" },
    { id: 7, classId: 1, author: "NhiNLY4", initials: "NN", content: "has updated trainee reward and penalty.", timestamp: "25-Jul-2026 10:22:14", type: "history" }
  ]
};
let activityIdCounter = 100;

function appendClassActivity(classId, author, content, type = "history") {
  if (!classActivities[classId]) classActivities[classId] = [];
  activityIdCounter++;
  const entry = {
    id: activityIdCounter,
    classId,
    author: author || "UyenHTM",
    initials: getInitials(author || "UyenHTM"),
    content,
    timestamp: formatFamsTimestamp(new Date()),
    type
  };
  classActivities[classId].unshift(entry);
  return entry;
}

function getOrCreateBudgetOperation(classId) {
  if (!budgetOperations[classId]) {
    const cls = classes.find(c => c.id === classId);
    budgetOperations[classId] = {
      classId,
      operatingInfo: {
        actualStartDate: cls?.startDate || "2026-01-23",
        earlyGraduatedDate: classId === 1 ? "2026-07-22" : (cls?.endDate || "2026-07-22"),
        actualEndDate: "",
        gpaCalculation: { topicMark: 70, disciplinePoint: 30, bonusPoint: 10, penaltyPoint: 20 },
        hasNoAllocationNeeds: false
      },
      milestones: createDefaultMilestones(classId)
    };
  }
  const record = budgetOperations[classId];
  const totalWeightedNumber = (record.milestones || []).reduce((sum, m) => sum + (m.topics || []).reduce((s, t) => s + (Number(t.weightedNumber) || 0), 0), 0);
  return { ...record, totalWeightedNumber };
}

function getOrCreateTopicAssessments(classId) {
  if (!topicAssessmentsByClass[classId]) {
    const initial = createDefaultTopicAssessments();
    topicAssessmentsByClass[classId] = {
      current: JSON.parse(JSON.stringify(initial)),
      baseline: JSON.parse(JSON.stringify(initial))
    };
  }
  return topicAssessmentsByClass[classId];
}

function getOrCreateClassActivities(classId) {
  if (!classActivities[classId]) {
    classActivities[classId] = [
      {
        id: ++activityIdCounter,
        classId,
        author: "UyenHTM",
        initials: "UH",
        content: "has initialized class operating info.",
        timestamp: "01-May-2026 09:00:00",
        type: "history"
      }
    ];
  }
  return classActivities[classId];
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Calendar version history is sample data owned by this development service.
  const calendarsMatch = pathname.match(/^\/api\/classes\/(\d+)\/calendars$/);
  const newCalendarVersionMatch = pathname.match(/^\/api\/classes\/(\d+)\/calendars\/(\d+)\/versions$/);
  if (req.method === 'POST' && newCalendarVersionMatch) {
    const classId = Number(newCalendarVersionMatch[1]);
    const source = (calendarVersions.get(classId) || []).find(item => item.id === Number(newCalendarVersionMatch[2]));
    if (!source) return json(res, 404, { message: 'Calendar version not found' });
    const body = await readBody(req);
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!validDate(body?.classStartDate) || !validDate(body?.actualLearningStartDate) || body.actualLearningStartDate < body.classStartDate ||
        !Array.isArray(body?.overviewItems) || body.overviewItems.length === 0 || body.overviewItems.length > 500) {
      return json(res, 400, { message: 'Valid start dates and at least one topic are required' });
    }
    const ids = new Set();
    for (const topic of body.overviewItems) {
      if (!topic || typeof topic.id !== 'string' || !topic.id || ids.has(topic.id) || typeof topic.label !== 'string' || !topic.label.trim() ||
          !validDate(topic.startDate) || !validDate(topic.endDate) || topic.endDate < topic.startDate || topic.startDate < body.actualLearningStartDate ||
          !Array.isArray(topic.lessons) || topic.lessons.some(lesson => !lesson || typeof lesson.name !== 'string' || !lesson.name.trim() || !validDate(lesson.from) || !validDate(lesson.to) ||
            lesson.from < topic.startDate || lesson.to > topic.endDate || lesson.to < lesson.from)) {
        return json(res, 400, { message: 'Topic dates and lesson dates must be valid and within the learning calendar' });
      }
      ids.add(topic.id);
    }
    const versions = calendarVersions.get(classId);
    const minor = Math.max(...versions.map(item => Number(item.version.split('.')[1]) || 0)) + 1;
    const version = `1.${minor}`;
    const baseName = source.name.replace(/(?:DRAFT_)?version_[\d.]+$/, '');
    const name = `${baseName}${baseName === source.name ? '_' : ''}DRAFT_version_${version}`;
    const managedTopics = new Set((source.overviewItems?.length ? source.overviewItems.map(topic => topic.label.replace(/^\[|\]$/g, '')) :
      (source.sessions || []).map(session => session.topicCode || session.topic)));
    const retainedSessions = (source.sessions || []).filter(session => !managedTopics.has(session.topicCode || session.topic));
    const created = { ...JSON.parse(JSON.stringify(source)), id: Math.max(...versions.map(item => item.id)) + 1,
      name, version, status: 'draft', historyChange: `Adjusted from version ${source.version}`,
      classStartDate: body.classStartDate, actualLearningStartDate: body.actualLearningStartDate,
      overviewItems: body.overviewItems, sessions: JSON.parse(JSON.stringify(retainedSessions)), lastModifiedDate: new Date().toISOString(), lastModifiedBy: 'Demo Admin' };
    versions.unshift(created);
    return json(res, 201, created);
  }
  if (['GET', 'PUT'].includes(req.method) && calendarsMatch) {
    const classId = Number(calendarsMatch[1]);
    const cls = classes.find(item => item.id === classId);
    if (!cls) return json(res, 404, { message: `Class #${classId} not found` });
    const changes = [
      ['Update plan', '2026-07-09T13:46:00', 'UyenHTM'],
      ['Extend calendar', '2026-07-09T13:46:00', 'UyenHTM'],
      ['Update Final Theory for React', '2026-07-02T11:44:00', 'UyenHTM'],
      ['Update plan CIS 2 session', '2026-06-24T14:28:00', 'NgaTTT45'],
      ['Update trainer', '2026-05-27T09:09:00', 'UyenHTM'],
      ['Update KOR.IM subject', '2026-05-25T15:52:00', 'UyenHTM'],
      ['Divide Mock Project to new module', '2026-05-07T14:36:00', 'UyenHTM'],
      ['Update plan', '2026-03-17T13:56:00', 'UyenHTM'],
      ['Initial training calendar', '2026-01-20T09:00:00', 'NgaTTT45'],
    ];
    // Calendar-only demo ranges; these do not create or change class sessions.
    const sampleTopics = [
      ['OC', '05-25', '05-25'], ['L1_AL_PSE', '05-26', '05-26'], ['L1_AL_CCGM', '05-26', '05-26'],
      ['L1_AL_TESO', '05-27', '05-27'], ['L1_AL_GC', '05-27', '05-27'], ['L1_AL_TME', '05-28', '05-28'],
      ['L1_AL_AAE', '05-29', '06-02'], ['L1_AL_DF', '06-03', '06-08'], ['L1_AL_DSAA', '06-09', '06-10'],
      ['L1_AL_ECWL', '06-11', '06-11'], ['L1_AL_ECWL_2', '06-12', '06-12'], ['L1_AL_APWS', '06-15', '06-16'],
      ['L1_AL_VCG', '06-17', '06-17'], ['L2_JA_JS', '06-18', '06-29'], ['L3_AL_CFFF', '06-30', '06-30'],
      ['L2_JA_ORM', '07-01', '07-07'], ['L2_AL_FEF', '07-08', '07-14'], ['L3_AL_CFFF_2', '07-15', '07-15'],
      ['L3_JSFW', '07-16', '07-24'], ['L2_AN_AE', '07-27', '08-05'], ['L4_MOCK', '08-06', '09-04'],
      ['CC', '09-07', '09-07'],
    ];
    const shiftDate = (date) => new Date(Date.parse(`2026-${date}T00:00:00Z`) +
      (classId === 1 ? Date.parse('2026-01-23T00:00:00Z') - Date.parse('2026-05-25T00:00:00Z') : 0)).toISOString().slice(0, 10);
    const topicNames = [
      'Opening Ceremony', 'Problem Solving (E-learning)', 'Company Culture & Global Mindset (Instructor-led)',
      'Teamwork Essentials: Stand Out as a Valuable Team Member (E-learning)', 'Global Collaboration',
      'Time Management (E-learning)', 'AI Augmented Engineer', 'Digital Fundamentals', 'Data Structures and Algorithms',
      'Effective Communication', 'Effective Communication Workshop', 'Agile Project Working Skills', 'Version Control with Git',
      'Java Standard', 'Final Foundation Assessment', 'Object Relational Mapping', 'Front-end Fundamentals',
      'Final Foundation Review', 'JavaScript Framework', 'Application Engineering', 'Mock Project', 'Course Closing',
    ];
    const overviewItems = [1, 2].includes(classId) ? sampleTopics.map(([label, start, end], index) => {
      const name = topicNames[index];
      const slot = `[HCM] [CENTER_BUILDING_HCM] Part Time 2,3,4,5,6_${index % 2 ? 'Morning' : 'Afternoon'}`;
      const title = index === 1 ? '[NFP] Problem Solving' : index === 2 ? '[NFP] Company Culture & Global Mindset (Instructor Led)' : index === 3 ? '[NFP] Teamwork Essentials' : name;
      return {
        id: `${classId}-${index}`, label: `[${label}]`, name: title, version: index === 0 ? undefined : '1.0', slot,
        startDate: shiftDate(start), endDate: shiftDate(end),
        lessons: [{ id: `${classId}-${index}-lesson`, name: index === 2 ? 'Company Culture' : name, from: shiftDate(start), to: shiftDate(end), slot,
          trainer: cls.masterTrainer, venue: cls.location, notes: name }],
      };
    }) : undefined;
    if (!calendarVersions.has(classId)) calendarVersions.set(classId, changes.map(([historyChange, lastModifiedDate, lastModifiedBy], index) => ({
      id: classId * 100 + 9 - index,
      classId,
      name: `${cls.code || cls.name}_TrainingCalendar_${index === 1 ? 'DRAFT_' : ''}version_1.${9 - index}`,
      version: `1.${9 - index}`,
      historyChange,
      lastModifiedDate,
      lastModifiedBy,
      status: index === 0 ? 'active' : index === 1 ? 'draft' : 'inactive',
      sessions: JSON.parse(JSON.stringify(classSessions.filter(session => session.classId === classId))),
      overviewItems,
      actualLearningStartDate: overviewItems?.[0]?.startDate,
      classStartDate: cls.startDate,
    })));
    const versions = calendarVersions.get(classId);
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!Array.isArray(body?.updates) || body.updates.length === 0) return json(res, 400, { message: 'No calendar updates provided' });
      const ids = new Set();
      for (const update of body.updates) {
        if (!versions.some(item => item.id === update.id) || ids.has(update.id) ||
            typeof update.name !== 'string' || !update.name.trim() || update.name.length > 255 ||
            typeof update.historyChange !== 'string' || !update.historyChange.trim() || update.historyChange.length > 1000) {
          return json(res, 400, { message: 'Invalid calendar update' });
        }
        ids.add(update.id);
      }
      for (const update of body.updates) {
        Object.assign(versions.find(item => item.id === update.id), {
          name: update.name.trim(), historyChange: update.historyChange.trim(),
          lastModifiedDate: new Date().toISOString(), lastModifiedBy: 'Demo Admin',
        });
      }
    }
    return json(res, 200, versions);
  }

  // ======== CLASSES ========

  // GET /api/classes
  if (req.method === 'GET' && pathname === '/api/classes') {
    const status = url.searchParams.get('status');
    let result = classes;
    if (status && status !== 'all') {
      result = classes.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
    }
    return json(res, 200, result);
  }

  const classDetailMatch = pathname.match(/^\/api\/classes\/(\d+)$/);
  const classStatusMatch = pathname.match(/^\/api\/classes\/(\d+)\/status$/);
  const classTraineesMatch = pathname.match(/^\/api\/classes\/(\d+)\/trainees$/);
  const classTraineeItemMatch = pathname.match(/^\/api\/classes\/(\d+)\/trainees\/(\d+)$/);
  const classSessionsMatch = pathname.match(/^\/api\/classes\/(\d+)\/sessions$/);
  const classSessionItemMatch = pathname.match(/^\/api\/classes\/(\d+)\/sessions\/(\d+)$/);
  const attendanceMatch = pathname.match(/^\/api\/classes\/(\d+)\/sessions\/(\d+)\/attendance$/);
  const classBudgetMatch = pathname.match(/^\/api\/classes\/(\d+)\/budget$/);
  const classAuditMatch = pathname.match(/^\/api\/classes\/(\d+)\/audits$/);
  const classOperationMatch = pathname.match(/^\/api\/classes\/(\d+)\/operation$/);
  const classAssessmentsMatch = pathname.match(/^\/api\/classes\/(\d+)\/topic-assessments$/);
  const classActivitiesMatch = pathname.match(/^\/api\/classes\/(\d+)\/activities$/);

  // GET /api/classes/:id
  if (req.method === 'GET' && classDetailMatch && !classStatusMatch && !classTraineesMatch && !classSessionsMatch && !classBudgetMatch && !classAuditMatch && !classOperationMatch && !classAssessmentsMatch && !classActivitiesMatch) {
    const id = parseInt(classDetailMatch[1], 10);
    const item = classes.find(c => c.id === id);
    if (!item) return json(res, 404, { message: `Class #${id} not found` });
    return json(res, 200, item);
  }

  // ======== TRAINEE LIST ========

  // GET /api/classes/:id/trainees
  if (req.method === 'GET' && classTraineesMatch) {
    const classId = parseInt(classTraineesMatch[1], 10);
    const cls = classes.find(c => c.id === classId);
    if (!cls) return json(res, 404, { message: `Class #${classId} not found` });
    const trainees = getClassTrainees(classId, classSessions);
    return json(res, 200, trainees);
  }

  // POST /api/classes/:id/trainees  - Add trainee to class
  if (req.method === 'POST' && classTraineesMatch) {
    const classId = parseInt(classTraineesMatch[1], 10);
    const cls = classes.find(c => c.id === classId);
    if (!cls) return json(res, 404, { message: `Class #${classId} not found` });
    if (cls.status === 'completed' || cls.status === 'closed' || cls.status === 'cancelled') {
      return json(res, 400, { message: `Không thể thêm học viên vào lớp có trạng thái '${STATUS_LABELS[cls.status] || cls.status}'` });
    }

    const data = await readBody(req);
    const traineeId = parseInt(data.traineeId, 10);
    if (!traineeId) return json(res, 400, { message: 'traineeId is required' });

    const trainee = allTrainees.find(t => t.id === traineeId);
    if (!trainee) return json(res, 404, { message: `Trainee #${traineeId} not found` });

    if (!enrollments[classId]) enrollments[classId] = [];
    if (enrollments[classId].includes(traineeId)) {
      return json(res, 400, { message: `Học viên '${trainee.fullName}' đã được đăng ký vào lớp này` });
    }

    const enrolled = enrollments[classId].length;
    if (enrolled >= cls.plannedSize) {
      return json(res, 400, { message: `Lớp đã đủ ${cls.plannedSize} học viên theo kế hoạch. Không thể thêm thêm.` });
    }

    enrollments[classId].push(traineeId);
    cls.enrolledTrainees = enrollments[classId].length;
    return json(res, 201, { message: `Đã thêm học viên '${trainee.fullName}' vào lớp`, trainee });
  }

  // DELETE /api/classes/:id/trainees/:traineeId - Remove trainee from class
  if (req.method === 'DELETE' && classTraineeItemMatch) {
    const classId = parseInt(classTraineeItemMatch[1], 10);
    const traineeId = parseInt(classTraineeItemMatch[2], 10);
    const data = await readBody(req).catch(() => ({}));
    const reason = data.reason || 'Not specified';

    const cls = classes.find(c => c.id === classId);
    if (!cls) return json(res, 404, { message: `Class #${classId} not found` });
    if (cls.status === 'completed' || cls.status === 'closed') {
      return json(res, 400, { message: `Không thể xóa học viên khỏi lớp đã hoàn thành hoặc đóng` });
    }

    if (!enrollments[classId]) enrollments[classId] = [];
    const idx = enrollments[classId].indexOf(traineeId);
    if (idx === -1) return json(res, 404, { message: `Trainee #${traineeId} không có trong lớp này` });

    enrollments[classId].splice(idx, 1);
    cls.enrolledTrainees = enrollments[classId].length;
    return json(res, 200, { message: `Đã rút học viên khỏi lớp. Lý do: ${reason}` });
  }

  // GET all trainees (pool for adding)
  if (req.method === 'GET' && pathname === '/api/trainees') {
    return json(res, 200, allTrainees);
  }

  // ======== CLASS STATUS LIFECYCLE ========

  // PATCH /api/classes/:id/status
  if (req.method === 'PATCH' && classStatusMatch) {
    const id = parseInt(classStatusMatch[1], 10);
    const cls = classes.find(c => c.id === id);
    if (!cls) return json(res, 404, { message: `Class #${id} not found` });

    const data = await readBody(req);
    const newStatus = data.status;
    const reason = data.reason || '';
    const currentStatus = cls.status || 'planning';

    if (!newStatus) return json(res, 400, { message: 'status is required' });
    if (newStatus === currentStatus) return json(res, 400, { message: 'Trạng thái không thay đổi' });

    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return json(res, 400, { message: `Không thể chuyển từ '${STATUS_LABELS[currentStatus] || currentStatus}' sang '${STATUS_LABELS[newStatus] || newStatus}'` });
    }

    // Business rules per transition
    if (newStatus === 'active') {
      if (!cls.masterTrainer) return json(res, 400, { message: 'Phải gán Master Trainer trước khi bắt đầu lớp' });
      const enrolled = (enrollments[id] || []).length;
      if (enrolled < 1) return json(res, 400, { message: 'Phải có ít nhất 1 học viên trước khi bắt đầu lớp' });
    }
    if (newStatus === 'cancelled' && !reason) {
      return json(res, 400, { message: 'Phải nhập lý do hủy lớp học' });
    }
    if (newStatus === 'closed' && !reason) {
      return json(res, 400, { message: 'Phải nhập lý do đóng lớp học' });
    }

    const prevStatus = cls.status;
    cls.status = newStatus;

    // Record status log
    if (!statusLogs[id]) statusLogs[id] = [];
    statusLogs[id].push({
      from: prevStatus,
      to: newStatus,
      reason,
      changedBy: 'Admin',
      changedAt: new Date().toISOString()
    });

    return json(res, 200, { message: `Đã chuyển trạng thái lớp '${cls.code}' sang '${STATUS_LABELS[newStatus]}'`, class: cls, log: statusLogs[id] });
  }

  // GET /api/classes/:id/status (history)
  if (req.method === 'GET' && classStatusMatch) {
    const id = parseInt(classStatusMatch[1], 10);
    const cls = classes.find(c => c.id === id);
    if (!cls) return json(res, 404, { message: `Class #${id} not found` });
    return json(res, 200, {
      currentStatus: cls.status,
      transitions: STATUS_TRANSITIONS[cls.status] || [],
      allowedLabels: (STATUS_TRANSITIONS[cls.status] || []).map(s => ({ value: s, label: STATUS_LABELS[s] })),
      log: statusLogs[id] || []
    });
  }

  // ======== SESSIONS ========

  // GET /api/classes/:id/sessions
  if (req.method === 'GET' && classSessionsMatch) {
    const classId = parseInt(classSessionsMatch[1], 10);
    const sessions = classSessions.filter(s => s.classId === classId);
    return json(res, 200, sessions);
  }

  // POST /api/classes/:id/sessions - Create a new session
  if (req.method === 'POST' && classSessionsMatch) {
    const classId = parseInt(classSessionsMatch[1], 10);
    const cls = classes.find(c => c.id === classId);
    if (!cls) return json(res, 404, { message: `Class #${classId} not found` });
    if (cls.status === 'completed' || cls.status === 'closed' || cls.status === 'cancelled') {
      return json(res, 400, { message: 'Không thể thêm buổi học vào lớp đã hoàn thành/đóng/hủy' });
    }

    const data = await readBody(req);
    if (!data.date) return json(res, 400, { message: 'date is required' });
    if (!data.topic) return json(res, 400, { message: 'topic is required' });

    sessionIdCounter++;
    const newSession = {
      id: sessionIdCounter,
      classId,
      date: data.date,
      slot: data.slot || 'Morning (08:30-12:00)',
      topic: data.topic,
      trainer: data.trainer || cls.masterTrainer,
      room: data.room || 'Center Building Room 101',
      type: data.type || 'lecture',
      status: 'upcoming'
    };
    classSessions.push(newSession);
    return json(res, 201, newSession);
  }

  // PUT /api/classes/:classId/sessions/:sessionId
  if (req.method === 'PUT' && classSessionItemMatch) {
    const classId = parseInt(classSessionItemMatch[1], 10);
    const sessionId = parseInt(classSessionItemMatch[2], 10);
    const idx = classSessions.findIndex(s => s.id === sessionId && s.classId === classId);
    if (idx === -1) return json(res, 404, { message: `Session #${sessionId} not found` });
    const data = await readBody(req);
    classSessions[idx] = { ...classSessions[idx], ...data, id: sessionId, classId };
    return json(res, 200, classSessions[idx]);
  }

  // DELETE /api/classes/:classId/sessions/:sessionId
  if (req.method === 'DELETE' && classSessionItemMatch) {
    const classId = parseInt(classSessionItemMatch[1], 10);
    const sessionId = parseInt(classSessionItemMatch[2], 10);
    const idx = classSessions.findIndex(s => s.id === sessionId && s.classId === classId);
    if (idx === -1) return json(res, 404, { message: `Session #${sessionId} not found` });
    if (classSessions[idx].status === 'completed') return json(res, 400, { message: 'Không thể xóa buổi học đã hoàn thành' });
    classSessions.splice(idx, 1);
    return json(res, 200, { message: `Đã xóa buổi học #${sessionId}` });
  }

  // ======== ATTENDANCE ========

  // GET /api/classes/:classId/sessions/:sessionId/attendance
  if (req.method === 'GET' && attendanceMatch) {
    const classId = parseInt(attendanceMatch[1], 10);
    const sessionId = parseInt(attendanceMatch[2], 10);
    const trainees = getClassTrainees(classId, classSessions);
    const result = trainees.map(t => ({
      traineeId: t.id,
      traineeName: t.fullName,
      traineeCode: t.code,
      status: attendanceRecords[`${classId}_${sessionId}_${t.id}`] || 'not_marked'
    }));
    return json(res, 200, result);
  }

  // PUT /api/classes/:classId/sessions/:sessionId/attendance - Bulk mark attendance
  if (req.method === 'PUT' && attendanceMatch) {
    const classId = parseInt(attendanceMatch[1], 10);
    const sessionId = parseInt(attendanceMatch[2], 10);
    const session = classSessions.find(s => s.id === sessionId && s.classId === classId);
    if (!session) return json(res, 404, { message: 'Session not found' });

    const data = await readBody(req); // { records: [{traineeId, status}] }
    if (!Array.isArray(data.records)) return json(res, 400, { message: 'records array required' });

    for (const r of data.records) {
      attendanceRecords[`${classId}_${sessionId}_${r.traineeId}`] = r.status;
    }
    // Mark session completed if all attendance marked
    session.status = 'completed';
    return json(res, 200, { message: `Đã lưu điểm danh cho ${data.records.length} học viên` });
  }

  // ======== BUDGET ========

  // GET /api/classes/:id/budget
  if (req.method === 'GET' && classBudgetMatch) {
    const classId = parseInt(classBudgetMatch[1], 10);
    const budget = budgets[classId];
    if (!budget) return json(res, 200, { classId, items: [], plannedRevenue: 0 });
    const totalPlanned = budget.items.reduce((s, i) => s + i.amount, 0);
    const totalActual = budget.items.reduce((s, i) => s + (i.actual || 0), 0);
    return json(res, 200, { ...budget, totalPlanned, totalActual, profitLoss: budget.plannedRevenue - totalActual });
  }

  // POST /api/classes/:id/budget - Add budget item
  if (req.method === 'POST' && classBudgetMatch) {
    const classId = parseInt(classBudgetMatch[1], 10);
    if (!budgets[classId]) budgets[classId] = { classId, items: [], plannedRevenue: 0 };
    const data = await readBody(req);
    if (!data.category || !data.description || !data.amount) {
      return json(res, 400, { message: 'category, description, amount are required' });
    }
    const newId = budgets[classId].items.length > 0 ? Math.max(...budgets[classId].items.map(i => i.id)) + 1 : 1;
    const item = { id: newId, ...data, actual: data.actual || 0 };
    budgets[classId].items.push(item);
    return json(res, 201, item);
  }

  // PUT /api/classes/:id/budget/revenue - Update planned revenue
  if (req.method === 'PUT' && pathname.match(/^\/api\/classes\/(\d+)\/budget\/revenue$/)) {
    const classId = parseInt(pathname.match(/^\/api\/classes\/(\d+)\/budget\/revenue$/)[1], 10);
    if (!budgets[classId]) budgets[classId] = { classId, items: [], plannedRevenue: 0 };
    const data = await readBody(req);
    budgets[classId].plannedRevenue = parseInt(data.plannedRevenue, 10) || 0;
    return json(res, 200, { message: 'Updated', plannedRevenue: budgets[classId].plannedRevenue });
  }

  // ======== AUDITS ========

  // GET /api/classes/:id/audits
  if (req.method === 'GET' && classAuditMatch) {
    const classId = parseInt(classAuditMatch[1], 10);
    return json(res, 200, auditRecords.filter(a => a.classId === classId));
  }

  // GET /api/audits (all audits)
  if (req.method === 'GET' && pathname === '/api/audits') {
    return json(res, 200, auditRecords);
  }

  // POST /api/audits - Create audit
  if (req.method === 'POST' && pathname === '/api/audits') {
    const data = await readBody(req);
    if (!data.classId || !data.auditDate || !data.auditor) {
      return json(res, 400, { message: 'classId, auditDate, auditor are required' });
    }
    const cls = classes.find(c => c.id === parseInt(data.classId, 10));
    if (!cls) return json(res, 404, { message: 'Class not found' });

    const scores = [
      data.trainerProfessionalism, data.materialQuality,
      data.studentsEngagement, data.syllabusCompliance
    ].map(Number).filter(n => !isNaN(n));
    const overall = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const result = overall >= 4 ? 'pass' : overall >= 3 ? 'warning' : 'fail';

    auditIdCounter++;
    const newAudit = {
      id: auditIdCounter,
      classId: parseInt(data.classId, 10),
      classCode: cls.code,
      auditDate: data.auditDate,
      auditor: data.auditor,
      trainerProfessionalism: Number(data.trainerProfessionalism) || 3,
      materialQuality: Number(data.materialQuality) || 3,
      studentsEngagement: Number(data.studentsEngagement) || 3,
      syllabusCompliance: Number(data.syllabusCompliance) || 3,
      overallScore: Math.round(overall * 100) / 100,
      result,
      notes: data.notes || '',
      actionItems: []
    };
    auditRecords.push(newAudit);
    return json(res, 201, newAudit);
  }

  // ======== DASHBOARD ANALYTICS ========

  if (req.method === 'GET' && pathname === '/api/analytics') {
    const total = classes.length;
    const byStatus = {};
    classes.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
    const totalTrainees = classes.reduce((s, c) => s + (c.enrolledTrainees || 0), 0);
    const passRate = classes.filter(c => c.status === 'completed').length / (total || 1) * 100;

    const bySite = {};
    classes.forEach(c => { bySite[c.site || 'Unknown'] = (bySite[c.site || 'Unknown'] || 0) + 1; });

    const bySkill = {};
    classes.forEach(c => { bySkill[c.skills || 'Other'] = (bySkill[c.skills || 'Other'] || 0) + 1; });

    const fillRate = classes.map(c => ({
      code: c.code,
      enrolled: c.enrolledTrainees || 0,
      planned: c.plannedSize || 1,
      pct: Math.round(((c.enrolledTrainees || 0) / (c.plannedSize || 1)) * 100)
    }));

    return json(res, 200, {
      totalClasses: total,
      activeClasses: byStatus['active'] || 0,
      completedClasses: byStatus['completed'] || 0,
      totalTrainees,
      passRate: Math.round(passRate),
      byStatus,
      bySite,
      bySkill,
      fillRate,
      auditStats: {
        total: auditRecords.length,
        pass: auditRecords.filter(a => a.result === 'pass').length,
        warning: auditRecords.filter(a => a.result === 'warning').length,
        fail: auditRecords.filter(a => a.result === 'fail').length,
      }
    });
  }

  // ======== CLASSES CRUD ========

  // POST /api/classes (Create)
  if (req.method === 'POST' && pathname === '/api/classes') {
    try {
      const data = await readBody(req);
      if (!data.code || !data.code.trim()) return json(res, 400, { message: "Mã lớp học (Class Code) không được để trống" });
      const existing = classes.find(c => c.code.toLowerCase() === data.code.trim().toLowerCase());
      if (existing) return json(res, 400, { message: `Mã lớp '${data.code}' đã tồn tại trong hệ thống` });
      if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate))
        return json(res, 400, { message: "Ngày kết thúc phải sau ngày bắt đầu" });
      const plannedSize = parseInt(data.plannedSize, 10) || 20;
      if (plannedSize < 1 || plannedSize > 50) return json(res, 400, { message: "Sĩ số dự kiến phải từ 1 đến 50 học viên" });

      const nextId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
      const newClass = {
        id: nextId, code: data.code.trim(), name: data.name ? data.name.trim() : data.code.trim(),
        site: data.site || "HCM", traineeType: data.traineeType || "Fresher",
        program: data.program || data.trainingProgram || "FR_NFP_JAVA",
        trainingProgram: data.trainingProgram || data.program || "FR_NFP_JAVA",
        programId: data.programId || 1, classAdmin: data.classAdmin || "Admin",
        enrolledTrainees: 0, plannedSize,
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        endDate: data.endDate || new Date(Date.now() + 90*86400000).toISOString().split('T')[0],
        masterTrainer: data.masterTrainer || "NgaTTT45", status: data.status || "planning",
        deliveryType: data.deliveryType || "Class", formatType: data.formatType || "Offline",
        skills: data.skills || "Java", location: data.location || "Center Building, HCM",
        subjectType: data.subjectType || "IT Technical", plannedRevenue: data.plannedRevenue || "0 VND",
        scope: data.scope || "Unit", supplierPartner: data.supplierPartner || "SCM",
        keyProgram: data.keyProgram || "No", globalSe: data.globalSe || "No", jobRecommendation: data.jobRecommendation || "No"
      };
      classes.unshift(newClass);
      enrollments[nextId] = [];
      return json(res, 201, newClass);
    } catch (err) { return json(res, 400, { message: "Dữ liệu không hợp lệ", error: err.message }); }
  }

  // PUT /api/classes/:id (Update)
  if (req.method === 'PUT' && classDetailMatch) {
    try {
      const id = parseInt(classDetailMatch[1], 10);
      const index = classes.findIndex(c => c.id === id);
      if (index === -1) return json(res, 404, { message: `Lớp học #${id} không tồn tại` });
      const existing = classes[index];
      const data = await readBody(req);
      if (data.code && data.code.trim() !== existing.code) {
        if (existing.status === 'active' || existing.status === 'completed')
          return json(res, 400, { message: "Không thể thay đổi mã lớp khi lớp đang học hoặc đã hoàn thành" });
      }
      const startDate = data.startDate || existing.startDate;
      const endDate = data.endDate || existing.endDate;
      if (startDate && endDate && new Date(endDate) < new Date(startDate))
        return json(res, 400, { message: "Ngày kết thúc phải sau ngày bắt đầu" });
      classes[index] = { ...existing, ...data, id: existing.id };
      return json(res, 200, classes[index]);
    } catch (err) { return json(res, 400, { message: "Dữ liệu cập nhật không hợp lệ", error: err.message }); }
  }

  // DELETE /api/classes/:id
  if (req.method === 'DELETE' && classDetailMatch) {
    const id = parseInt(classDetailMatch[1], 10);
    const index = classes.findIndex(c => c.id === id);
    if (index === -1) return json(res, 404, { message: `Lớp học #${id} không tồn tại` });
    const item = classes[index];
    if (item.enrolledTrainees && item.enrolledTrainees > 0)
      return json(res, 400, { message: `Không thể xóa lớp '${item.code}' vì đã có ${item.enrolledTrainees} học viên tham gia` });
    if (item.status === 'active' || item.status === 'completed')
      return json(res, 400, { message: `Không thể xóa lớp '${item.code}' khi đang ở trạng thái ${item.status}` });
    classes.splice(index, 1);
    return json(res, 200, { message: `Đã xóa lớp học #${id} thành công` });
  }

  // POST /api/classes/batch
  if (req.method === 'POST' && pathname === '/api/classes/batch') {
    try {
      const items = await readBody(req);
      if (!Array.isArray(items)) return json(res, 400, { message: "Dữ liệu batch phải là một danh sách" });
      let count = 0;
      for (const data of items) {
        if (!data.code) continue;
        const nextId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
        classes.push({
          id: nextId, code: data.code.trim(), name: data.name ? data.name.trim() : data.code.trim(),
          site: data.site || "HCM", traineeType: data.traineeType || "Fresher",
          program: data.program || "FR_NFP_JAVA", trainingProgram: data.trainingProgram || data.program || "FR_NFP_JAVA",
          programId: data.programId || 1, classAdmin: data.classAdmin || "Admin",
          enrolledTrainees: parseInt(data.enrolledTrainees, 10) || 0, plannedSize: parseInt(data.plannedSize, 10) || 20,
          startDate: data.startDate || new Date().toISOString().split('T')[0],
          endDate: data.endDate || new Date(Date.now() + 90*86400000).toISOString().split('T')[0],
          masterTrainer: data.masterTrainer || "NgaTTT45", status: data.status || "planning",
          deliveryType: data.deliveryType || "Class", formatType: data.formatType || "Offline",
          skills: data.skills || "Java", location: data.location || "Center Building, HCM",
          subjectType: data.subjectType || "IT Technical", plannedRevenue: "0 VND",
          scope: "Unit", supplierPartner: "SCM", keyProgram: "No", globalSe: "No", jobRecommendation: "No"
        });
        enrollments[nextId] = [];
        count++;
      }
      return json(res, 200, { message: `Đã import thành công ${count} lớp học`, count });
    } catch (err) { return json(res, 400, { message: "Lỗi import", error: err.message }); }
  }

  if (pathname === '/api/trainers') { return json(res, 200, trainers); }
  if (pathname === '/api/rooms') { return json(res, 200, rooms); }

  
  // ======== FAMS BUDGET & OPERATION INFO ========
  if (req.method === 'GET' && classOperationMatch) {
    const classId = parseInt(classOperationMatch[1], 10);
    return json(res, 200, getOrCreateBudgetOperation(classId));
  }

  if (req.method === 'PUT' && classOperationMatch) {
    const classId = parseInt(classOperationMatch[1], 10);
    const data = await readBody(req);
    const current = getOrCreateBudgetOperation(classId);
    budgetOperations[classId] = {
      ...current,
      ...data,
      classId,
    };
    appendClassActivity(classId, 'UyenHTM', 'has updated class operating info and milestone configuration.', 'history');
    return json(res, 200, budgetOperations[classId]);
  }

  // ======== TOPIC ASSESSMENTS ========
  if (req.method === 'GET' && classAssessmentsMatch) {
    const classId = parseInt(classAssessmentsMatch[1], 10);
    const data = getOrCreateTopicAssessments(classId);
    return json(res, 200, data.current);
  }

  if (req.method === 'PUT' && classAssessmentsMatch) {
    const classId = parseInt(classAssessmentsMatch[1], 10);
    const body = await readBody(req);
    const state = getOrCreateTopicAssessments(classId);
    if (body.action === 'discard') {
      state.current = JSON.parse(JSON.stringify(state.baseline));
    } else if (body.action === 'reject') {
      state.current = (body.topics || state.current).map(t => ({
        ...t,
        assessments: (t.assessments || []).map(a => ({ ...a, changeStatus: 'none' }))
      }));
      appendClassActivity(classId, 'UyenHTM', 'has rejected topic assessment configuration changes.', 'history');
    } else if (body.action === 'confirm') {
      state.current = (body.topics || state.current).map(t => ({
        ...t,
        assessments: (t.assessments || []).map(a => ({
          ...a,
          changeStatus: a.changeStatus === 'waiting' ? 'confirmed' : a.changeStatus
        }))
      }));
      state.baseline = JSON.parse(JSON.stringify(state.current));
      appendClassActivity(classId, 'UyenHTM', 'has confirmed topic assessment configuration.', 'history');
    } else if (Array.isArray(body.topics)) {
      state.current = body.topics;
    }
    return json(res, 200, state.current);
  }

  // ======== CLASS ACTIVITIES ========
  if (req.method === 'GET' && classActivitiesMatch) {
    const classId = parseInt(classActivitiesMatch[1], 10);
    return json(res, 200, getOrCreateClassActivities(classId));
  }

  if (req.method === 'POST' && classActivitiesMatch) {
    const classId = parseInt(classActivitiesMatch[1], 10);
    const body = await readBody(req);
    const author = body.author || 'UyenHTM';
    const content = body.content || '';
    const type = body.type || 'comment';
    const newEntry = appendClassActivity(classId, author, content, type);
    return json(res, 201, newEntry);
  }

  return json(res, 404, { message: "Not found" });
});

const PORT = 9090;
server.listen(PORT, () => {
  console.log(`\n🚀 Mock Master Training System running on http://localhost:${PORT}`);
  console.log(`   Classes:   GET  /api/classes`);
  console.log(`   Trainees:  GET  /api/classes/:id/trainees`);
  console.log(`   Sessions:  GET  /api/classes/:id/sessions`);
  console.log(`   Attendance:GET  /api/classes/:id/sessions/:sid/attendance`);
  console.log(`   Budget:    GET  /api/classes/:id/budget`);
  console.log(`   Audits:    GET  /api/audits`);
  console.log(`   Analytics: GET  /api/analytics\n`);
});
