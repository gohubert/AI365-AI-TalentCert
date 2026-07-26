/**
 * practice-result.js — 模擬練習結果
 *
 * 顯示成績、統計數據、逐題檢討
 */
(function () {
  'use strict';

  var result = JSON.parse(sessionStorage.getItem('practiceResult'));

  if (!result) {
    window.location.href = 'index.html';
    return;
  }

  // Score display
  var scoreEl = document.getElementById('resultScore');
  var iconEl = document.getElementById('resultIcon');
  var labelEl = document.getElementById('resultLabel');

  scoreEl.textContent = result.score + ' / ' + result.totalScore;
  scoreEl.className = 'result-score ' + (result.passed ? 'passed' : 'failed');
  iconEl.textContent = result.passed ? '🎉' : '📖';
  labelEl.textContent = result.passed
    ? '恭喜通過！繼續保持'
    : '再接再厲！建議多加練習';

  // Stats
  var statsHtml = '';
  statsHtml += '<div class="stat-card"><div class="stat-value">' + result.totalQuestions + '</div><div class="stat-label">總題數</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-value" style="color:var(--success);">' + result.correctCount + '</div><div class="stat-label">答對</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-value" style="color:var(--danger);">' + result.wrongCount + '</div><div class="stat-label">答錯</div></div>';

  var accuracy = result.totalQuestions > 0
    ? Math.round(result.correctCount / result.totalQuestions * 100) : 0;
  statsHtml += '<div class="stat-card"><div class="stat-value">' + accuracy + '%</div><div class="stat-label">正確率</div></div>';

  document.getElementById('resultStats').innerHTML = statsHtml;

  // Review
  var reviewContainer = document.getElementById('reviewContainer');
  var html = '';

  result.answers.forEach(function (a, i) {
    var badge = a.isCorrect ? 'correct' : 'wrong';
    var badgeText = a.isCorrect ? '✔' : '✘';
    var myStr = a.studentAnswer && a.studentAnswer.length > 0
      ? a.studentAnswer.join(', ') : '未作答';
    var correctStr = Array.isArray(a.correctAnswer)
      ? a.correctAnswer.join(', ') : a.correctAnswer;

    html += '<div class="review-item">'
      + '<div class="review-badge ' + badge + '">' + badgeText + '</div>'
      + '<div class="review-detail">'
      + '<div class="review-q">第 ' + (i + 1) + ' 題</div>'
      + '<div class="review-answer">'
      + '你的答案：<strong>' + myStr + '</strong>'
      + '　正確答案：<strong>' + correctStr + '</strong>'
      + '</div></div></div>';
  });

  reviewContainer.innerHTML = html;

  // Buttons
  var btnActions = document.querySelector('.result-actions');
  if (result.wrongCount > 0 && btnActions) {
    var wrongBtn = document.createElement('button');
    wrongBtn.className = 'btn btn-outline';
    wrongBtn.style.cssText = 'border:2px solid #EF4444;color:#EF4444;background:rgba(239,68,68,0.06);font-weight:700;';
    wrongBtn.innerHTML = '❌ 立即重練錯題（' + result.wrongCount + ' 題）';
    wrongBtn.onclick = async function () {
      var student = JSON.parse(sessionStorage.getItem('currentStudent') || '{}');
      var bankKey = result.bankType || 'comptia-secai';
      var wrongId = (student.id || result.studentId) + '_' + bankKey;
      var wrongQuestions = [];
      try {
        if (window.api && window.api.wrong) {
          var res = await window.api.wrong.load(wrongId);
          if (res.success) wrongQuestions = Object.values(res.data || {});
        } else {
          var local = localStorage.getItem('wrong_questions_' + wrongId);
          if (local) wrongQuestions = Object.values(JSON.parse(local));
        }
      } catch(e) {}

      if (wrongQuestions.length === 0) {
        alert('太棒了！目前無錯題需要練習。');
        return;
      }

      var examData = {
        exam: {
          title: 'CompTIA SecAI+ 錯題專區',
          subject: '錯題重練模式（答對自動克服並移出錯題庫，重複練習直到對為止）',
          level: 'Professional',
          totalTime: 0,
          passingScore: 750,
          pointsPerQuestion: Math.floor(100 / wrongQuestions.length),
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
      sessionStorage.setItem('examMode', 'practice');
      window.location.href = 'practice.html';
    };
    btnActions.insertBefore(wrongBtn, btnActions.firstChild);
  }

  document.getElementById('btnRetry').addEventListener('click', function () {
    sessionStorage.removeItem('practiceResult');
    sessionStorage.removeItem('examData');
    window.location.href = 'index.html';
  });

  document.getElementById('btnHome').addEventListener('click', function () {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });
})();
