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
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Calendar version history is sample data owned by this development service.
  const calendarsMatch = pathname.match(/^\/api\/classes\/(\d+)\/calendars$/);
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

  // GET /api/classes/:id
  if (req.method === 'GET' && classDetailMatch && !classStatusMatch && !classTraineesMatch && !classSessionsMatch && !classBudgetMatch && !classAuditMatch) {
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
