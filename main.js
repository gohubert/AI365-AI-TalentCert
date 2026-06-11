/**
 * main.js — Electron 主進程
 * 公務AI共通核心能力認證考試系統
 *
 * 負責：視窗管理、IPC 頻道、安全設定、檔案操作
 */

const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const adminAuth = require('./lib/admin-auth');
const examStore = require('./lib/exam-store');
const apiClient = require('./lib/api-client');

let mainWindow;

// Application data directory
const APP_DATA_DIR = path.join(app.getPath('userData'), 'AI-TalentCert');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    center: true,
    resizable: false,
    minimizable: false,
    fullscreenable: true,
    title: '公務AI共通核心能力認證考試系統',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  });

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false);

  // Prevent screenshots/screen recording
  // [TEMP] 暫時關閉截圖保護，方便製作教學文件
  // mainWindow.setContentProtection(true);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Enter fullscreen after window is ready
  mainWindow.once('ready-to-show', () => {
    // mainWindow.setContentProtection(true); // [TEMP] 暫時關閉
    mainWindow.show();
    mainWindow.setFullScreen(true);

    // Auto-retry uploading pending results
    retryPendingUploads();
  });

  // Prevent leaving fullscreen
  mainWindow.on('leave-full-screen', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true);
      }
    }, 100);
  });
}

/**
 * Register global shortcuts to block macOS screenshot keys
 * Cmd+Shift+3 = full screen capture
 * Cmd+Shift+4 = selection capture
 * Cmd+Shift+5 = screenshot toolbar
 * Cmd+Shift+6 = Touch Bar capture
 * Also block PrintScreen for Windows
 */
function registerScreenshotBlockers() {
  const shortcuts = [
    'CommandOrControl+Shift+3',
    'CommandOrControl+Shift+4',
    'CommandOrControl+Shift+5',
    'CommandOrControl+Shift+6',
    'PrintScreen',
    'Alt+PrintScreen',
  ];

  shortcuts.forEach(key => {
    try {
      globalShortcut.register(key, () => {
        // Silently block — do nothing
        console.log('[Security] Screenshot attempt blocked:', key);
      });
    } catch (e) {
      // Some shortcuts may not be registerable on all platforms
    }
  });
}

// ── App Lifecycle ──

app.whenReady().then(() => {
  // Initialize modules
  adminAuth.init(APP_DATA_DIR);
  examStore.init(APP_DATA_DIR);

  createWindow();

  // Block screenshot hotkeys
  // registerScreenshotBlockers(); // [TEMP] 暫時關閉截圖攔截

  // ── Auto Update ──
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * 自動更新設定
 * 啟動時自動檢查 → 發現新版 → 自動下載 → 通知使用者 → 自動安裝重啟
 */
function setupAutoUpdater() {
  // 靜默檢查，不顯示對話框
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // 通知前端：正在檢查更新
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    sendToRenderer('update-status', { status: 'checking' });
  });

  // 有新版可用 → 自動下載（已設 autoDownload = true）
  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    sendToRenderer('update-status', {
      status: 'downloading',
      version: info.version,
      message: '偵測到新版本 v' + info.version + '，正在下載更新...',
    });
  });

  // 目前已是最新
  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Already up to date.');
    sendToRenderer('update-status', { status: 'up-to-date' });
  });

  // 下載進度
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      message: '下載更新中... ' + Math.round(progress.percent) + '%',
    });
  });

  // 下載完成 → 通知使用者將立即更新
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    sendToRenderer('update-status', {
      status: 'ready',
      version: info.version,
      message: '新版本 v' + info.version + ' 已下載完成，程式將立即重新啟動以完成更新。',
    });
    // 3 秒後自動安裝並重啟
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 3000);
  });

  // 更新錯誤（靜默處理，不阻斷使用者操作）
  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
    sendToRenderer('update-status', { status: 'error', message: err.message });
  });

  // 延遲 3 秒檢查（等視窗載入完成）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[Updater] Check failed:', err.message);
    });
  }, 3000);
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

app.on('window-all-closed', () => {
  app.isQuitting = true;
  app.quit();
});

app.on('will-quit', () => {
  // Release all global shortcuts when app quits
  globalShortcut.unregisterAll();
});

// ── IPC: Wrong Questions (錯題庫) ──

ipcMain.handle('wrong:load', (event, studentId) => {
  try {
    return { success: true, data: examStore.loadWrongQuestions(studentId) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('wrong:save', (event, { studentId, wrongObj }) => {
  try {
    examStore.saveWrongQuestions(studentId, wrongObj);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('wrong:clear', (event, studentId) => {
  try {
    examStore.clearWrongQuestions(studentId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: App Control ──

ipcMain.handle('app:close', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion() || '1.0.0';
});

ipcMain.handle('app:set-content-protection', (event, enabled) => {
  if (mainWindow) {
    mainWindow.setContentProtection(enabled);
  }
});

// ── IPC: Admin Authentication ──

ipcMain.handle('admin:is-initialized', () => {
  return adminAuth.isAdminInitialized();
});

ipcMain.handle('admin:init', (event, password) => {
  try {
    adminAuth.initAdmin(password);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('admin:verify', (event, password) => {
  try {
    const valid = adminAuth.verifyAdmin(password);
    return { success: valid, error: valid ? null : '密碼不正確' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('admin:change-password', (event, { oldPassword, newPassword }) => {
  try {
    adminAuth.changePassword(oldPassword, newPassword);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Exam Store ──

ipcMain.handle('exam:list', () => {
  try {
    return { success: true, data: examStore.listExams() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:import', async (event, { adminPassword, category }) => {
  try {
    // Open file dialog to select JSON
    var dialogTitle = category === 'formal' ? '選擇正式考卷 JSON 檔案' : '選擇模擬題庫 JSON 檔案';
    const result = await dialog.showOpenDialog(mainWindow, {
      title: dialogTitle,
      filters: [
        { name: 'JSON 檔案', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '已取消匯入' };
    }

    const filePath = result.filePaths[0];
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let examData = JSON.parse(fileContent);

    // ── 格式自動偵測與標準化 ──
    if (Array.isArray(examData)) {
      examData = {
        exam: { title: category === 'formal' ? '正式考卷' : '匯入題庫', subject: 'AI 人工智慧應用', level: '通識', totalTime: 50, passingScore: 60, pointsPerQuestion: 2 },
        questions: examData,
      };
    } else if (!examData.exam && examData.questions) {
      examData.exam = { title: category === 'formal' ? '正式考卷' : '匯入題庫', subject: 'AI 人工智慧應用', level: '通識', totalTime: 50, passingScore: 60, pointsPerQuestion: 2 };
    }

    const meta = examStore.importExam(examData, adminPassword, category || 'practice');
    return { success: true, data: meta };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:import-data', (event, { examData, adminPassword, category }) => {
  try {
    const meta = examStore.importExam(examData, adminPassword, category || 'practice');
    return { success: true, data: meta };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:load', (event, { examId, adminPassword }) => {
  try {
    const data = examStore.loadExam(examId, adminPassword);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:delete', (event, examId) => {
  try {
    examStore.deleteExam(examId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:toggle-active', (event, examId) => {
  try {
    const activeIds = examStore.toggleActiveExam(examId);
    return { success: true, data: activeIds };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:get-active-ids', () => {
  return examStore.getActiveExamIds();
});

ipcMain.handle('exam:rename', (event, { examId, newTitle }) => {
  try {
    const meta = examStore.renameExam(examId, newTitle);
    return { success: true, data: meta };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('exam:get-active-meta', () => {
  try {
    const activeIds = examStore.getActiveExamIds();
    if (activeIds.length === 0) return { success: false, error: '尚未啟用任何題庫' };
    const exams = examStore.listExams();
    const metas = exams.filter(e => activeIds.includes(e.id));
    if (metas.length === 0) return { success: false, error: '找不到啟用的題庫' };
    // Merge info
    const totalQuestions = metas.reduce((sum, m) => sum + (m.questionCount || 0), 0);
    return {
      success: true,
      data: {
        title: metas.map(m => m.title).join(' + '),
        questionCount: totalQuestions,
        bankCount: metas.length,
        metas: metas,
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Student Roster ──

ipcMain.handle('roster:import', async (event, { adminPassword }) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇考生名冊 JSON 檔案',
      filters: [
        { name: 'JSON 檔案', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '已取消匯入' };
    }

    const filePath = result.filePaths[0];
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let students = JSON.parse(fileContent);

    // Support both array format and { students: [...] } format
    if (students.students && Array.isArray(students.students)) {
      students = students.students;
    }

    examStore.importStudentRoster(students, adminPassword);
    return { success: true, count: students.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('roster:import-data', (event, { students, adminPassword }) => {
  try {
    examStore.importStudentRoster(students, adminPassword);
    return { success: true, count: students.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('roster:load', (event, adminPassword) => {
  try {
    const students = examStore.loadStudentRoster(adminPassword);
    return { success: true, data: students };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('roster:meta', () => {
  return examStore.getStudentRosterMeta();
});

ipcMain.handle('roster:has', () => {
  return examStore.hasStudentRoster();
});

ipcMain.handle('roster:toggle-allow', (event, { studentPassword, allowExam, adminPassword }) => {
  try {
    examStore.updateStudentAllow(studentPassword, allowExam, adminPassword);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Exam Session (for exam-taking) ──

// This validates a student and loads the active exam
ipcMain.handle('session:validate-student', (event, { studentPassword, adminPassword }) => {
  try {
    // Load student roster
    const students = examStore.loadStudentRoster(adminPassword);
    const student = students.find(
      s => s.password === studentPassword || s.id === studentPassword
    );

    if (!student) {
      return { success: false, error: '帳號不正確，請重新輸入' };
    }

    return { success: true, data: { id: student.id, name: student.name } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('session:load-exam', (event, adminPassword) => {
  try {
    const activeId = examStore.getActiveExamId();
    if (!activeId) {
      return { success: false, error: '尚未設定考試題庫，請聯繫管理者' };
    }

    const examData = examStore.loadExam(activeId, adminPassword);
    return { success: true, data: examData };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Dialog ──

ipcMain.handle('dialog:show-confirm', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'question',
    buttons: options.buttons || ['是(Y)', '否(N)'],
    defaultId: 1,
    title: options.title || '確認',
    message: options.message || '',
    detail: options.detail || '',
  });
  return result.response;
});

// ── IPC: Remote Session (防止同時登入) ──

ipcMain.handle('session:start-remote', async (event, studentId) => {
  try {
    return await apiClient.startExamSession(studentId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('session:end-remote', async (event, { studentId, sessionId }) => {
  try {
    return await apiClient.endExamSession(studentId, sessionId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('device:fingerprint', () => {
  return apiClient.getDeviceFingerprint();
});

// ── IPC: Remote API ──

ipcMain.handle('api:exam-status', async () => {
  try {
    return await apiClient.getExamStatus();
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api:login', async (event, studentPassword) => {
  try {
    return await apiClient.loginStudent(studentPassword);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api:download-practice', async () => {
  try {
    return await apiClient.downloadPracticeExam();
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api:download-formal', async () => {
  try {
    return await apiClient.downloadFormalExam();
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('api:upload-result', async (event, result) => {
  try {
    // Always save locally first (with upload status)
    result._uploaded = false;
    const savedFile = examStore.saveResult(result);

    // Try to upload
    try {
      const uploadResult = await apiClient.uploadExamResult(result);
      if (uploadResult.success) {
        // Mark as uploaded — update the SAME file
        result._uploaded = true;
        examStore.saveResult(result, savedFile);
      }
      return uploadResult;
    } catch (uploadErr) {
      // Upload failed, but data is safely saved locally
      console.log('[API] Upload failed, saved locally for retry:', uploadErr.message);
      return { success: false, error: uploadErr.message };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Results ──

ipcMain.handle('results:list', () => {
  try {
    return { success: true, data: examStore.loadResults() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('results:clear', () => {
  try {
    examStore.clearResults();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('results:delete', (event, filename) => {
  try {
    examStore.deleteResult(filename);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Reports ──

ipcMain.handle('reports:submit', async (event, report) => {
  try {
    // Save locally first
    examStore.saveReport(report);

    // Also upload to cloud
    try {
      await fetch('https://ai365.fans/.netlify/functions/cert-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: report.studentId,
          questionNo: report.questionIndex || report.questionId,
          reportType: 'other',
          content: report.reportContent || '',
        }),
        signal: AbortSignal.timeout(10000),
      });
      console.log('[Main] Report uploaded to cloud');
    } catch (cloudErr) {
      console.warn('[Main] Cloud report upload failed (saved locally):', cloudErr.message);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('reports:list', () => {
  try {
    return { success: true, data: examStore.loadReports() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('reports:clear', () => {
  try {
    examStore.clearReports();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Auto-retry pending uploads on startup ──

async function retryPendingUploads() {
  try {
    const results = examStore.loadResults();
    const pending = results.filter(r => r._uploaded === false);

    if (pending.length === 0) return;

    console.log('[Retry] Found ' + pending.length + ' pending uploads, retrying...');

    for (const result of pending) {
      try {
        const uploadResult = await apiClient.uploadExamResult(result);
        if (uploadResult.success) {
          result._uploaded = true;
          examStore.saveResult(result);
          console.log('[Retry] Successfully uploaded result for ' + result.studentId);
        }
      } catch (err) {
        console.log('[Retry] Still cannot upload for ' + result.studentId + ': ' + err.message);
      }
    }
  } catch (err) {
    console.error('[Retry] Error during pending upload retry:', err.message);
  }
}
