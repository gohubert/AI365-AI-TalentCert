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

    questionNum.textContent = '第 ' + (currentIndex + 1) + ' 題'
      + (isMultiple ? '（複選題）' : '（單選題）');

    var qText = q.text;
    if (isMultiple && Array.isArray(q.answer)) {
      qText += '\n（請選擇 ' + q.answer.length + ' 個最適合的答案）';
    }
    questionText.textContent = qText;

    // Options
    var html = '';
    q.options.forEach(function (opt, i) {
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
      answerResult.textContent = isCorrect ? '✔ 回答正確！' : '✘ 回答錯誤';

      var expHtml = '<strong>正確答案：' + correctStr + '</strong>';
      if (q.explanation) {
        expHtml += '<br><br>' + q.explanation;
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

  // Confirm answer — auto-save progress
  btnConfirm.addEventListener('click', function () {
    confirmed[currentIndex] = true;
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
      examLevel: examInfo.level || '通識',
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

    // ── Update wrong questions in localStorage ──
    await updateWrongQuestions(result);

    // Store result for result page
    sessionStorage.setItem('practiceResult', JSON.stringify(result));
    // Clear progress (completed)
    sessionStorage.removeItem('practiceProgress');

    // Upload to cloud
    try {
      await window.api.remote.uploadResult(result);
    } catch (e) {
      console.error('Upload failed:', e);
    }

    // Go to result page
    window.location.href = 'practice-result.html';
  });

  /**
   * 更新錯題庫（透過主進程檔案持久化）
   * - 這次答對的 → 從錯題庫移除
   * - 有作答但答錯的 → 加入錯題庫（含完整題目資料）
   */
  async function updateWrongQuestions(result) {
    var existing = {};
    try {
      var loaded = await window.api.wrong.load(student.id);
      if (loaded.success) existing = loaded.data;
    } catch (e) { existing = {}; }

    result.answers.forEach(function (a) {
      // 用題目文字前 50 字做 key（避免 ID 重編問題）
      var q = questions.find(function (qq) { return qq.id === a.questionId; });
      if (!q) return;
      var textKey = (q.text || '').substring(0, 50);

      // 沒有作答的題目不處理
      if (!a.studentAnswer || a.studentAnswer.length === 0) return;

      if (a.isCorrect) {
        // 答對 → 移除
        delete existing[textKey];
      } else {
        // 有作答但答錯 → 存入完整題目
        existing[textKey] = {
          text: q.text,
          type: q.type,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation || '',
          lastWrongAt: new Date().toISOString(),
        };
      }
    });

    try {
      await window.api.wrong.save(student.id, existing);
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
    reportQuestionRef.textContent = '第 ' + (currentIndex + 1) + ' 題：' + q.text.substring(0, 50) + '...';
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
    var report = {
      questionId: q.id,
      questionIndex: currentIndex + 1,
      questionText: q.text,
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
