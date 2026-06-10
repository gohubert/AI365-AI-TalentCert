/**
 * exam-store.js — 題庫存取層
 * 公務AI共通核心能力認證考試系統
 *
 * 管理加密題庫檔案的匯入、列表、載入、刪除
 * 管理加密考生名冊
 */

const fs = require('fs');
const path = require('path');
const cryptoManager = require('./crypto-manager');

let dataDir = '';
let examsDir = '';
let studentsDir = '';
let resultsDir = '';
let configPath = '';

/**
 * Initialize the store with the application data directory
 * @param {string} appDataDir - Path to the app data directory
 */
function init(appDataDir) {
  dataDir = appDataDir;
  examsDir = path.join(dataDir, 'exams');
  studentsDir = path.join(dataDir, 'students');
  resultsDir = path.join(dataDir, 'results');
  configPath = path.join(dataDir, 'config.json');

  // Ensure directories exist
  [examsDir, studentsDir, resultsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Ensure config file exists
  if (!fs.existsSync(configPath)) {
    saveConfig({ activeExamIds: [], settings: {} });
  }
}

// ── Config ──

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { activeExamId: null, settings: {} };
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// ── Exam Management ──

/**
 * Import a question bank from JSON data and encrypt it
 */
function importExam(examData, adminPassword, category) {
  if (!examData.exam || !examData.questions || !Array.isArray(examData.questions)) {
    throw new Error('題庫格式不正確：需包含 exam 和 questions 欄位');
  }
  if (examData.questions.length === 0) {
    throw new Error('題庫不可為空');
  }

  // ── 防呆驗證：逐題檢查必填欄位 ──
  var errors = [];
  examData.questions.forEach(function (q, i) {
    var num = '第 ' + (i + 1) + ' 題（id=' + (q.id || '?') + '）：';
    if (!q.id && q.id !== 0) errors.push(num + '缺少 id');
    if (!q.type && q.type !== '單選' && q.type !== '複選' && q.type !== 'single' && q.type !== 'multiple') {
      errors.push(num + '缺少 type（需為「單選」或「複選」）');
    }
    if (!q.question && !q.text) errors.push(num + '缺少題目文字（question 或 text）');
    if (!q.options) {
      errors.push(num + '缺少 options（選項）');
    } else if (!Array.isArray(q.options) && typeof q.options === 'object') {
      if (Object.keys(q.options).length < 2) errors.push(num + 'options 至少需要 2 個選項');
    } else if (Array.isArray(q.options) && q.options.length < 2) {
      errors.push(num + 'options 至少需要 2 個選項');
    }
    if (!q.answer && q.answer !== 0) errors.push(num + '缺少 answer（正確答案）');
  });

  if (errors.length > 0) {
    var maxShow = Math.min(errors.length, 5);
    var msg = '題庫驗證失敗（共 ' + errors.length + ' 個問題）：\n' + errors.slice(0, maxShow).join('\n');
    if (errors.length > maxShow) msg += '\n...還有 ' + (errors.length - maxShow) + ' 個問題';
    throw new Error(msg);
  }

  const examId = 'exam_' + Date.now();
  const encFilePath = path.join(examsDir, examId + '.enc');
  const metaFilePath = path.join(examsDir, examId + '.meta.json');

  const encrypted = cryptoManager.encryptObject(examData, adminPassword);
  fs.writeFileSync(encFilePath, encrypted);

  const meta = {
    id: examId,
    category: category || 'practice',  // 'practice' | 'formal'
    title: examData.exam.title || '未命名考試',
    subject: examData.exam.subject || '',
    level: examData.exam.level || '',
    questionCount: examData.questions.length,
    totalTime: examData.exam.totalTime || 50,
    importedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaFilePath, JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}


function listExams() {
  if (!fs.existsSync(examsDir)) return [];
  const files = fs.readdirSync(examsDir);
  const exams = [];
  files.forEach(file => {
    if (file.endsWith('.meta.json')) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(examsDir, file), 'utf8'));
        const encFile = file.replace('.meta.json', '.enc');
        if (fs.existsSync(path.join(examsDir, encFile))) {
          exams.push(meta);
        }
      } catch { }
    }
  });
  exams.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
  return exams;
}

function loadExam(examId, adminPassword) {
  const encFilePath = path.join(examsDir, examId + '.enc');
  if (!fs.existsSync(encFilePath)) {
    throw new Error('找不到題庫檔案：' + examId);
  }
  const encrypted = fs.readFileSync(encFilePath);
  return cryptoManager.decryptObject(encrypted, adminPassword);
}

function deleteExam(examId) {
  const encFilePath = path.join(examsDir, examId + '.enc');
  const metaFilePath = path.join(examsDir, examId + '.meta.json');
  if (fs.existsSync(encFilePath)) fs.unlinkSync(encFilePath);
  if (fs.existsSync(metaFilePath)) fs.unlinkSync(metaFilePath);
  // Remove from active list
  const config = loadConfig();
  const ids = config.activeExamIds || [];
  const idx = ids.indexOf(examId);
  if (idx > -1) {
    ids.splice(idx, 1);
    config.activeExamIds = ids;
    saveConfig(config);
  }
}

function renameExam(examId, newTitle) {
  const metaFilePath = path.join(examsDir, examId + '.meta.json');
  if (!fs.existsSync(metaFilePath)) {
    throw new Error('找不到題庫：' + examId);
  }
  const meta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
  meta.title = newTitle;
  fs.writeFileSync(metaFilePath, JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

function toggleActiveExam(examId) {
  const config = loadConfig();
  const ids = config.activeExamIds || [];
  const idx = ids.indexOf(examId);
  if (idx > -1) {
    ids.splice(idx, 1);  // deactivate
  } else {
    ids.push(examId);    // activate
  }
  config.activeExamIds = ids;
  saveConfig(config);
  return ids;
}

function getActiveExamIds() {
  const config = loadConfig();
  return config.activeExamIds || [];
}

// ── Student Roster Management ──

function importStudentRoster(students, adminPassword) {
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error('考生名冊不可為空');
  }
  students.forEach((s, i) => {
    if (!s.name || !s.password) {
      throw new Error(`考生資料不完整（第 ${i + 1} 筆）：需包含 name, password`);
    }
  });

  const rosterPath = path.join(studentsDir, 'roster.enc');
  const encrypted = cryptoManager.encryptObject(students, adminPassword);
  fs.writeFileSync(rosterPath, encrypted);

  const metaPath = path.join(studentsDir, 'roster.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    count: students.length,
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

function loadStudentRoster(adminPassword) {
  const rosterPath = path.join(studentsDir, 'roster.enc');
  if (!fs.existsSync(rosterPath)) return [];
  const encrypted = fs.readFileSync(rosterPath);
  return cryptoManager.decryptObject(encrypted, adminPassword);
}

/**
 * Toggle allowExam for a student (by password/身分證字號)
 */
function updateStudentAllow(studentPassword, allowExam, adminPassword) {
  const students = loadStudentRoster(adminPassword);
  const student = students.find(s => s.password === studentPassword);
  if (!student) throw new Error('找不到考生：' + studentPassword);
  student.allowExam = allowExam;

  const rosterPath = path.join(studentsDir, 'roster.enc');
  const encrypted = cryptoManager.encryptObject(students, adminPassword);
  fs.writeFileSync(rosterPath, encrypted);
  return student;
}

function getStudentRosterMeta() {
  const metaPath = path.join(studentsDir, 'roster.meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch { return null; }
}

function hasStudentRoster() {
  return fs.existsSync(path.join(studentsDir, 'roster.enc'));
}

// ── Exam Results Management ──

/**
 * Save an exam result locally
 * @param {Object} result - The exam result object
 */
function saveResult(result, existingFilename) {
  var filename = existingFilename || ('result_' + (result.studentId || 'unknown') + '_' + Date.now() + '.json');
  const filePath = path.join(resultsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
  return filename;
}

/**
 * Load all exam results
 * @returns {Array} Array of result objects sorted by date descending
 */
function loadResults() {
  if (!fs.existsSync(resultsDir)) return [];
  const files = fs.readdirSync(resultsDir);
  const results = [];
  files.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
        data._filename = file;
        results.push(data);
      } catch { }
    }
  });
  results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return results;
}

/**
 * Delete a single result by filename
 */
function deleteResult(filename) {
  const filePath = path.join(resultsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Clear all exam results
 */
function clearResults() {
  if (!fs.existsSync(resultsDir)) return;
  const files = fs.readdirSync(resultsDir);
  files.forEach(file => {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(resultsDir, file));
    }
  });
}

// ── Error Reports Management ──

let reportsDir = '';

function initReportsDir() {
  if (!reportsDir && dataDir) {
    reportsDir = path.join(dataDir, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  }
}

function saveReport(report) {
  initReportsDir();
  const filename = 'report_' + Date.now() + '.json';
  const filePath = path.join(reportsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filename;
}

function loadReports() {
  initReportsDir();
  if (!fs.existsSync(reportsDir)) return [];
  const files = fs.readdirSync(reportsDir);
  const reports = [];
  files.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8'));
        data._filename = file;
        reports.push(data);
      } catch { }
    }
  });
  reports.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  return reports;
}

function clearReports() {
  initReportsDir();
  if (!fs.existsSync(reportsDir)) return;
  const files = fs.readdirSync(reportsDir);
  files.forEach(file => {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(reportsDir, file));
    }
  });
}

// ── Wrong Questions (錯題庫) ──

function getWrongDir() {
  const dir = path.join(dataDir, 'wrong');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getWrongFilePath(studentId) {
  // Sanitize student ID for filename
  const safeId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getWrongDir(), safeId + '.json');
}

function loadWrongQuestions(studentId) {
  const filePath = getWrongFilePath(studentId);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveWrongQuestions(studentId, wrongObj) {
  const filePath = getWrongFilePath(studentId);
  fs.writeFileSync(filePath, JSON.stringify(wrongObj, null, 2), 'utf8');
}

function clearWrongQuestions(studentId) {
  const filePath = getWrongFilePath(studentId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = {
  init,
  importExam, listExams, loadExam, deleteExam, renameExam,
  toggleActiveExam, getActiveExamIds,
  importStudentRoster, loadStudentRoster, updateStudentAllow, getStudentRosterMeta, hasStudentRoster,
  saveResult, loadResults, deleteResult, clearResults,
  saveReport, loadReports, clearReports,
  loadConfig, saveConfig,
  loadWrongQuestions, saveWrongQuestions, clearWrongQuestions,
};
