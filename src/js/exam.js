/**
 * exam.js — 考試主畫面邏輯
 * 計時器、題目導航、作答、標記、總覽、字體縮放、結束測驗
 */
(function () {
  'use strict';

  if (!QuestionManager.init()) return;

  var examInfo = QuestionManager.getExamInfo();
  var student = QuestionManager.getStudentInfo();
  var totalQuestions = QuestionManager.getTotalQuestions();

  var currentIndex = 0;
  var fontScale = 1.0;
  var timerInterval = null;
  var remainingSeconds = (examInfo.totalTime || 50) * 60;
  var totalSeconds = remainingSeconds;

  // DOM refs
  var examSubjectTag = document.getElementById('examSubjectTag');
  var examStudentInfo = document.getElementById('examStudentInfo');
  var timerDisplay = document.getElementById('timerDisplay');
  var timerTotal = document.getElementById('timerTotal');
  var examTimer = document.getElementById('examTimer');
  var questionArea = document.getElementById('questionArea');
  var qNumber = document.getElementById('qNumber');
  var qText = document.getElementById('qText');
  var qTypeBadge = document.getElementById('qTypeBadge');
  var optionsList = document.getElementById('optionsList');
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');
  var btnClear = document.getElementById('btnClear');
  var btnMark = document.getElementById('btnMark');
  var btnOverview = document.getElementById('btnOverview');
  var btnZoomIn = document.getElementById('btnZoomIn');
  var btnZoomOut = document.getElementById('btnZoomOut');
  var btnEndExam = document.getElementById('btnEndExam');
  var overviewOverlay = document.getElementById('overviewOverlay');
  var overviewGrid = document.getElementById('overviewGrid');
  var overviewClose = document.getElementById('overviewClose');
  var endExamDialog = document.getElementById('endExamDialog');
  var btnConfirmEnd = document.getElementById('btnConfirmEnd');
  var btnCancelEnd = document.getElementById('btnCancelEnd');
  var examWrapper = document.getElementById('examWrapper');
  var examEndScreen = document.getElementById('examEndScreen');

  var optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Populate top bar
  examSubjectTag.textContent = '[' + (examInfo.level || '通識') + '] ' + (examInfo.subject || examInfo.title);
  examStudentInfo.textContent = (student.password || student.id) + ' / ' + student.name;
  timerTotal.textContent = formatTime(totalSeconds);

  // ── Timer ──
  var fiveMinWarned = false;

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function startTimer() {
    timerInterval = setInterval(function () {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        clearInterval(timerInterval);
        endExam(true);
      }
      timerDisplay.textContent = formatTime(remainingSeconds);

      // 5-minute warning
      if (remainingSeconds === 300 && !fiveMinWarned) {
        fiveMinWarned = true;
        showFiveMinWarning();
      }

      var pct = remainingSeconds / totalSeconds;
      if (pct <= 0.1) {
        examTimer.classList.add('critical');
        examTimer.classList.remove('warning');
      } else if (pct <= 0.25) {
        examTimer.classList.add('warning');
        examTimer.classList.remove('critical');
      } else {
        examTimer.classList.remove('warning', 'critical');
      }
    }, 1000);
  }

  function showFiveMinWarning() {
    // Create warning overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card);border-radius:16px;padding:32px 40px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:420px;';
    box.innerHTML = '<div style="font-size:3rem;margin-bottom:12px;">⚠️</div>'
      + '<h2 style="margin-bottom:8px;color:var(--danger);">剩餘 5 分鐘！</h2>'
      + '<p style="color:var(--text-secondary);margin-bottom:20px;line-height:1.7;">考試時間即將結束，請把握時間完成作答。<br>時間到將自動交卷。</p>'
      + '<button class="btn btn-primary" id="btnDismissWarning">✔ 我知道了，繼續作答</button>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('btnDismissWarning').addEventListener('click', function () {
      overlay.remove();
    });
  }

  // ── Render Question ──
  function renderQuestion() {
    var q = QuestionManager.getQuestion(currentIndex);
    if (!q) return;

    var state = QuestionManager.getAnswerState(q.id);
    var isMultiple = q.type === 'multiple';

    qNumber.textContent = q.id + '.';

    var displayText = q.text;
    if (isMultiple) {
      // 計算需選幾個答案
      var ansCount = 0;
      if (q._answerCount) {
        ansCount = q._answerCount;
      } else if (Array.isArray(q.answer)) {
        ansCount = q.answer.length;
      }
      if (ansCount > 0) {
        displayText += '\n（請選擇 ' + ansCount + ' 個最適合的答案）';
      }
    }
    qText.textContent = displayText;

    if (isMultiple) {
      qTypeBadge.textContent = '複選題';
      qTypeBadge.className = 'q-type-badge multiple';
    } else {
      qTypeBadge.textContent = '單選題';
      qTypeBadge.className = 'q-type-badge single';
    }

    if (state.marked) {
      btnMark.classList.add('active');
      btnMark.textContent = '★ 已標記';
    } else {
      btnMark.classList.remove('active');
      btnMark.textContent = '☆ 試題標記';
    }


    btnPrev.disabled = currentIndex === 0;
    btnNext.disabled = currentIndex === totalQuestions - 1;

    optionsList.innerHTML = '';
    q.options.forEach(function (optText, idx) {
      var label = optionLabels[idx];
      var isSelected = state.answers.indexOf(label) > -1;

      var li = document.createElement('li');
      li.className = 'option-item' + (isSelected ? ' selected' : '');
      li.setAttribute('data-option', label);

      var indicator = document.createElement('div');
      if (isMultiple) {
        indicator.className = 'option-indicator checkbox';
        indicator.innerHTML = '<span class="check-icon">✓</span>';
      } else {
        indicator.className = 'option-indicator radio';
        indicator.innerHTML = '<span class="inner-dot"></span>';
      }

      var labelSpan = document.createElement('span');
      labelSpan.className = 'option-label';
      labelSpan.textContent = '(' + label + ')';

      var textSpan = document.createElement('span');
      textSpan.className = 'option-text';
      textSpan.textContent = optText;

      li.appendChild(indicator);
      li.appendChild(labelSpan);
      li.appendChild(textSpan);

      li.addEventListener('click', function () {
        QuestionManager.setAnswer(q.id, label, isMultiple);
        renderQuestion();
      });

      optionsList.appendChild(li);
    });
  }

  // ── Navigation ──
  btnPrev.addEventListener('click', function () {
    if (currentIndex > 0) { currentIndex--; renderQuestion(); }
  });
  btnNext.addEventListener('click', function () {
    if (currentIndex < totalQuestions - 1) { currentIndex++; renderQuestion(); }
  });

  document.addEventListener('keydown', function (e) {
    if (overviewOverlay.classList.contains('show') || endExamDialog.classList.contains('show')) {
      if (e.key === 'Escape') {
        overviewOverlay.classList.remove('show');
        endExamDialog.classList.remove('show');
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) { currentIndex--; renderQuestion(); }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < totalQuestions - 1) { currentIndex++; renderQuestion(); }
    }
  });

  // ── Clear / Mark ──
  btnClear.addEventListener('click', function () {
    var q = QuestionManager.getQuestion(currentIndex);
    if (q) { QuestionManager.clearAnswer(q.id); renderQuestion(); }
  });
  btnMark.addEventListener('click', function () {
    var q = QuestionManager.getQuestion(currentIndex);
    if (q) { QuestionManager.toggleMark(q.id); renderQuestion(); }
  });

  // ── Overview ──
  btnOverview.addEventListener('click', function () { renderOverview(); overviewOverlay.classList.add('show'); });
  overviewClose.addEventListener('click', function () { overviewOverlay.classList.remove('show'); });
  overviewOverlay.addEventListener('click', function (e) {
    if (e.target === overviewOverlay) overviewOverlay.classList.remove('show');
  });

  function renderOverview() {
    overviewGrid.innerHTML = '';
    QuestionManager.getQuestions().forEach(function (q, idx) {
      var state = QuestionManager.getAnswerState(q.id);
      var cell = document.createElement('div');
      cell.className = 'overview-cell';
      cell.textContent = q.id;

      if (state.marked) { cell.classList.add('marked'); }
      else if (state.answers.length > 0) { cell.classList.add('answered'); }
      else { cell.classList.add('unanswered'); }

      if (idx === currentIndex) { cell.classList.add('current'); }

      cell.addEventListener('click', function () {
        currentIndex = idx;
        renderQuestion();
        overviewOverlay.classList.remove('show');
      });
      overviewGrid.appendChild(cell);
    });

    var stats = QuestionManager.getStats();
    document.getElementById('statAnswered').textContent = stats.answered;
    document.getElementById('statMarked').textContent = stats.marked;
    document.getElementById('statUnanswered').textContent = stats.unanswered;
  }


  // ── Font Zoom ──
  btnZoomIn.addEventListener('click', function () {
    if (fontScale < 1.6) { fontScale += 0.1; questionArea.style.fontSize = fontScale + 'rem'; }
  });
  btnZoomOut.addEventListener('click', function () {
    if (fontScale > 0.7) { fontScale -= 0.1; questionArea.style.fontSize = fontScale + 'rem'; }
  });

  // ── End Exam ──
  btnEndExam.addEventListener('click', function () { showEndDialog(); });

  function showEndDialog() {
    var stats = QuestionManager.getStats();
    document.getElementById('dialogTotal').textContent = stats.total;
    document.getElementById('dialogAnswered').textContent = stats.answered;
    document.getElementById('dialogUnanswered').textContent = stats.unanswered;

    // Reset overview state
    var overviewSection = document.getElementById('dialogOverviewGrid');
    overviewSection.style.display = 'none';
    document.getElementById('btnDialogOverview').textContent = '📋 試題總覽';

    // Build grid
    var grid = document.getElementById('dialogGrid');
    grid.innerHTML = '';
    var questions = QuestionManager.getQuestions();
    questions.forEach(function (q, i) {
      var cell = document.createElement('div');
      cell.className = 'overview-cell';
      cell.textContent = i + 1;

      if (QuestionManager.isMarked(q.id)) {
        cell.classList.add('marked');
      } else if (QuestionManager.isAnswered(q.id)) {
        cell.classList.add('answered');
      } else {
        cell.classList.add('unanswered');
      }

      cell.addEventListener('click', function () {
        endExamDialog.classList.remove('show');
        currentIndex = i;
        renderQuestion();
      });

      grid.appendChild(cell);
    });

    endExamDialog.classList.add('show');
  }

  // Dialog overview toggle
  document.getElementById('btnDialogOverview').addEventListener('click', function () {
    var section = document.getElementById('dialogOverviewGrid');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      this.textContent = '📋 收合總覽';
    } else {
      section.style.display = 'none';
      this.textContent = '📋 試題總覽';
    }
  });

  btnConfirmEnd.addEventListener('click', function () {
    endExamDialog.classList.remove('show');
    endExam(false);
  });
  btnCancelEnd.addEventListener('click', function () { endExamDialog.classList.remove('show'); });
  endExamDialog.addEventListener('click', function (e) {
    if (e.target === endExamDialog) endExamDialog.classList.remove('show');
  });

  async function endExam(isTimeout) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    // Calculate time used
    var timeUsedSeconds = totalSeconds - remainingSeconds;

    // Show end screen with uploading state
    examWrapper.style.display = 'none';
    examEndScreen.classList.add('show');

    var endIcon = document.getElementById('endIcon');
    var endTitle = document.getElementById('endTitle');
    var endMessage = document.getElementById('endMessage');
    var endNote = document.getElementById('endNote');
    var endCountdown = document.getElementById('endCountdown');

    endIcon.textContent = '⏳';
    endTitle.textContent = isTimeout ? '考試時間已到' : '正在上傳成績...';
    endMessage.textContent = '請稍候，系統正在計算成績並上傳至伺服器...';

    // Calculate result
    var result = QuestionManager.calculateResult(timeUsedSeconds);

    // Upload to server (offline-safe: local save always happens via IPC)
    try {
      var uploadResult = await window.api.remote.uploadResult(result);

      if (uploadResult.success) {
        endIcon.textContent = '✅';
        endTitle.textContent = '本次鑑定已結束';
        endMessage.textContent = '感謝您的作答，成績已上傳。請攜帶您的個人隨身物品及證件，離開考試場地。';
      } else {
        // Upload failed but data is saved locally
        endIcon.textContent = '✅';
        endTitle.textContent = '本次鑑定已結束';
        endMessage.textContent = '感謝您的作答，成績已儲存。網路連線中斷，系統將於下次啟動時自動上傳。';
      }
    } catch (err) {
      // Network error — data already saved locally via IPC
      endIcon.textContent = '✅';
      endTitle.textContent = '本次鑑定已結束';
      endMessage.textContent = '感謝您的作答，成績已儲存。網路連線中斷，系統將於下次啟動時自動上傳。';
    }

    // Clear sensitive data
    sessionStorage.clear();

    // Auto-exit countdown (5 seconds)
    endCountdown.style.display = 'block';
    var countdown = 5;
    endCountdown.textContent = countdown + ' 秒後自動關閉程式...';

    var exitInterval = setInterval(function () {
      countdown--;
      if (countdown <= 0) {
        clearInterval(exitInterval);
        endCountdown.textContent = '正在關閉程式...';
        window.api.closeApp();
      } else {
        endCountdown.textContent = countdown + ' 秒後自動關閉程式...';
      }
    }, 1000);
  }

  // ── Init ──
  renderQuestion();
  startTimer();
})();
