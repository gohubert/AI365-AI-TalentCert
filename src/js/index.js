/**
 * index.js — 考生登入首頁
 *
 * 流程：
 * 1. 輸入身分證字號 → 雲端驗證（含繳費狀態）
 * 2. 驗證通過 → 查詢考試模式
 * 3. 顯示 3 次模擬考 + 錯題練習 + 正式考試（需管理者開放）
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
    var mockUsed = student.mock_attempts_used || 0;
    var maxMock = 3;

    // Build buttons — 3 separate mock exam buttons
    var btnsHtml = '';

    for (var i = 1; i <= maxMock; i++) {
      var completed = i <= mockUsed;
      var isCurrent = i === mockUsed + 1;
      var isLocked = i > mockUsed + 1;

      if (completed) {
        btnsHtml += '<button class="btn" style="padding:14px;font-size:0.95rem;width:100%;background:#E2E8F0;color:#64748B;cursor:default;" disabled>'
          + '✅ 第 ' + i + ' 次模擬考（已完成）</button>';
      } else if (isCurrent) {
        btnsHtml += '<button class="btn btn-primary" id="btnMock' + i + '" style="padding:14px;font-size:1rem;width:100%;">'
          + '📝 第 ' + i + ' 次模擬考</button>';
      } else {
        btnsHtml += '<button class="btn" style="padding:14px;font-size:0.95rem;width:100%;background:#F1F5F9;color:#94A3B8;cursor:default;" disabled>'
          + '🔒 第 ' + i + ' 次模擬考（需先完成前一次）</button>';
      }
    }

    // Wrong questions review
    if (wrongQuestions.length > 0) {
      btnsHtml += '<button class="btn btn-outline" id="btnModeWrong" style="padding:14px;font-size:1rem;width:100%;">❌ 錯題練習（<span id="wrongCountBadge">' + wrongQuestions.length + '</span> 題）</button>';
    }

    // Formal exam — check if exam room is activated
    if (student.paid || student.allowExam) {
      var examActive = false;
      try {
        var statusResult = await window.api.remote.examStatus();
        if (statusResult.success && statusResult.data && statusResult.data.active) {
          examActive = true;
        }
      } catch(e) { /* no exam active */ }

      if (examActive) {
        btnsHtml += '<div style="border-top:2px solid #E2E8F0;margin-top:8px;padding-top:12px;">'
          + '<button class="btn btn-success" id="btnModeFormal" style="padding:14px;font-size:1.05rem;width:100%;">🏆 進入考場（正式考試）</button>'
          + '</div>';
      } else {
        btnsHtml += '<div style="border-top:2px solid #E2E8F0;margin-top:8px;padding-top:12px;">'
          + '<div style="text-align:center;color:#94A3B8;font-size:0.85rem;padding:10px;">'
          + '🔒 正式考試尚未開放，請等待管理者啟動考場'
          + '</div></div>';
      }
    }

    // Exit button
    btnsHtml += '<div style="margin-top:12px;">'
      + '<button class="btn btn-secondary" id="btnModeExit" style="padding:12px;font-size:0.95rem;width:100%;">🚪 離開系統</button>'
      + '</div>';

    document.getElementById('modeChoiceBtns').innerHTML = btnsHtml;
    document.getElementById('modeStudentName').textContent = student.name + '，您好！';
    overlay.style.display = 'flex';

    // Bind mock exam button (only the current one)
    var currentMockBtn = document.getElementById('btnMock' + (mockUsed + 1));
    if (currentMockBtn) {
      currentMockBtn.onclick = function () {
        overlay.style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        sessionStorage.setItem('mockAttempt', mockUsed + 1);
        startRandomPractice();
      };
    }

    // Wrong questions
    if (wrongQuestions.length > 0) {
      document.getElementById('btnModeWrong').onclick = function () {
        overlay.style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startWrongPractice(student, wrongQuestions);
      };
    }

    // Formal exam
    var formalBtn = document.getElementById('btnModeFormal');
    if (formalBtn) {
      formalBtn.onclick = function () {
        overlay.style.display = 'none';
        sessionStorage.setItem('examMode', 'exam');
        startFormalExam();
      };
    }

    // Exit
    document.getElementById('btnModeExit').onclick = function () {
      if (window.api) window.api.closeApp();
    };
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
    // Display version + update status
    if (window.api && window.api.getVersion) {
      var ver = await window.api.getVersion();
      var versionTag = document.getElementById('versionTag');
      if (versionTag) {
        versionTag.innerHTML = 'v' + ver + ' <span id="updateStatusTag" style="margin-left:6px;font-weight:500;"></span>';
      }
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
      var statusTag = document.getElementById('updateStatusTag');

      if (data.status === 'checking') {
        if (statusTag) {
          statusTag.style.color = '#3B82F6';
          statusTag.textContent = '（檢查更新中...）';
        }
      }

      if (data.status === 'up-to-date') {
        if (statusTag) {
          statusTag.style.color = '#10B981';
          statusTag.textContent = '（已是最新版 ✓）';
        }
      }

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
          if (statusTag) statusTag.textContent = '（更新完成，重啟生效）';
        }
      }
    });
  }
})();
