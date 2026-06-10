/**
 * index.js — 考生登入首頁
 *
 * 流程：
 * 1. 輸入身分證字號 → 雲端驗證（含繳費狀態）
 * 2. 驗證通過 → 查詢考試模式（practice / exam）
 * 3. practice → 下載模擬題（含答案+詳解）→ 進入刷題模式
 *    exam → 進入考前須知 → 正式考試
 */
(function () {
  'use strict';

  // DOM refs
  var loginForm = document.getElementById('loginForm');
  var studentIdInput = document.getElementById('studentId');
  var errorMsg = document.getElementById('errorMsg');
  var errorText = document.getElementById('errorText');
  var loginBtn = document.getElementById('btnLogin');
  var loginStatus = document.getElementById('loginStatus');

  function showError(msg) {
    errorText.textContent = msg;
    errorMsg.classList.add('show');
    studentIdInput.classList.add('error');
    studentIdInput.focus();
    setLoading(false);
  }

  function clearError() {
    errorMsg.classList.remove('show');
    studentIdInput.classList.remove('error');
  }

  function setLoading(loading) {
    if (loading) {
      loginBtn.disabled = true;
      loginBtn.textContent = '驗證中...';
      if (loginStatus) loginStatus.style.display = 'block';
    } else {
      loginBtn.disabled = false;
      loginBtn.textContent = '登入';
      if (loginStatus) loginStatus.style.display = 'none';
    }
  }

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();

    var inputId = studentIdInput.value.trim().toUpperCase();

    if (!inputId) {
      showError('請輸入考生帳號（身分證字號）');
      return;
    }

    setLoading(true);

    // Step 1: Cloud login verification (includes payment check)
    var loginResult = await window.api.remote.login(inputId);

    if (!loginResult.success) {
      showError(loginResult.error);
      return;
    }

    var student = loginResult.data;

    // Store student info
    sessionStorage.setItem('currentStudent', JSON.stringify(student));

    // Show mode selection overlay
    setLoading(false);
    showModeChoice(student);
  });

  // ── Mode Selection (after login) ──

  async function showModeChoice(student) {
    var wrongQuestions = await getWrongQuestions(student.id);
    var overlay = document.getElementById('modeChoiceOverlay');

    // Build buttons
    var btnsHtml = '<button class="btn btn-primary" id="btnModePractice" style="padding:14px;font-size:1rem;width:100%;">📝 模擬練習</button>';

    if (wrongQuestions.length > 0) {
      btnsHtml += '<button class="btn btn-outline" id="btnModeWrong" style="padding:14px;font-size:1rem;width:100%;">❌ 錯題練習（<span id="wrongCountBadge">' + wrongQuestions.length + '</span> 題）</button>';
    }

    if (student.paid || student.allowExam) {
      btnsHtml += '<button class="btn btn-success" id="btnModeFormal" style="padding:14px;font-size:1.05rem;width:100%;">🏆 正式考試</button>';
    }

    document.getElementById('modeChoiceBtns').innerHTML = btnsHtml;
    document.getElementById('modeStudentName').textContent = student.name + '，您好！';
    overlay.style.display = 'flex';

    // Practice
    document.getElementById('btnModePractice').onclick = function () {
      overlay.style.display = 'none';
      sessionStorage.setItem('examMode', 'practice');
      startRandomPractice();
    };

    // Wrong questions
    if (wrongQuestions.length > 0) {
      document.getElementById('btnModeWrong').onclick = function () {
        overlay.style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startWrongPractice(student, wrongQuestions);
      };
    }

    // Formal exam
    if (student.paid || student.allowExam) {
      document.getElementById('btnModeFormal').onclick = function () {
        overlay.style.display = 'none';
        sessionStorage.setItem('examMode', 'exam');
        startFormalExam();
      };
    }
  }

  async function startFormalExam() {
    setLoading(true);
    if (loginStatus) loginStatus.textContent = '正在下載正式考題...';
    var examResult = await window.api.remote.downloadFormal();

    if (!examResult.success) {
      showError('下載考題失敗：' + examResult.error);
      return;
    }

    sessionStorage.setItem('examData', JSON.stringify(examResult.data));
    window.location.href = 'exam-info.html';
  }

  // ── Practice Mode Selection ──

  async function startRandomPractice() {
    setLoading(true);
    if (loginStatus) loginStatus.textContent = '正在下載模擬試題...';
    var practiceResult = await window.api.remote.downloadPractice();

    if (!practiceResult.success) {
      showError('下載題目失敗：' + practiceResult.error);
      return;
    }

    sessionStorage.setItem('examData', JSON.stringify(practiceResult.data));
    window.location.href = 'practice.html';
  }

  function startWrongPractice(student, wrongQuestions) {
    // Build exam data from wrong questions
    var examData = {
      exam: {
        title: '錯題練習',
        subject: '複習模式',
        level: '',
        totalTime: 0,
        passingScore: 60,
        pointsPerQuestion: wrongQuestions.length > 0 ? Math.floor(100 / wrongQuestions.length) : 2,
      },
      questions: wrongQuestions.map(function (q, i) {
        return {
          id: i + 1,
          type: q.type,
          text: q.text,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation || '',
        };
      }),
      mode: 'practice',
    };

    sessionStorage.setItem('examData', JSON.stringify(examData));
    window.location.href = 'practice.html';
  }

  async function getWrongQuestions(studentId) {
    try {
      var result = await window.api.wrong.load(studentId);
      if (!result.success) return [];
      return Object.values(result.data);
    } catch (e) {
      return [];
    }
  }



  studentIdInput.addEventListener('input', clearError);

  // Cancel button — close app
  document.getElementById('btnCancel').addEventListener('click', function () {
    if (window.api) window.api.closeApp();
  });

  // Admin hidden entrance
  document.getElementById('adminHint').addEventListener('click', function () {
    window.location.href = 'admin-login.html';
  });

  // ── Network check on startup ──
  async function checkNetwork() {
    try {
      // Try to reach a reliable endpoint
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 5000);
      await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return true;
    } catch (e) {
      return false;
    }
  }

  (async function () {
    // Display version
    if (window.api && window.api.getVersion) {
      var ver = await window.api.getVersion();
      var versionTag = document.getElementById('versionTag');
      if (versionTag) versionTag.textContent = 'v' + ver;
    }

    var online = await checkNetwork();
    if (!online) {
      loginBtn.disabled = true;
      showError('網路連線異常，請確認網路連線後重新啟動程式。');
      studentIdInput.disabled = true;
    } else {
      studentIdInput.focus();
    }
  })();

  // ── Auto Update Notification ──
  if (window.api && window.api.onUpdateStatus) {
    var updateOverlay = null;

    window.api.onUpdateStatus(function (data) {
      if (data.status === 'downloading' || data.status === 'ready') {
        // Show update overlay
        if (!updateOverlay) {
          updateOverlay = document.createElement('div');
          updateOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
          updateOverlay.innerHTML = '<div style="background:var(--bg-card,#1e1e2e);border-radius:16px;padding:40px 48px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.4);max-width:440px;width:90%;">'
            + '<div style="font-size:3rem;margin-bottom:12px;">🔄</div>'
            + '<h2 id="updateTitle" style="margin-bottom:10px;color:var(--primary,#6c9fff);">正在更新程式...</h2>'
            + '<p id="updateMsg" style="color:var(--text-secondary,#aaa);margin-bottom:16px;line-height:1.7;"></p>'
            + '<div id="updateProgress" style="background:var(--bg-secondary,#333);border-radius:8px;height:8px;overflow:hidden;margin-top:12px;">'
            + '<div id="updateBar" style="background:var(--primary,#6c9fff);height:100%;width:0%;transition:width 0.3s;border-radius:8px;"></div>'
            + '</div>'
            + '</div>';
          document.body.appendChild(updateOverlay);
          // Disable interaction
          loginBtn.disabled = true;
          studentIdInput.disabled = true;
        }

        var msgEl = document.getElementById('updateMsg');
        var barEl = document.getElementById('updateBar');
        var titleEl = document.getElementById('updateTitle');

        if (msgEl) msgEl.textContent = data.message || '';
        if (barEl && data.percent) barEl.style.width = data.percent + '%';

        if (data.status === 'ready') {
          if (titleEl) titleEl.textContent = '更新即將完成';
          if (barEl) barEl.style.width = '100%';
          if (msgEl) msgEl.textContent = data.message;
        }
      }
    });
  }
})();
