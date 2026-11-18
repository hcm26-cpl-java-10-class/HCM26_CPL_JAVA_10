const fs = require('fs');
const path = require('path');
const XLSX = require('d:/OJT/HCM26_CPL_JAVA_10/frontend/node_modules/xlsx');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'test-data');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Tech groups and categories for realistic data
const TECH_GROUPS = ['Java', 'Frontend', 'Database', 'DevOps', 'Testing', 'Cloud', 'Security', 'Mobile', 'Data_Engineering', 'AI_ML'];
const SUBJECT_PREFIXES = ['L1_JV', 'L2_JV', 'L1_FE', 'L2_FE', 'L1_DB', 'L2_DB', 'L1_DO', 'L1_QA', 'L1_CL', 'L1_AI'];

const BASE_EXISTING_SUBJECTS = [
  'JAVA_CORE',
  'SPRING_BOOT',
  'DATABASE_SQL',
  'REACT_FRONTEND',
  'DEVOPS_BASIC',
  'TESTING_QA',
  'L1_AL_CCGM',
  'L1_AL_GC',
  'L1_AL_TME',
  'L1_AL_PSE'
];

function saveWorkbook(filenameBase, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const xlsxPath = path.join(OUTPUT_DIR, `${filenameBase}.xlsx`);
  const csvPath = path.join(OUTPUT_DIR, `${filenameBase}.csv`);

  XLSX.writeFile(wb, xlsxPath);

  // Write CSV with UTF-8 BOM
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8');

  console.log(`Generated: ${xlsxPath} (${rows.length} rows)`);
  console.log(`Generated: ${csvPath}`);
}

// ==========================================
// 1. TOPIC: 100 VALID ROWS
// ==========================================
function generateTopics100() {
  const rows = [];
  for (let i = 1; i <= 100; i++) {
    const pad = String(i).padStart(3, '0');
    const group = TECH_GROUPS[(i - 1) % TECH_GROUPS.length];
    rows.push({
      'Code': `TEST_TOPIC_${pad}`,
      'Name': `${group} Architecture & Practical Mastery Module ${pad}`,
      'Version': '1.0',
      'Technical Group': group,
      'Duration (Hours)': 10 + ((i * 5) % 50),
      'Description': `Detailed practical coursework and hands-on laboratory exercises for ${group} module ${pad}`,
      'Status': 'ACTIVE'
    });
  }
  saveWorkbook('topics_100_valid', rows);
}

// ==========================================
// 2. TOPIC: 1000 VALID ROWS
// ==========================================
function generateTopics1000() {
  const rows = [];
  for (let i = 1; i <= 1000; i++) {
    const pad = String(i).padStart(4, '0');
    const group = TECH_GROUPS[(i - 1) % TECH_GROUPS.length];
    rows.push({
      'Code': `BULK_TOPIC_${pad}`,
      'Name': `Enterprise ${group} Specialization Part ${pad}`,
      'Version': '1.0',
      'Technical Group': group,
      'Duration (Hours)': 16 + ((i * 4) % 64),
      'Description': `Industrial-scale module covering enterprise standards, unit testing, and design patterns for ${group}`,
      'Status': i % 10 === 0 ? 'INACTIVE' : 'ACTIVE'
    });
  }
  saveWorkbook('topics_1000_valid', rows);
}

// ==========================================
// 3. TOPIC: WITH INTENTIONAL ERRORS (FOR ROLLBACK & PREVIEW EDIT TEST)
// ==========================================
function generateTopicsWithErrors() {
  const rows = [
    {
      'Code': 'ERR_TOPIC_001',
      'Name': 'Valid Introduction to Clean Architecture',
      'Version': '1.0',
      'Technical Group': 'Java',
      'Duration (Hours)': 32,
      'Description': 'Valid starting row',
      'Status': 'ACTIVE'
    },
    {
      'Code': 'ERR_TOPIC_NUM_TG',
      'Name': 'Numeric Technical Group Topic (Must Be Text)',
      'Version': '1.0',
      'Technical Group': '100.0', // Error: Technical Group cannot be numeric!
      'Duration (Hours)': 20,
      'Description': 'Technical Group has number 100.0; test inline edit to change to Java',
      'Status': 'ACTIVE'
    },
    {
      'Code': '', // Error: Empty Code
      'Name': 'Missing Code Topic (Needs Fix in Preview)',
      'Version': '1.0',
      'Technical Group': 'Frontend',
      'Duration (Hours)': 24,
      'Description': 'Row has empty code; test inline edit to fill Code',
      'Status': 'ACTIVE'
    },
    {
      'Code': 'ERR_TOPIC_003',
      'Name': '', // Error: Empty Name
      'Version': '1.0',
      'Technical Group': 'Database',
      'Duration (Hours)': 40,
      'Description': 'Row has empty name; test inline edit to fill Name',
      'Status': 'ACTIVE'
    },
    {
      'Code': 'ERR_TOPIC_004',
      'Name': 'Invalid Duration Topic',
      'Version': '1.0',
      'Technical Group': 'DevOps',
      'Duration (Hours)': -20, // Error: Negative duration
      'Description': 'Duration must be positive; test inline edit to change to 20',
      'Status': 'ACTIVE'
    },
    {
      'Code': 'ERR_TOPIC_001', // Error: Duplicate Code & Version with Row 1
      'Name': 'Duplicate of Row 1 (Needs Delete or Code Change)',
      'Version': '1.0',
      'Technical Group': 'Java',
      'Duration (Hours)': 32,
      'Description': 'Duplicate row; test delete button or edit code',
      'Status': 'ACTIVE'
    },
    {
      'Code': 'ERR_TOPIC_OVERLONG',
      'Name': 'Valid Kubernetes Clustering for Developers',
      'Version': '1.0',
      'Technical Group': 'Cloud_Infrastructure_And_Distributed_Systems_Architecture_Engineering_Very_Long_Text_That_Exceeds_One_Hundred_Characters_Limit_To_Test_Validation', // Error: > 100 chars
      'Duration (Hours)': 48,
      'Description': 'Technical group length exceeds 100 chars; test inline edit to shorten it',
      'Status': 'ACTIVE'
    }
  ];
  saveWorkbook('topics_with_errors_to_test_rollback', rows);
}

// ==========================================
// 4. PROGRAM: 100 ROWS (25 PROGRAMS x 4 SUBJECTS)
// ==========================================
function generatePrograms100() {
  const rows = [];
  const REGIONS = ['HCM', 'HN', 'DN'];
  const subjects = ['JAVA_CORE', 'DATABASE_SQL', 'SPRING_BOOT', 'REACT_FRONTEND'];

  for (let p = 1; p <= 25; p++) {
    const pPad = String(p).padStart(2, '0');
    const pCode = `PROG_FULLSTACK_${pPad}`;
    const pName = `Fullstack Web Developer Cohort ${pPad}`;
    const pVersion = '1.0';
    const region = REGIONS[(p - 1) % REGIONS.length];

    for (let s = 0; s < subjects.length; s++) {
      rows.push({
        'programCode': pCode,
        'programName': pName,
        'programVersion': pVersion,
        'region': region,
        'subjectCode': subjects[s],
        'subjectVersion': '1.0',
        'orderIndex': s + 1
      });
    }
  }
  saveWorkbook('training_programs_100', rows);
}

// ==========================================
// 5. PROGRAM: 1000 ROWS (250 PROGRAMS x 4 SUBJECTS)
// ==========================================
function generatePrograms1000() {
  const rows = [];
  const REGIONS = ['HCM', 'HN', 'DN', 'GLOBAL'];
  const subjects = ['JAVA_CORE', 'DATABASE_SQL', 'SPRING_BOOT', 'REACT_FRONTEND'];

  for (let p = 1; p <= 250; p++) {
    const pPad = String(p).padStart(3, '0');
    const pCode = `BULK_PROG_${pPad}`;
    const pName = `Enterprise Standard Training Track ${pPad}`;
    const pVersion = '1.0';
    const region = REGIONS[(p - 1) % REGIONS.length];

    for (let s = 0; s < subjects.length; s++) {
      rows.push({
        'programCode': pCode,
        'programName': pName,
        'programVersion': pVersion,
        'region': region,
        'subjectCode': subjects[s],
        'subjectVersion': '1.0',
        'orderIndex': s + 1
      });
    }
  }
  saveWorkbook('training_programs_1000', rows);
}

// ==========================================
// 6. PROGRAM: WITH INTENTIONAL ERRORS (FOR ROLLBACK & PREVIEW EDIT TEST)
// ==========================================
function generateProgramsWithErrors() {
  const rows = [
    {
      'programCode': 'ERR_PROG_01',
      'programName': 'Sample Program With Errors',
      'programVersion': '1.0',
      'region': 'HCM',
      'subjectCode': 'JAVA_CORE',
      'subjectVersion': '1.0',
      'orderIndex': 1
    },
    {
      'programCode': 'ERR_PROG_01',
      'programName': 'Sample Program With Errors',
      'programVersion': '1.0',
      'region': 'HCM',
      'subjectCode': 'NON_EXISTING_SUBJECT_XYZ', // Error: Subject not in DB
      'subjectVersion': '1.0',
      'orderIndex': 2
    },
    {
      'programCode': 'ERR_PROG_01',
      'programName': 'Sample Program With Errors',
      'programVersion': '1.0',
      'region': 'HCM',
      'subjectCode': 'SPRING_BOOT',
      'subjectVersion': '1.0',
      'orderIndex': 2 // Error: Duplicate orderIndex
    },
    {
      'programCode': '', // Error: Empty programCode
      'programName': 'Program Missing Code',
      'programVersion': '1.0',
      'region': 'HN',
      'subjectCode': 'REACT_FRONTEND',
      'subjectVersion': '1.0',
      'orderIndex': 1
    }
  ];
  saveWorkbook('training_programs_with_errors_to_test_rollback', rows);
}

generateTopics100();
generateTopics1000();
generateTopicsWithErrors();
generatePrograms100();
generatePrograms1000();
generateProgramsWithErrors();

console.log('All test data files generated successfully in:', OUTPUT_DIR);

