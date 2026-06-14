/**
 * api-client.js — 遠端 API 通訊模組（雲端版）
 * 公務AI共通核心能力認證考試系統
 *
 * 所有資料統一從 Supabase 雲端取得：
 * - 題庫：從 Netlify Function cert-questions 拉取
 * - 成績上傳：POST 到 Netlify Function cert-upload-result
 * - 報錯提交：POST 到 Netlify Function cert-report
 * - 考生驗證：本地名冊（保留離線考場功能）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ── Device Fingerprint ──
function getDeviceFingerprint() {
  const raw = os.platform() + '|' + os.arch() + '|' + os.hostname();
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

function getAppVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch { return '0.0.0'; }
}

// ── Configuration ──
const CONFIG = {
  BASE_URL: 'https://cert.ai365.fans/.netlify/functions',
  TIMEOUT: 30000,
  // 考試模式：'practice' 或 'exam'（管理者切換）
  EXAM_MODE: 'practice',
};

// ── 本地題庫快取（離線備用 + 正式考試卷）──
let LOCAL_QUESTION_BANK = [];
let LOCAL_EXAM_META = {};
try {
  const bankPath = path.join(__dirname, '..', 'data', 'question-bank.json');
  if (fs.existsSync(bankPath)) {
    const raw = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
    if (raw.exam && Array.isArray(raw.questions)) {
      LOCAL_EXAM_META = raw.exam;
      LOCAL_QUESTION_BANK = raw.questions.map(normalizeQuestion);
    } else if (Array.isArray(raw)) {
      LOCAL_QUESTION_BANK = raw.map(normalizeQuestion);
    }
    console.log('[API] Local cache: ' + LOCAL_QUESTION_BANK.length + ' questions');
  }
} catch (err) {
  console.error('[API] Local cache load failed:', err.message);
}

/**
 * 格式標準化：支援兩種題庫格式
 */
function normalizeQuestion(q) {
  if (Array.isArray(q.options) && q.text) return q;
  const normalized = {
    id: q.id,
    layer: q.layer || '',
    difficulty: q.difficulty || '',
    type: q.type === '複選' ? 'multiple' : (q.type === '單選' ? 'single' : (q.type || 'single')),
    text: q.question || q.text || '',
    options: [],
    answer: q.answer,
    explanation: q.explanation || '',
  };
  if (q.options && !Array.isArray(q.options)) {
    const keys = Object.keys(q.options).sort();
    normalized.options = keys.map(k => q.options[k]);
  } else {
    normalized.options = q.options || [];
  }
  return normalized;
}

// ── 考生名冊（保留本地，考場離線用）──
const STUDENT_ROSTER = [];
// 動態載入名冊
try {
  const rosterPath = path.join(__dirname, '..', 'data', 'roster.json');
  if (fs.existsSync(rosterPath)) {
    const rosterData = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
    if (Array.isArray(rosterData)) {
      STUDENT_ROSTER.push(...rosterData);
    } else if (rosterData.students) {
      STUDENT_ROSTER.push(...rosterData.students);
    }
    console.log('[API] Roster loaded: ' + STUDENT_ROSTER.length + ' students');
  }
} catch (e) {}

/**
 * 查詢考試模式
 */
async function getExamStatus() {
  try {
    const response = await fetch(CONFIG.BASE_URL + '/cert-exam-active', {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: { active: data.active || false, session: data.session || null } };
    }
  } catch (e) {
    console.warn('[API] Exam status check failed:', e.message);
  }
  return { success: true, data: { active: false } };
}

/**
 * 驗證考生登入
 * 優先從雲端（Supabase cert_orders）驗證已繳費考生
 * 失敗則降級到本地名冊（離線考場）
 */
async function loginStudent(studentPassword) {
  await new Promise(r => setTimeout(r, 200));

  // 1. 先嘗試雲端驗證：查詢已繳費的訂單（用身分證字號比對）
  try {
    const platform = process.platform === 'darwin' ? 'mac' : 'win';
    const version = getAppVersion();
    const response = await fetch(CONFIG.BASE_URL + '/cert-verify-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: studentPassword,
        platform: platform,
        version: version,
        deviceFingerprint: getDeviceFingerprint(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log('[API] Cloud login success:', data.student?.name);
        return {
          success: true,
          data: {
            id: studentPassword,
            name: data.student.name,
            password: studentPassword,
            paid: true,
            allowExam: data.student.allowExam !== false,
            userId: data.student.userId,
          },
        };
      }
    }
  } catch (err) {
    console.warn('[API] Cloud login failed, trying local roster:', err.message);
  }

  // 2. 降級到本地名冊（離線考場）
  const student = STUDENT_ROSTER.find(s => s.password === studentPassword);
  if (!student) return { success: false, error: '帳號不存在，請確認輸入的身分證字號' };
  return {
    success: true,
    data: {
      id: student.password,
      name: student.name,
      password: student.password,
      paid: student.paid,
      allowExam: student.allowExam || false,
    },
  };
}

/**
 * 從雲端下載練習題（含答案+詳解）
 * 優先從雲端 API 拉取，失敗則降級到本地快取
 */
async function downloadPracticeExam() {
  console.log('[API] Fetching practice questions from cloud...');
  try {
    const response = await fetch(CONFIG.BASE_URL + '/cert-questions?mode=practice', {
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();

    if (!data.questions || data.questions.length === 0) {
      throw new Error('雲端題庫為空');
    }

    // Shuffle and pick 50
    const shuffled = [...data.questions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(50, shuffled.length));
    selected.forEach((q, i) => { q.id = i + 1; });

    console.log('[API] Cloud practice: ' + selected.length + ' questions loaded');
    return {
      success: true,
      data: {
        exam: {
          title: data.exam?.title || '公務AI共通核心能力認證',
          level: data.exam?.level || '通識',
          subject: 'AI 人工智慧應用',
          totalTime: 0,  // 練習不限時
          passingScore: data.exam?.passingScore || 60,
          pointsPerQuestion: data.exam?.pointsPerQuestion || 2,
        },
        questions: selected,
        mode: 'practice',
      },
    };
  } catch (err) {
    console.warn('[API] Cloud fetch failed, falling back to local cache:', err.message);
    return downloadPracticeExamLocal();
  }
}

/**
 * 本地快取降級版練習題
 */
function downloadPracticeExamLocal() {
  if (LOCAL_QUESTION_BANK.length === 0) {
    return { success: false, error: '無法連線雲端，且本地無快取題庫' };
  }
  const shuffled = [...LOCAL_QUESTION_BANK].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(50, shuffled.length));
  selected.forEach((q, i) => { q.id = i + 1; });
  console.log('[API] Local fallback: ' + selected.length + ' questions');
  return {
    success: true,
    data: {
      exam: {
        title: LOCAL_EXAM_META.title || '公務AI共通核心能力認證',
        level: LOCAL_EXAM_META.level || '通識',
        subject: LOCAL_EXAM_META.subject || 'AI 人工智慧應用',
        totalTime: 0,
        passingScore: LOCAL_EXAM_META.passingScore || 60,
        pointsPerQuestion: LOCAL_EXAM_META.pointsPerQuestion || 2,
      },
      questions: selected,
      mode: 'practice',
    },
  };
}

/**
 * 下載正式考題（不含答案）
 * 正式考試仍用本地題庫（考場離線保障）
 */
async function downloadFormalExam() {
  const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // 先嘗試雲端，失敗用本地
  let bank = LOCAL_QUESTION_BANK;
  try {
    const response = await fetch(CONFIG.BASE_URL + '/cert-questions?mode=practice', {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        bank = data.questions;
        console.log('[API] Formal exam: using cloud questions (' + bank.length + ')');
      }
    }
  } catch (e) {
    console.warn('[API] Formal exam: cloud unavailable, using local cache');
  }

  if (bank.length === 0) {
    return { success: false, error: '無可用題庫' };
  }

  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(50, shuffled.length));
  selected.forEach((q, i) => { q.id = i + 1; });

  // 打亂選項順序
  const processed = selected.map(q => {
    var indices = q.options.map((_, i) => i);
    for (var i = indices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
    }
    var newOptions = indices.map(i => q.options[i]);
    var labelMap = {};
    indices.forEach((origIdx, newIdx) => {
      labelMap[LABELS[origIdx]] = LABELS[newIdx];
    });
    var newAnswer;
    if (Array.isArray(q.answer)) {
      newAnswer = q.answer.map(a => labelMap[a]).sort();
    } else {
      newAnswer = labelMap[q.answer];
    }
    return {
      id: q.id, type: q.type, text: q.text,
      options: newOptions, answer: newAnswer,
      _answerCount: Array.isArray(newAnswer) ? newAnswer.length : undefined,
    };
  });

  const stripped = processed.map(q => ({
    id: q.id, type: q.type, text: q.text, options: q.options,
    _answerCount: q._answerCount,
  }));

  return {
    success: true,
    data: {
      exam: {
        title: LOCAL_EXAM_META.title || '公務AI共通核心能力認證',
        level: LOCAL_EXAM_META.level || '通識',
        subject: LOCAL_EXAM_META.subject || 'AI 人工智慧應用',
        totalTime: LOCAL_EXAM_META.totalTime || 90,
        passingScore: LOCAL_EXAM_META.passingScore || 60,
        pointsPerQuestion: LOCAL_EXAM_META.pointsPerQuestion || 2,
      },
      questions: stripped,
      _answers: processed.map(q => ({ id: q.id, answer: q.answer })),
      mode: 'exam',
    },
  };
}

/**
 * 上傳考試成績到雲端
 */
async function uploadExamResult(result) {
  console.log('[API] Uploading result: ' + result.studentName + ' score=' + result.score + ' mode=' + result.mode);

  // 轉換欄位名稱以符合 Netlify Function 格式
  const payload = {
    studentId: result.studentId || result.studentPassword || '',
    studentName: result.studentName || '',
    mode: result.mode || 'practice',
    score: result.score,
    totalScore: result.totalScore,
    totalQuestions: result.totalQuestions,
    correctCount: result.correctCount,
    passingScore: result.passingScore || 60,
    passed: result.passed,
    timeUsedSeconds: result.timeUsedSeconds || 0,
    submittedAt: result.submittedAt || new Date().toISOString(),
    examTitle: result.examTitle,
    examLevel: result.examLevel || '通識',
    // 行為記錄欄位
    deviceOS: os.platform(),
    deviceArch: os.arch(),
    appVersion: getAppVersion(),
    examDurationSeconds: result.examDurationSeconds || result.timeUsedSeconds || 0,
    // 轉換 answer_details 格式
    answerDetails: (result.answers || []).map(a => ({
      question_no: a.questionId || a.id,
      question_text: a.questionText || '',
      student_answer: a.studentAnswer,
      correct_answer: a.correctAnswer,
      is_correct: a.isCorrect,
    })),
  };

  try {
    const response = await fetch(CONFIG.BASE_URL + '/cert-upload-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });
    const data = await response.json();
    if (data.success) {
      console.log('[API] Upload successful: resultId=' + data.resultId);
    } else {
      console.warn('[API] Upload response error:', data.error);
    }
    return data;
  } catch (err) {
    console.error('[API] Upload failed:', err.message);
    // 離線時暫存本地
    try {
      const offlinePath = path.join(__dirname, '..', 'data', 'offline-results');
      if (!fs.existsSync(offlinePath)) fs.mkdirSync(offlinePath, { recursive: true });
      const filename = 'result_' + Date.now() + '.json';
      fs.writeFileSync(path.join(offlinePath, filename), JSON.stringify(payload, null, 2));
      console.log('[API] Saved offline: ' + filename);
    } catch (e) {}
    return { success: false, error: '上傳失敗（已暫存本地）：' + err.message };
  }
}

// ── 考試 Session 管理（防止同時登入） ──

async function startExamSession(studentId) {
  console.log('[API] Starting exam session for:', studentId);
  try {
    const response = await fetch(CONFIG.BASE_URL + '/cert-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        studentId: studentId,
        deviceFingerprint: getDeviceFingerprint(),
      }),
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });
    const data = await response.json();
    if (response.status === 409) {
      // 已有 active session
      return { success: false, error: data.error || '此帳號正在另一台裝置考試中' };
    }
    return data;
  } catch (err) {
    console.warn('[API] Session start failed (allowing offline):', err.message);
    // 離線時允許考試（不阻斷）
    return { success: true, sessionId: null, offline: true };
  }
}

async function endExamSession(studentId, sessionId) {
  console.log('[API] Ending exam session for:', studentId);
  try {
    const response = await fetch(CONFIG.BASE_URL + '/cert-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'end',
        studentId: studentId,
        sessionId: sessionId || undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return await response.json();
  } catch (err) {
    console.warn('[API] Session end failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getExamStatus,
  loginStudent,
  downloadPracticeExam,
  downloadFormalExam,
  uploadExamResult,
  startExamSession,
  endExamSession,
  getDeviceFingerprint,
  CONFIG,
};
