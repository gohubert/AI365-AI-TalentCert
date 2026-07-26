/**
 * practice.js — 刷題模式邏輯
 *
 * 功能：
 * - 一頁一題，選完按「確認答案」顯示正確答案 + 詳解
 * - 不計時間
 * - 結束後顯示成績 + 上傳到雲端
 */
(function () {
  'use strict';

  var student = JSON.parse(sessionStorage.getItem('currentStudent'));
  var examDataRaw = JSON.parse(sessionStorage.getItem('examData'));

  if (!student || !examDataRaw) {
    window.location.href = 'index.html';
    return;
  }

  var questions = examDataRaw.questions;
  var examInfo = examDataRaw.exam;
  var currentIndex = 0;
  var confirmed = [];  // track if each question has been confirmed
  var answers = {};    // student answers: { questionId: [option letters] }

  // Init confirmed array
  questions.forEach(function () { confirmed.push(false); });

  // DOM refs
  var questionNum = document.getElementById('questionNum');
  var questionText = document.getElementById('questionText');
  var optionsList = document.getElementById('optionsList');
  var answerSection = document.getElementById('answerSection');
  var answerResult = document.getElementById('answerResult');
  var answerExplanation = document.getElementById('answerExplanation');
  var btnPrev = document.getElementById('btnPrev');
  var btnConfirm = document.getElementById('btnConfirm');
  var btnNext = document.getElementById('btnNext');
  var btnFinish = document.getElementById('btnFinish');
  var progressText = document.getElementById('progressText');
  var progressBar = document.getElementById('progressBar');

  // Student info
  document.getElementById('studentInfo').textContent =
    (student.password || student.id) + ' / ' + student.name;
  document.getElementById('practiceInfo').textContent =
    (examInfo.subject || examInfo.title) + ' — ' + questions.length + ' 題';

  if (examInfo.isWrongMode) {
    var banner = document.getElementById('wrongModeBanner');
    if (banner) banner.style.display = 'block';
  }

  // Quit button — save partial results before quitting
  document.getElementById('btnQuit').addEventListener('click', async function () {
    var answeredCount = confirmed.filter(function (c) { return c; }).length;
    var ok = confirm('確定要強制離開嗎？');
    if (ok) {
      // Save partial results
      if (answeredCount > 0) {
        var result = buildResult();
        result.isPartial = true;
        result.completedQuestions = answeredCount;
        // Update wrong questions
        await updateWrongQuestions(result);
        try {
          await window.api.remote.uploadResult(result);
        } catch (e) {
          console.error('Partial upload failed:', e);
        }
      }
      sessionStorage.clear();
      if (window.api && window.api.closeApp) {
        window.api.closeApp();
      } else {
        window.location.href = 'index.html';
      }
    }
  });

  var LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  function renderQuestion() {
    var q = questions[currentIndex];
    var isMultiple = q.type === 'multiple';
    var isConfirmed = confirmed[currentIndex];
    var myAnswers = answers[q.id] || [];

    var originalLabel = q.originalNo ? (' [' + q.originalNo + ']') : '';
    questionNum.textContent = '第 ' + (currentIndex + 1) + ' 題' + originalLabel
      + (isMultiple ? '（複選題）' : '（單選題）');

    var qText = q.text || q.question || '';
    if (isMultiple && Array.isArray(q.answer)) {
      qText += '\n（請選擇 ' + q.answer.length + ' 個最適合的答案）';
    }
    questionText.textContent = qText;

    // Options
    var opts = [];
    if (Array.isArray(q.options)) {
      opts = q.options;
    } else if (q.options && typeof q.options === 'object') {
      var keys = Object.keys(q.options).sort();
      opts = keys.map(function (k) { return q.options[k]; });
    }

    var html = '';
    opts.forEach(function (opt, i) {
      var label = LABELS[i];
      var isSelected = myAnswers.indexOf(label) > -1;
      var classes = '';
      var inputType = isMultiple ? 'checkbox' : 'radio';

      if (isConfirmed) {
        var correctAnswer = q.answer;
        var isCorrectOption = Array.isArray(correctAnswer)
          ? correctAnswer.indexOf(label) > -1
          : correctAnswer === label;

        if (isCorrectOption) {
          classes = 'correct';
        } else if (isSelected && !isCorrectOption) {
          classes = 'wrong';
        }
      } else if (isSelected) {
        classes = 'selected';
      }

      var indicator = '<input type="' + inputType + '" ' + (isSelected ? 'checked' : '') + ' disabled style="pointer-events:none;margin-right:8px;width:16px;height:16px;accent-color:var(--primary);" />';
      html += '<li class="' + classes + '" data-option="' + label + '">'
        + indicator
        + '<span class="opt-label">' + label + '</span>'
        + '<span>' + opt + '</span></li>';
    });
    optionsList.innerHTML = html;

    // Answer section
    if (isConfirmed) {
      answerSection.classList.add('show');
      var correctAnswer = q.answer;
      var correctStr = Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer;
      var myStr = myAnswers.sort().join(', ') || '（未作答）';
      var isCorrect = checkCorrect(q, myAnswers);

      answerSection.className = 'answer-section show ' + (isCorrect ? 'correct-answer' : 'wrong-answer');
      answerResult.className = 'answer-result ' + (isCorrect ? 'correct' : 'wrong');
      
      if (examInfo.isWrongMode) {
        answerResult.textContent = isCorrect 
          ? '🎉 回答正確！此題已成功克服（已從錯題庫中移出）' 
          : '✘ 回答錯誤，此題保留在錯題本中供重複練習，直到全對為止！';
      } else {
        answerResult.textContent = isCorrect 
          ? '✔ 回答正確！' 
          : '✘ 回答錯誤（已自動記錄至錯題本）';
      }

      var expHtml = '<div style="margin-bottom:8px;"><strong>正確答案：' + correctStr + '</strong></div>';
      if (q.explanation) {
        expHtml += '<div style="background:rgba(255,255,255,0.7);padding:10px 14px;border-radius:8px;line-height:1.7;white-space:pre-line;">' 
          + '💡 <strong>題目觀念解析：</strong>\n' + q.explanation + '</div>';
      }
      answerExplanation.innerHTML = expHtml;
    } else {
      answerSection.classList.remove('show');
      answerSection.className = 'answer-section';
    }

    // Buttons
    btnPrev.style.display = currentIndex > 0 ? '' : 'none';
    btnConfirm.style.display = isConfirmed ? 'none' : '';
    btnNext.style.display = isConfirmed && currentIndex < questions.length - 1 ? '' : 'none';
    btnFinish.style.display = isConfirmed && currentIndex === questions.length - 1 ? '' : 'none';

    // Progress
    var answeredCount = confirmed.filter(function (c) { return c; }).length;
    progressText.textContent = (currentIndex + 1) + ' / ' + questions.length
      + '　已完成：' + answeredCount + ' 題';
    progressBar.style.width = (answeredCount / questions.length * 100) + '%';

    // Click handlers for options (only if not confirmed)
    if (!isConfirmed) {
      optionsList.querySelectorAll('li').forEach(function (li) {
        li.addEventListener('click', function () {
          var opt = this.getAttribute('data-option');
          if (isMultiple) {
            var idx = myAnswers.indexOf(opt);
            if (idx > -1) { myAnswers.splice(idx, 1); }
            else { myAnswers.push(opt); }
          } else {
            myAnswers = [opt];
          }
          answers[q.id] = myAnswers;
          renderQuestion();
        });
      });
    }
  }

  function checkCorrect(q, myAnswers) {
    var correct = Array.isArray(q.answer) ? q.answer.slice().sort().join(',') : q.answer;
    var mine = myAnswers.slice().sort().join(',');
    return correct === mine;
  }

  // Confirm answer — auto-save progress & update wrong questions instantly
  btnConfirm.addEventListener('click', async function () {
    confirmed[currentIndex] = true;
    var q = questions[currentIndex];
    var myAnswers = answers[q.id] || [];
    var isCorrect = checkCorrect(q, myAnswers);
    
    await updateWrongQuestionsForCurrent(q, myAnswers, isCorrect);
    autoSaveProgress();
    renderQuestion();
  });

  // Auto-save progress to sessionStorage on every confirm
  function autoSaveProgress() {
    sessionStorage.setItem('practiceProgress', JSON.stringify({
      answers: answers,
      confirmed: confirmed,
      currentIndex: currentIndex,
      savedAt: new Date().toISOString(),
    }));
  }

  // Build result object (reusable for finish and partial save)
  function buildResult() {
    var correctCount = 0;
    var pointsPerQuestion = examInfo.pointsPerQuestion || 2;
    var details = [];

    questions.forEach(function (q) {
      var myAnswers = answers[q.id] || [];
      var isCorrect = checkCorrect(q, myAnswers);
      if (isCorrect) correctCount++;
      details.push({
        questionId: q.id,
        type: q.type,
        studentAnswer: myAnswers,
        correctAnswer: q.answer,
        isCorrect: isCorrect,
      });
    });

    var score = correctCount * pointsPerQuestion;
    var totalScore = questions.length * pointsPerQuestion;
    var passed = score >= (examInfo.passingScore || 60);

    return {
      studentId: student.id,
      studentName: student.name,
      studentPassword: student.password || '',
      examTitle: examInfo.title + ' — ' + (examInfo.subject || ''),
      examLevel: examInfo.level || 'Professional',
      mode: 'practice',
      totalQuestions: questions.length,
      correctCount: correctCount,
      wrongCount: questions.length - correctCount,
      score: score,
      totalScore: totalScore,
      passingScore: examInfo.passingScore || 60,
      passed: passed,
      timeUsedSeconds: 0,
      submittedAt: new Date().toISOString(),
      answers: details,
    };
  }

  // Navigation
  btnPrev.addEventListener('click', function () {
    if (currentIndex > 0) { currentIndex--; renderQuestion(); }
  });

  btnNext.addEventListener('click', function () {
    if (currentIndex < questions.length - 1) { currentIndex++; renderQuestion(); }
  });

  // Finish → show results
  btnFinish.addEventListener('click', async function () {
    var result = buildResult();

    // ── Update wrong questions in storage ──
    await updateWrongQuestions(result);

    // Store result for result page
    sessionStorage.setItem('practiceResult', JSON.stringify(result));
    // Clear progress (completed)
    sessionStorage.removeItem('practiceProgress');

    // Upload to cloud if available
    try {
      if (window.api && window.api.remote) {
        await window.api.remote.uploadResult(result);
      }
    } catch (e) {
      console.error('Upload failed:', e);
    }

    // Go to result page
    window.location.href = 'practice-result.html';
  });

  /**
   * 即時單題更新錯題庫
   */
  async function updateWrongQuestionsForCurrent(q, myAnswers, isCorrect) {
    var bankKey = examInfo.bankType || 'comptia-secai';
    var wrongId = student.id + '_' + bankKey;
    var existing = {};

    try {
      if (window.api && window.api.wrong) {
        var loaded = await window.api.wrong.load(wrongId);
        if (loaded.success) existing = loaded.data || {};
      } else {
        var local = localStorage.getItem('wrong_questions_' + wrongId);
        if (local) existing = JSON.parse(local);
      }
    } catch (e) { existing = {}; }

    var qTxt = q.text || q.question || '';
    var textKey = qTxt.substring(0, 50);

    if (isCorrect) {
      delete existing[textKey];
    } else {
      existing[textKey] = {
        text: qTxt,
        type: q.type,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || '',
        originalNo: q.originalNo || '',
        lastWrongAt: new Date().toISOString(),
      };
    }

    try {
      if (window.api && window.api.wrong) {
        await window.api.wrong.save(wrongId, existing);
      } else {
        localStorage.setItem('wrong_questions_' + wrongId, JSON.stringify(existing));
      }
    } catch (e) {
      console.error('Failed to save wrong question:', e);
    }
  }

  /**
   * 批次更新錯題庫
   */
  async function updateWrongQuestions(result) {
    var bankKey = examInfo.bankType || 'comptia-secai';
    var wrongId = student.id + '_' + bankKey;
    var existing = {};
    try {
      if (window.api && window.api.wrong) {
        var loaded = await window.api.wrong.load(wrongId);
        if (loaded.success) existing = loaded.data || {};
      } else {
        var local = localStorage.getItem('wrong_questions_' + wrongId);
        if (local) existing = JSON.parse(local);
      }
    } catch (e) { existing = {}; }

    result.answers.forEach(function (a) {
      var q = questions.find(function (qq) { return qq.id === a.questionId; });
      if (!q) return;
      var qTxt = q.text || q.question || '';
      var textKey = qTxt.substring(0, 50);

      if (!a.studentAnswer || a.studentAnswer.length === 0) return;

      if (a.isCorrect) {
        delete existing[textKey];
      } else {
        existing[textKey] = {
          text: qTxt,
          type: q.type,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation || '',
          originalNo: q.originalNo || '',
          lastWrongAt: new Date().toISOString(),
        };
      }
    });

    try {
      if (window.api && window.api.wrong) {
        await window.api.wrong.save(wrongId, existing);
      } else {
        localStorage.setItem('wrong_questions_' + wrongId, JSON.stringify(existing));
      }
    } catch (e) {
      console.error('Failed to save wrong questions:', e);
    }
  }

  // ── Report Error ──

  var reportOverlay = document.getElementById('reportOverlay');
  var reportContent = document.getElementById('reportContent');
  var reportQuestionRef = document.getElementById('reportQuestionRef');
  var reportToast = document.getElementById('reportToast');

  document.getElementById('btnReport').addEventListener('click', function () {
    var q = questions[currentIndex];
    var qTxt = q.text || q.question || '';
    reportQuestionRef.textContent = '第 ' + (currentIndex + 1) + ' 題：' + qTxt.substring(0, 50) + '...';
    reportContent.value = '';
    reportOverlay.classList.add('show');
    reportContent.focus();
  });

  document.getElementById('btnReportCancel').addEventListener('click', function () {
    reportOverlay.classList.remove('show');
  });

  document.getElementById('btnReportSubmit').addEventListener('click', async function () {
    var content = reportContent.value.trim();
    if (!content) {
      reportContent.style.borderColor = 'var(--danger)';
      reportContent.focus();
      return;
    }

    var q = questions[currentIndex];
    var qTxt = q.text || q.question || '';
    var report = {
      questionId: q.id,
      questionIndex: currentIndex + 1,
      questionText: qTxt,
      currentAnswer: Array.isArray(q.answer) ? q.answer.join(', ') : q.answer,
      reportContent: content,
      studentId: student.id,
      studentName: student.name,
      reportedAt: new Date().toISOString(),
    };

    try {
      await window.api.reports.submit(report);
    } catch (e) {
      console.error('Report submit failed:', e);
    }

    reportOverlay.classList.remove('show');
    reportToast.textContent = '✔ 報錯已提交，感謝您的回報！';
    reportToast.classList.add('show');
    setTimeout(function () { reportToast.classList.remove('show'); }, 2500);
  });

  // Init
  renderQuestion();
})();
