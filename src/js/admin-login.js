/**
 * admin-login.js — 管理者登入邏輯
 * 支援首次設定密碼和後續登入驗證
 */
(function () {
  'use strict';

  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('adminPassword');
  const confirmGroup = document.getElementById('confirmGroup');
  const confirmInput = document.getElementById('confirmPassword');
  const errorMsg = document.getElementById('errorMsg');
  const errorText = document.getElementById('errorText');
  const loginTitle = document.getElementById('loginTitle');
  const loginSubtitle = document.getElementById('loginSubtitle');
  const btnSubmit = document.getElementById('btnSubmit');

  let isFirstTime = false;

  function showError(msg) {
    errorText.textContent = msg;
    errorMsg.classList.add('show');
    passwordInput.classList.add('error');
  }

  function clearError() {
    errorMsg.classList.remove('show');
    passwordInput.classList.remove('error');
  }

  // Check if admin is initialized
  async function checkInit() {
    if (!window.api) return;
    isFirstTime = !(await window.api.admin.isInitialized());

    if (isFirstTime) {
      loginTitle.textContent = '首次設定管理者密碼';
      loginSubtitle.textContent = '請設定管理者密碼（至少 6 個字元）';
      btnSubmit.innerHTML = '💾 設定密碼';
      confirmGroup.classList.remove('hidden');
    }
  }

  // Handle form submit
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();

    const password = passwordInput.value;

    if (!password) {
      showError('請輸入密碼');
      return;
    }

    if (!window.api) {
      showError('系統初始化失敗');
      return;
    }

    if (isFirstTime) {
      // First-time setup
      const confirm = confirmInput.value;

      if (password.length < 6) {
        showError('密碼長度至少需要 6 個字元');
        return;
      }

      if (password !== confirm) {
        showError('兩次輸入的密碼不一致');
        return;
      }

      const result = await window.api.admin.init(password);
      if (result.success) {
        sessionStorage.setItem('adminPassword', password);
        window.location.href = 'admin-panel.html';
      } else {
        showError(result.error || '設定失敗');
      }
    } else {
      // Login verification
      const result = await window.api.admin.verify(password);
      if (result.success) {
        sessionStorage.setItem('adminPassword', password);
        window.location.href = 'admin-panel.html';
      } else {
        showError(result.error || '密碼不正確');
      }
    }
  });

  passwordInput.addEventListener('input', clearError);

  // Back button
  document.getElementById('btnBack').addEventListener('click', function () {
    window.location.href = 'index.html';
  });

  document.getElementById('btnCancel').addEventListener('click', function () {
    window.location.href = 'index.html';
  });

  checkInit();
})();
