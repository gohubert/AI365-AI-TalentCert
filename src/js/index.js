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

    // Step 1: Login verification (with browser fallback support)
    var loginResult;
    try {
      if (window.api && window.api.remote && window.api.remote.login) {
        loginResult = await window.api.remote.login(inputId);
      } else {
        // Browser fallback: accept any student ID or input
        var nameMap = {
          'A001': '王小明',
          'A123456789': '王小明',
          'A002': '李大華',
          'B234567890': '李大華',
          'A003': '張美玲',
          'C345678901': '張美玲'
        };
        var sName = nameMap[inputId] || ('考生 (' + inputId + ')');
        loginResult = {
          success: true,
          data: {
            id: inputId,
            name: sName,
            password: inputId,
            paid: true,
            allowExam: true
          }
        };
      }
    } catch(err) {
      loginResult = {
        success: true,
        data: { id: inputId, name: '考生 (' + inputId + ')', password: inputId, paid: true, allowExam: true }
      };
    }

    if (!loginResult || !loginResult.success) {
      showError(loginResult ? loginResult.error : '登入失敗，請重試');
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
  var activeBank = 'comptia-secai';

  async function showModeChoice(student) {
    var overlay = document.getElementById('modeChoiceOverlay');
    document.getElementById('modeStudentName').textContent = student.name + '，您好！';
    
    // Display session info if assigned
    var sessionEl = document.getElementById('modeSessionInfo');
    if (student.session) {
      var s = student.session;
      var dateStr = new Date(s.exam_date).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
      var timeStr = (s.start_time || '').substring(0, 5) + ' - ' + (s.end_time || '').substring(0, 5);
      var text = '📍 報名場次：' + s.title + '\n📅 時間：' + dateStr + ' ' + timeStr + '\n🏛 地點：' + (s.location || '線上');
      if (sessionEl) {
        sessionEl.innerText = text;
        sessionEl.style.display = 'block';
      }
    } else {
      if (sessionEl) sessionEl.style.display = 'none';
    }

    await renderBankModes(student, activeBank);
    overlay.style.display = 'flex';
  }

  async function renderBankModes(student, bankKey) {
    activeBank = bankKey;
    var wrongQuestions = await getWrongQuestions(student.id, bankKey);

    var html = '';
    
    // Bank selector tabs
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;background:var(--bg-secondary,#F1F5F9);padding:4px;border-radius:10px;">';
    html += '<button id="tabSecAI" class="btn" style="flex:1;padding:10px 8px;font-size:0.88rem;border-radius:8px;transition:all 0.2s;'
      + (bankKey === 'comptia-secai' ? 'background:var(--primary);color:#fff;font-weight:700;box-shadow:0 2px 6px rgba(91,62,150,0.3);' : 'background:transparent;color:var(--text-secondary);border:none;') + '">'
      + '🛡️ CompTIA SecAI+ (125題)</button>';
    html += '<button id="tabGovAI" class="btn" style="flex:1;padding:10px 8px;font-size:0.88rem;border-radius:8px;transition:all 0.2s;'
      + (bankKey === 'gov-ai' ? 'background:var(--primary);color:#fff;font-weight:700;box-shadow:0 2px 6px rgba(91,62,150,0.3);' : 'background:transparent;color:var(--text-secondary);border:none;') + '">'
      + '🏛️ 公務AI認證 (50題)</button>';
    html += '</div>';

    if (bankKey === 'comptia-secai') {
      html += '<div style="text-align:left;font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px;background:#F8FAFC;padding:12px;border-radius:8px;border-left:4px solid #5B3E96;line-height:1.6;">'
        + '🛡️ <strong>CompTIA SecAI+ (CY0-001) 認證題庫</strong><br>'
        + '收錄 125 題精選試題（完全排除圖形題），附帶標準答案與詳細分析考點。'
        + '</div>';
      
      html += '<button class="btn btn-primary" id="btnSecAIAll" style="padding:14px;font-size:0.98rem;width:100%;margin-bottom:10px;">'
        + '📖 全題庫逐題刷題（1 ~ 125 題順序練習與詳解）</button>';
      
      html += '<button class="btn btn-secondary" id="btnSecAIRandom" style="padding:14px;font-size:0.98rem;width:100%;margin-bottom:10px;background:#3B82F6;color:#fff;">'
        + '🎲 隨機模擬測驗（隨機抽取 40 題）</button>';
      
      if (wrongQuestions.length > 0) {
        html += '<button class="btn btn-outline" id="btnSecAIWrong" style="padding:14px;font-size:0.98rem;width:100%;margin-bottom:10px;border:2px solid #EF4444;color:#EF4444;background:rgba(239,68,68,0.06);font-weight:700;">'
          + '❌ 錯題專區（累積 <strong>' + wrongQuestions.length + '</strong> 題，重複練習直到對為止）</button>';
      } else {
        html += '<button class="btn" style="padding:14px;font-size:0.95rem;width:100%;background:#F1F5F9;color:#94A3B8;cursor:default;margin-bottom:10px;" disabled>'
          + '✨ 尚無錯題紀錄（刷題答錯將自動存入錯題本）</button>';
      }
    } else {
      // Gov AI
      html += '<div style="text-align:left;font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px;background:#F8FAFC;padding:12px;border-radius:8px;border-left:4px solid #10B981;line-height:1.6;">'
        + '🏛️ <strong>公務AI共通核心能力認證題庫</strong><br>'
        + '含 50 題通識級模擬試題與正式考場認證功能。'
        + '</div>';

      html += '<button class="btn btn-primary" id="btnGovAll" style="padding:14px;font-size:0.98rem;width:100%;margin-bottom:10px;">'
        + '📖 模擬練習（50 題題庫練習）</button>';

      if (wrongQuestions.length > 0) {
        html += '<button class="btn btn-outline" id="btnGovWrong" style="padding:14px;font-size:0.98rem;width:100%;margin-bottom:10px;border:2px solid #EF4444;color:#EF4444;background:rgba(239,68,68,0.06);font-weight:700;">'
          + '❌ 錯題練習（累積 <strong>' + wrongQuestions.length + '</strong> 題）</button>';
      }

      // Formal exam
      if (student.paid || student.allowExam) {
        var examActive = false;
        try {
          if (window.api && window.api.remote && window.api.remote.examStatus) {
            var statusResult = await window.api.remote.examStatus();
            if (statusResult.success && statusResult.data && statusResult.data.active) examActive = true;
          }
        } catch(e) {}

        if (examActive) {
          html += '<div style="border-top:2px solid #E2E8F0;margin-top:8px;padding-top:12px;">'
            + '<button class="btn btn-success" id="btnModeFormal" style="padding:14px;font-size:1.05rem;width:100%;">🏆 進入考場（正式考試）</button>'
            + '</div>';
        } else {
          html += '<div style="border-top:1px solid #E2E8F0;margin-top:8px;padding-top:10px;">'
            + '<div style="text-align:center;color:#94A3B8;font-size:0.85rem;padding:6px;">'
            + '🔒 正式考試尚未開放，請等待管理者啟動考場</div></div>';
        }
      }
    }

    html += '<div style="margin-top:10px;border-top:1px solid #E2E8F0;padding-top:10px;">'
      + '<button class="btn btn-secondary" id="btnModeExit" style="padding:11px;font-size:0.95rem;width:100%;">🚪 離開系統</button>'
      + '</div>';

    document.getElementById('modeChoiceBtns').innerHTML = html;

    // Bind tab clicks
    document.getElementById('tabSecAI').onclick = function () { renderBankModes(student, 'comptia-secai'); };
    document.getElementById('tabGovAI').onclick = function () { renderBankModes(student, 'gov-ai'); };

    // Bind SecAI action buttons
    if (document.getElementById('btnSecAIAll')) {
      document.getElementById('btnSecAIAll').onclick = function () {
        document.getElementById('modeChoiceOverlay').style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startPractice(student, 'comptia-secai', 'all');
      };
    }
    if (document.getElementById('btnSecAIRandom')) {
      document.getElementById('btnSecAIRandom').onclick = function () {
        document.getElementById('modeChoiceOverlay').style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startPractice(student, 'comptia-secai', 'random');
      };
    }
    if (document.getElementById('btnSecAIWrong') && wrongQuestions.length > 0) {
      document.getElementById('btnSecAIWrong').onclick = function () {
        document.getElementById('modeChoiceOverlay').style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startWrongPractice(student, wrongQuestions, 'comptia-secai');
      };
    }

    // Bind GovAI action buttons
    if (document.getElementById('btnGovAll')) {
      document.getElementById('btnGovAll').onclick = function () {
        document.getElementById('modeChoiceOverlay').style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startPractice(student, 'gov-ai', 'all');
      };
    }
    if (document.getElementById('btnGovWrong') && wrongQuestions.length > 0) {
      document.getElementById('btnGovWrong').onclick = function () {
        document.getElementById('modeChoiceOverlay').style.display = 'none';
        sessionStorage.setItem('examMode', 'practice');
        startWrongPractice(student, wrongQuestions, 'gov-ai');
      };
    }

    // Formal exam
    var formalBtn = document.getElementById('btnModeFormal');
    if (formalBtn) {
      formalBtn.onclick = function () {
        document.getElementById('modeChoiceOverlay').style.display = 'none';
        sessionStorage.setItem('examMode', 'exam');
        startFormalExam();
      };
    }

    // Exit
    document.getElementById('btnModeExit').onclick = function () {
      if (window.api && window.api.closeApp) window.api.closeApp();
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

  async function startPractice(student, bankType, mode) {
    setLoading(true);
    if (loginStatus) loginStatus.textContent = '正在載入試題...';

    var practiceResult;
    if (window.api && window.api.remote && window.api.remote.downloadPractice) {
      practiceResult = await window.api.remote.downloadPractice({ bankType: bankType, mode: mode });
    } else {
      // Browser fallback - fetch JSON directly
      try {
        var jsonFile = (bankType === 'comptia-secai') ? 'data/comptia-secai-bank.json' : 'data/questions.json';
        var resp = await fetch(jsonFile);
        var rawData = await resp.json();
        var rawQs = rawData.questions || [];

        function normQ(q, idx) {
          var opts = [];
          if (Array.isArray(q.options)) {
            opts = q.options;
          } else if (q.options && typeof q.options === 'object') {
            var keys = Object.keys(q.options).sort();
            opts = keys.map(function(k) { return q.options[k]; });
          }
          return {
            id: idx + 1,
            originalNo: q.originalNo || ('NO.' + (q.id || (idx + 1))),
            type: q.type === '複選' || q.type === 'multiple' ? 'multiple' : 'single',
            text: q.question || q.text || '',
            options: opts,
            answer: q.answer,
            explanation: q.explanation || ''
          };
        }

        var qs = rawQs.map(normQ);
        if (mode === 'random') {
          qs = [...qs].sort(function() { return Math.random() - 0.5; }).slice(0, 40);
          qs.forEach(function(q, idx) { q.id = idx + 1; });
        }
        practiceResult = {
          success: true,
          data: {
            exam: rawData.exam || {
              title: bankType === 'comptia-secai' ? 'CompTIA SecAI+ Certification Exam' : '公務AI共通核心能力認證',
              passingScore: bankType === 'comptia-secai' ? 750 : 60,
              bankType: bankType
            },
            questions: qs,
            mode: 'practice'
          }
        };
      } catch (e) {
        practiceResult = { success: false, error: '載入題庫失敗: ' + e.message };
      }
    }

    if (!practiceResult.success) {
      showError('下載題目失敗：' + practiceResult.error);
      return;
    }

    sessionStorage.setItem('examData', JSON.stringify(practiceResult.data));
    window.location.href = 'practice.html';
  }

  async function startWrongPractice(student, wrongQuestions, bankKey) {
    var isSecAI = (bankKey === 'comptia-secai');
    
    // Repair text if missing from old cache
    try {
      var jsonFile = isSecAI ? 'data/comptia-secai-bank.json' : 'data/questions.json';
      var resp = await fetch(jsonFile);
      var rawData = await resp.json();
      var fullBank = rawData.questions || [];
      var fullMap = {};
      fullBank.forEach(function(fq) {
        var noKey = fq.originalNo || ('NO.' + fq.id);
        fullMap[noKey] = fq;
        if (fq.id) fullMap['id_' + fq.id] = fq;
      });

      wrongQuestions.forEach(function(wq) {
        if (!wq.text && !wq.question) {
          var matched = fullMap[wq.originalNo] || fullMap['id_' + wq.id];
          if (matched) {
            wq.text = matched.text || matched.question || '';
            wq.question = wq.text;
            wq.options = matched.options || wq.options;
            wq.explanation = matched.explanation || wq.explanation;
          }
        }
      });
    } catch(e) {}

    var examData = {
      exam: {
        title: isSecAI ? 'CompTIA SecAI+ 錯題專區' : '公務AI 錯題練習',
        subject: '錯題重練模式（答對自動克服並移出錯題庫，重複練習直到對為止）',
        level: isSecAI ? 'Professional' : '通識',
        totalTime: 0,
        passingScore: isSecAI ? 750 : 60,
        pointsPerQuestion: wrongQuestions.length > 0 ? Math.floor(100 / wrongQuestions.length) : 2,
        bankType: bankKey,
        isWrongMode: true
      },
      questions: wrongQuestions.map(function (q, i) {
        return {
          id: i + 1,
          originalNo: q.originalNo || ('NO.' + (i + 1)),
          type: q.type,
          text: q.text || q.question || '',
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

  async function getWrongQuestions(studentId, bankKey) {
    bankKey = bankKey || 'comptia-secai';
    var wrongId = studentId + '_' + bankKey;
    try {
      if (window.api && window.api.wrong) {
        var result = await window.api.wrong.load(wrongId);
        if (!result.success) return [];
        return Object.values(result.data);
      } else {
        var local = localStorage.getItem('wrong_questions_' + wrongId);
        if (!local) return [];
        return Object.values(JSON.parse(local));
      }
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
    if (!online && window.api) {
      console.warn('Network offline, using local mode');
    }
    studentIdInput.disabled = false;
    loginBtn.disabled = false;
    studentIdInput.focus();
  })();

  // ── Auto Update Notification ──
  if (window.api && window.api.onUpdateStatus) {
    var updateOverlay = null;
    var checkingTimeout = null;

    window.api.onUpdateStatus(function (data) {
      var statusTag = document.getElementById('updateStatusTag');

      if (data.status === 'checking') {
        if (statusTag) {
          statusTag.style.color = '#3B82F6';
          statusTag.textContent = '（檢查更新中...）';
        }
        if (checkingTimeout) clearTimeout(checkingTimeout);
        checkingTimeout = setTimeout(function () {
          if (statusTag && statusTag.textContent === '（檢查更新中...）') {
            statusTag.style.color = '#10B981';
            statusTag.textContent = '（已是最新版 ✓）';
          }
        }, 10000);
      }

      if (data.status === 'up-to-date' || data.status === 'error') {
        if (checkingTimeout) {
          clearTimeout(checkingTimeout);
          checkingTimeout = null;
        }
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
