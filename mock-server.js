const http = require('http');

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/classes
  if (req.method === 'GET' && pathname === '/api/classes') {
    const status = url.searchParams.get('status');
    let result = classes;
    if (status && status !== 'all') {
      result = classes.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
    }
    res.writeHead(200);
    res.end(JSON.stringify(result));
    return;
  }

  // GET /api/classes/:id
  const classDetailMatch = pathname.match(/^\/api\/classes\/(\d+)$/);
  if (req.method === 'GET' && classDetailMatch) {
    const id = parseInt(classDetailMatch[1], 10);
    const item = classes.find(c => c.id === id);
    if (item) {
      res.writeHead(200);
      res.end(JSON.stringify(item));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ message: `Class #${id} not found` }));
    }
    return;
  }

  // POST /api/classes (Create Class)
  if (req.method === 'POST' && pathname === '/api/classes') {
    try {
      const data = await readBody(req);

      // Business Rule 1: Code is required & unique
      if (!data.code || !data.code.trim()) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Mã lớp học (Class Code) không được để trống" }));
        return;
      }
      const existing = classes.find(c => c.code.toLowerCase() === data.code.trim().toLowerCase());
      if (existing) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: `Mã lớp '${data.code}' đã tồn tại trong hệ thống` }));
        return;
      }

      // Business Rule 2: Dates validation
      if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Ngày kết thúc phải sau ngày bắt đầu" }));
        return;
      }

      // Business Rule 3: Planned size must be positive
      const plannedSize = parseInt(data.plannedSize, 10) || 20;
      if (plannedSize < 1 || plannedSize > 50) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Sĩ số dự kiến phải từ 1 đến 50 học viên" }));
        return;
      }

      const nextId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
      const newClass = {
        id: nextId,
        code: data.code.trim(),
        name: data.name ? data.name.trim() : data.code.trim(),
        site: data.site || "HCM",
        traineeType: data.traineeType || "Fresher",
        program: data.program || data.trainingProgram || "FR_NFP_JAVA",
        trainingProgram: data.trainingProgram || data.program || "FR_NFP_JAVA",
        programId: data.programId || 1,
        classAdmin: data.classAdmin || "Admin",
        enrolledTrainees: 0,
        plannedSize: plannedSize,
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        endDate: data.endDate || new Date(Date.now() + 90*86400000).toISOString().split('T')[0],
        masterTrainer: data.masterTrainer || "NgaTTT45",
        status: data.status || "planning",
        deliveryType: data.deliveryType || "Class",
        formatType: data.formatType || "Offline",
        skills: data.skills || "Java",
        location: data.location || "Center Building, HCM",
        subjectType: data.subjectType || "IT Technical",
        plannedRevenue: data.plannedRevenue || "0 VND",
        scope: data.scope || "Unit",
        supplierPartner: data.supplierPartner || "SCM",
        keyProgram: data.keyProgram || "No",
        globalSe: data.globalSe || "No",
        jobRecommendation: data.jobRecommendation || "No"
      };

      classes.unshift(newClass);
      res.writeHead(201);
      res.end(JSON.stringify(newClass));
      return;
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ message: "Dữ liệu không hợp lệ", error: err.message }));
      return;
    }
  }

  // PUT /api/classes/:id (Update Class)
  if (req.method === 'PUT' && classDetailMatch) {
    try {
      const id = parseInt(classDetailMatch[1], 10);
      const index = classes.findIndex(c => c.id === id);
      if (index === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ message: `Lớp học #${id} không tồn tại` }));
        return;
      }

      const existing = classes[index];
      const data = await readBody(req);

      // Business Rule 4: Cannot change code if class is in progress or completed
      if (data.code && data.code.trim() !== existing.code) {
        if (existing.status === 'active' || existing.status === 'completed') {
          res.writeHead(400);
          res.end(JSON.stringify({ message: "Không thể thay đổi mã lớp khi lớp đang học hoặc đã hoàn thành" }));
          return;
        }
      }

      // Business Rule 2: Dates validation
      const startDate = data.startDate || existing.startDate;
      const endDate = data.endDate || existing.endDate;
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Ngày kết thúc phải sau ngày bắt đầu" }));
        return;
      }

      const updated = {
        ...existing,
        ...data,
        id: existing.id // protect id
      };
      classes[index] = updated;

      res.writeHead(200);
      res.end(JSON.stringify(updated));
      return;
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ message: "Dữ liệu cập nhật không hợp lệ", error: err.message }));
      return;
    }
  }

  // DELETE /api/classes/:id (Delete Class)
  if (req.method === 'DELETE' && classDetailMatch) {
    const id = parseInt(classDetailMatch[1], 10);
    const index = classes.findIndex(c => c.id === id);
    if (index === -1) {
      res.writeHead(404);
      res.end(JSON.stringify({ message: `Lớp học #${id} không tồn tại` }));
      return;
    }

    const item = classes[index];
    // Business Rule 5: Cannot delete if class has enrolled trainees or active/completed
    if (item.enrolledTrainees && item.enrolledTrainees > 0) {
      res.writeHead(400);
      res.end(JSON.stringify({ message: `Không thể xóa lớp '${item.code}' vì đã có ${item.enrolledTrainees} học viên tham gia` }));
      return;
    }
    if (item.status === 'active' || item.status === 'completed') {
      res.writeHead(400);
      res.end(JSON.stringify({ message: `Không thể xóa lớp '${item.code}' khi đang ở trạng thái ${item.status}` }));
      return;
    }

    classes.splice(index, 1);
    res.writeHead(200);
    res.end(JSON.stringify({ message: `Đã xóa lớp học #${id} thành công` }));
    return;
  }

  // POST /api/classes/batch (Import classes)
  if (req.method === 'POST' && pathname === '/api/classes/batch') {
    try {
      const items = await readBody(req);
      if (!Array.isArray(items)) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Dữ liệu batch phải là một danh sách" }));
        return;
      }

      let count = 0;
      for (const data of items) {
        if (!data.code) continue;
        const nextId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
        classes.push({
          id: nextId,
          code: data.code.trim(),
          name: data.name ? data.name.trim() : data.code.trim(),
          site: data.site || "HCM",
          traineeType: data.traineeType || "Fresher",
          program: data.program || "FR_NFP_JAVA",
          trainingProgram: data.trainingProgram || data.program || "FR_NFP_JAVA",
          programId: data.programId || 1,
          classAdmin: data.classAdmin || "Admin",
          enrolledTrainees: parseInt(data.enrolledTrainees, 10) || 0,
          plannedSize: parseInt(data.plannedSize, 10) || 20,
          startDate: data.startDate || new Date().toISOString().split('T')[0],
          endDate: data.endDate || new Date(Date.now() + 90*86400000).toISOString().split('T')[0],
          masterTrainer: data.masterTrainer || "NgaTTT45",
          status: data.status || "planning",
          deliveryType: data.deliveryType || "Class",
          formatType: data.formatType || "Offline",
          skills: data.skills || "Java",
          location: data.location || "Center Building, HCM",
          subjectType: data.subjectType || "IT Technical",
          plannedRevenue: "0 VND",
          scope: "Unit",
          supplierPartner: "SCM",
          keyProgram: "No",
          globalSe: "No",
          jobRecommendation: "No"
        });
        count++;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ message: `Đã import thành công ${count} lớp học`, count }));
      return;
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ message: "Lỗi import", error: err.message }));
      return;
    }
  }

  if (pathname === '/api/trainers') {
    res.writeHead(200);
    res.end(JSON.stringify(trainers));
    return;
  }

  if (pathname === '/api/rooms') {
    res.writeHead(200);
    res.end(JSON.stringify(rooms));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ message: "Not found" }));
});

const PORT = 9090;
server.listen(PORT, () => {
  console.log(`Mock Master Training System running on http://localhost:${PORT}`);
});
