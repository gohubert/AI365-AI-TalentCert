/**
 * questions.js — 題庫管理器
 * 從 sessionStorage 載入解密後的題庫資料，管理作答狀態
 */
var QuestionManager = (function () {
  'use strict';

  var questions = [];
  var examInfo = {};
  var studentInfo = {};
  var answerState = {};

  function init() {
    var student = JSON.parse(sessionStorage.getItem('currentStudent'));
    var examData = JSON.parse(sessionStorage.getItem('examData'));

    if (!student || !examData) {
      window.location.href = 'index.html';
      return false;
    }

    questions = examData.questions;
    examInfo = examData.exam;
    studentInfo = student;

    // Formal exam: merge answers back from _answers array
    if (examData._answers && Array.isArray(examData._answers)) {
      var answerMap = {};
      examData._answers.forEach(function (a) { answerMap[a.id] = a.answer; });
      questions.forEach(function (q) {
        if (!q.answer && answerMap[q.id] !== undefined) {
          q.answer = answerMap[q.id];
        }
      });
    }

    questions.forEach(function (q) {
      answerState[q.id] = { answers: [], marked: false };
    });

    return true;
  }

  function getQuestions() { return questions; }
  function getQuestion(index) { return questions[index] || null; }
  function getTotalQuestions() { return questions.length; }
  function getExamInfo() { return examInfo; }
  function getStudentInfo() { return studentInfo; }
  function getAnswerState(questionId) { return answerState[questionId] || { answers: [], marked: false }; }

  function setAnswer(questionId, option, isMultiple) {
    if (!answerState[questionId]) return;
    if (isMultiple) {
      var idx = answerState[questionId].answers.indexOf(option);
      if (idx > -1) { answerState[questionId].answers.splice(idx, 1); }
      else { answerState[questionId].answers.push(option); }
    } else {
      answerState[questionId].answers = [option];
    }
  }

  function clearAnswer(questionId) {
    if (answerState[questionId]) { answerState[questionId].answers = []; }
  }

  function toggleMark(questionId) {
    if (answerState[questionId]) { answerState[questionId].marked = !answerState[questionId].marked; }
    return answerState[questionId] ? answerState[questionId].marked : false;
  }

  function isMarked(questionId) { return answerState[questionId] ? answerState[questionId].marked : false; }
  function isAnswered(questionId) { return answerState[questionId] ? answerState[questionId].answers.length > 0 : false; }

  function getStats() {
    var answered = 0, marked = 0, unanswered = 0;
    questions.forEach(function (q) {
      var state = answerState[q.id];
      if (state.answers.length > 0) { answered++; } else { unanswered++; }
      if (state.marked) { marked++; }
    });
    return { answered: answered, marked: marked, unanswered: unanswered, total: questions.length };
  }

  /**
   * 計算考試成績
   * @param {number} timeUsedSeconds - 作答耗時(秒)
   * @returns {Object} 完整成績報告
   */
  function calculateResult(timeUsedSeconds) {
    var pointsPerQuestion = examInfo.pointsPerQuestion || 2.5;
    var passingScore = examInfo.passingScore || 60;
    var correctCount = 0;
    var answerDetails = [];

    questions.forEach(function (q) {
      var state = answerState[q.id];
      var studentAnswer = state.answers.sort().join(',');
      var correctAnswer = '';

      if (Array.isArray(q.answer)) {
        correctAnswer = q.answer.slice().sort().join(',');
      } else {
        correctAnswer = q.answer;
      }

      var isCorrect = studentAnswer === correctAnswer;
      if (isCorrect) correctCount++;

      answerDetails.push({
        questionId: q.id,
        questionText: q.text || '',
        type: q.type,
        studentAnswer: state.answers,
        correctAnswer: q.answer,
        isCorrect: isCorrect
      });
    });

    var score = correctCount * pointsPerQuestion;
    var totalScore = questions.length * pointsPerQuestion;
    var passed = score >= passingScore;

    return {
      studentId: studentInfo.id,
      studentName: studentInfo.name,
      studentPassword: studentInfo.password || '',
      examTitle: examInfo.title + ' — ' + (examInfo.subject || ''),
      examLevel: examInfo.level || '通識',
      mode: 'exam',
      totalQuestions: questions.length,
      correctCount: correctCount,
      wrongCount: questions.length - correctCount,
      score: score,
      totalScore: totalScore,
      passingScore: passingScore,
      passed: passed,
      timeUsedSeconds: timeUsedSeconds || 0,
      submittedAt: new Date().toISOString(),
      answers: answerDetails
    };
  }

  return {
    init: init, getQuestions: getQuestions, getQuestion: getQuestion,
    getTotalQuestions: getTotalQuestions, getExamInfo: getExamInfo,
    getStudentInfo: getStudentInfo, getAnswerState: getAnswerState,
    setAnswer: setAnswer, clearAnswer: clearAnswer, toggleMark: toggleMark,
    isMarked: isMarked, isAnswered: isAnswered, getStats: getStats,
    calculateResult: calculateResult
  };
})();
