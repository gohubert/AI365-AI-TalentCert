/**
 * exam-info.js — 考前須知邏輯
 * 從 sessionStorage 載入考試資訊（已在首頁下載完畢）
 */
(function () {
  'use strict';

  const student = JSON.parse(sessionStorage.getItem('currentStudent'));
  const examData = JSON.parse(sessionStorage.getItem('examData'));

  if (!student || !examData) {
    window.location.href = 'index.html';
    return;
  }

  const exam = examData.exam;

  // Populate UI
  document.getElementById('tabLevel').textContent = exam.level || '通識';
  document.getElementById('tabTitle').textContent = exam.subject || exam.title;
  document.getElementById('infoStudentId').textContent = student.password || student.id;
  document.getElementById('infoStudentName').textContent = student.name;
  document.getElementById('noticeTotal').textContent = examData.questions.length;
  document.getElementById('noticePoints').textContent = exam.pointsPerQuestion || 2.5;
  document.getElementById('noticeTime').textContent = exam.totalTime || 50;

  // Enable start button
  document.getElementById('btnStart').disabled = false;
  document.getElementById('statusText').textContent = '試卷資料已載入完成，請點擊「開始」按鈕進行計時與測驗。';

  // Tab switching
  document.getElementById('tabSubject').addEventListener('click', function () {
    this.classList.add('active');
    document.getElementById('tabNotice').classList.remove('active');
  });
  document.getElementById('tabNotice').addEventListener('click', function () {
    this.classList.add('active');
    document.getElementById('tabSubject').classList.remove('active');
  });

  // Start button
  document.getElementById('btnStart').addEventListener('click', function () {
    window.location.href = 'exam.html';
  });
})();
