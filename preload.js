/**
 * preload.js — 安全 API 橋接
 * 公務AI共通核心能力認證考試系統
 *
 * 透過 contextBridge 暴露安全的 API 給渲染進程
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── App Control ──
  closeApp: () => ipcRenderer.invoke('app:close'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),

  // ── Wrong Questions (錯題庫) ──
  wrong: {
    load: (studentId) => ipcRenderer.invoke('wrong:load', studentId),
    save: (studentId, wrongObj) => ipcRenderer.invoke('wrong:save', { studentId, wrongObj }),
    clear: (studentId) => ipcRenderer.invoke('wrong:clear', studentId),
  },

  // ── Admin Auth ──
  admin: {
    isInitialized: () => ipcRenderer.invoke('admin:is-initialized'),
    init: (password) => ipcRenderer.invoke('admin:init', password),
    verify: (password) => ipcRenderer.invoke('admin:verify', password),
    changePassword: (oldPassword, newPassword) =>
      ipcRenderer.invoke('admin:change-password', { oldPassword, newPassword }),
  },

  // ── Exam Store ──
  exam: {
    list: () => ipcRenderer.invoke('exam:list'),
    import: (adminPassword, category) => ipcRenderer.invoke('exam:import', { adminPassword, category }),
    importData: (examData, adminPassword, category) =>
      ipcRenderer.invoke('exam:import-data', { examData, adminPassword, category }),
    load: (examId, adminPassword) =>
      ipcRenderer.invoke('exam:load', { examId, adminPassword }),
    delete: (examId) => ipcRenderer.invoke('exam:delete', examId),
    rename: (examId, newTitle) => ipcRenderer.invoke('exam:rename', { examId, newTitle }),
    toggleActive: (examId) => ipcRenderer.invoke('exam:toggle-active', examId),
    getActiveIds: () => ipcRenderer.invoke('exam:get-active-ids'),
    getActiveMeta: () => ipcRenderer.invoke('exam:get-active-meta'),
  },

  // ── Student Roster ──
  roster: {
    import: (adminPassword) => ipcRenderer.invoke('roster:import', { adminPassword }),
    importData: (students, adminPassword) =>
      ipcRenderer.invoke('roster:import-data', { students, adminPassword }),
    load: (adminPassword) => ipcRenderer.invoke('roster:load', adminPassword),
    meta: () => ipcRenderer.invoke('roster:meta'),
    has: () => ipcRenderer.invoke('roster:has'),
    toggleAllow: (studentPassword, allowExam, adminPassword) =>
      ipcRenderer.invoke('roster:toggle-allow', { studentPassword, allowExam, adminPassword }),
  },

  // ── Exam Session ──
  session: {
    validateStudent: (studentPassword, adminPassword) =>
      ipcRenderer.invoke('session:validate-student', { studentPassword, adminPassword }),
    loadExam: (adminPassword) => ipcRenderer.invoke('session:load-exam', adminPassword),
    startRemote: (studentId) => ipcRenderer.invoke('session:start-remote', studentId),
    endRemote: (studentId, sessionId) =>
      ipcRenderer.invoke('session:end-remote', { studentId, sessionId }),
  },

  // ── Device ──
  device: {
    fingerprint: () => ipcRenderer.invoke('device:fingerprint'),
  },

  // ── Dialog ──
  dialog: {
    showConfirm: (options) => ipcRenderer.invoke('dialog:show-confirm', options),
  },

  // ── Remote API ──
  remote: {
    examStatus: () => ipcRenderer.invoke('api:exam-status'),
    login: (password) => ipcRenderer.invoke('api:login', password),
    downloadPractice: () => ipcRenderer.invoke('api:download-practice'),
    downloadFormal: () => ipcRenderer.invoke('api:download-formal'),
    uploadResult: (result) => ipcRenderer.invoke('api:upload-result', result),
  },

  // ── Results ──
  results: {
    list: () => ipcRenderer.invoke('results:list'),
    clear: () => ipcRenderer.invoke('results:clear'),
    delete: (filename) => ipcRenderer.invoke('results:delete', filename),
  },

  // ── Reports ──
  reports: {
    submit: (report) => ipcRenderer.invoke('reports:submit', report),
    list: () => ipcRenderer.invoke('reports:list'),
    clear: () => ipcRenderer.invoke('reports:clear'),
  },
});
