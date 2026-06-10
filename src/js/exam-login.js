/**
 * exam-login.js — 考生登入邏輯（兩步驟）
 * Step 1: 管理者輸入密碼解鎖考試系統
 * Step 2: 考生輸入身分證字號登入
 */
(function () {
  'use strict';

  // DOM refs — Unlock
  var unlockCard = document.getElementById('unlockCard');
  var unlockForm = document.getElementById('unlockForm');
  var adminPasswordInput = document.getElementById('adminPassword');
  var unlockError = document.getElementById('unlockError');
  var unlockErrorText = document.getElementById('unlockErrorText');

  // DOM refs — Student Login
  var studentCard = document.getElementById('studentCard');
  var loginForm = document.getElementById('loginForm');
  var studentIdInput = document.getElementById('studentId');
  var errorMsg = document.getElementById('errorMsg');
  var errorText = document.getElementById('errorText');
  var examTitle = document.getElementById('examTitle');

  var adminPassword = null;

  // Check if already unlocked (admin was just in the panel)
  async function checkExistingSession() {
    var storedPass = sessionStorage.getItem('adminPassword');
    if (storedPass) {
      // Verify it's still valid
      var result = await window.api.admin.verify(storedPass);
      if (result.success) {
        adminPassword = storedPass;
        showStudentLogin();
        return;
      }
    }
    // Show unlock card
    unlockCard.classList.remove('hidden');
  }

  // ── Step 1: Unlock ──

  function showUnlockError(msg) {
    unlockErrorText.textContent = msg;
    unlockError.classList.add('show');
    adminPasswordInput.classList.add('error');
  }

  function clearUnlockError() {
    unlockError.classList.remove('show');
    adminPasswordInput.classList.remove('error');
  }

  unlockForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearUnlockError();

    var pass = adminPasswordInput.value;
    if (!pass) {
      showUnlockError('請輸入管理者密碼');
      return;
    }

    // Check admin initialized
    var isInit = await window.api.admin.isInitialized();
    if (!isInit) {
      showUnlockError('管理者帳號尚未設定，請先至管理者登入設定密碼');
      return;
    }

    // Verify
    var result = await window.api.admin.verify(pass);
    if (!result.success) {
      showUnlockError('密碼不正確，請重新輸入');
      return;
    }

    // Check prerequisites
    var activeId = await window.api.exam.getActiveId();
    if (!activeId) {
      showUnlockError('尚未設定考試題庫，請先至管理者後台啟用題庫');
      return;
    }

    var hasRoster = await window.api.roster.has();
    if (!hasRoster) {
      showUnlockError('尚未匯入考生名冊，請先至管理者後台匯入名冊');
      return;
    }

    adminPassword = pass;
    sessionStorage.setItem('adminPassword', pass);
    showStudentLogin();
  });

  adminPasswordInput.addEventListener('input', clearUnlockError);

  // ── Step 2: Student Login ──

  async function showStudentLogin() {
    unlockCard.classList.add('hidden');
    studentCard.classList.remove('hidden');
    studentIdInput.focus();

    // Show exam info in subtitle
    var metaResult = await window.api.exam.getActiveMeta();
    if (metaResult.success) {
      var meta = metaResult.data;
      examTitle.textContent = '[' + (meta.level || '通識') + '] ' + (meta.subject || meta.title) + ' — 請輸入考生帳號';
    }
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorMsg.classList.add('show');
    studentIdInput.classList.add('error');
    studentIdInput.focus();
  }

  function clearError() {
    errorMsg.classList.remove('show');
    studentIdInput.classList.remove('error');
  }

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();

    var inputId = studentIdInput.value.trim().toUpperCase();

    if (!inputId) {
      showError('請輸入考生帳號（身分證字號）');
      return;
    }

    // Validate student
    var result = await window.api.session.validateStudent(inputId, adminPassword);

    if (!result.success) {
      showError(result.error || '帳號不正確，請重新輸入');
      return;
    }

    // Store student info and navigate
    sessionStorage.setItem('currentStudent', JSON.stringify(result.data));
    window.location.href = 'exam-info.html';
  });

  studentIdInput.addEventListener('input', clearError);

  // ── Navigation ──
  document.getElementById('btnBack1').addEventListener('click', function () {
    window.location.href = 'index.html';
  });
  document.getElementById('btnBack2').addEventListener('click', function () {
    window.location.href = 'index.html';
  });
  document.getElementById('btnCancel').addEventListener('click', function () {
    window.location.href = 'index.html';
  });

  // ── Init ──
  checkExistingSession();
})();
