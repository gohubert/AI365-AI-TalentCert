/**
 * admin-panel.js — 管理者後台邏輯
 * 題庫管理、考生管理、考試設定、變更密碼
 */
(function () {
  'use strict';

  const adminPassword = sessionStorage.getItem('adminPassword');
  if (!adminPassword) {
    window.location.href = 'admin-login.html';
    return;
  }

  // ── Sidebar Navigation ──
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const panels = document.querySelectorAll('.admin-panel');

  sidebarItems.forEach(function (item) {
    item.addEventListener('click', function () {
      const panelId = this.getAttribute('data-panel');

      sidebarItems.forEach(function (si) { si.classList.remove('active'); });
      this.classList.add('active');

      panels.forEach(function (p) { p.classList.add('hidden'); });
      document.getElementById(panelId).classList.remove('hidden');
    });
  });

  // ── Toast ──
  function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + (type || 'info');
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3000);
  }

  // ── Sample Data ──
  const SAMPLE_EXAM = {
    "exam": {
      "title": "公務AI共通核心能力認證",
      "level": "通識",
      "subject": "AI 人工智慧應用",
      "totalTime": 50,
      "passingScore": 60,
      "pointsPerQuestion": 2.5,
      "noNegativeMarking": true
    },
    "questions": [
      { "id": 1, "type": "single", "text": "下列何者最能描述「人工智慧（Artificial Intelligence）」的定義？", "options": ["讓電腦能夠自行組裝硬體的技術", "使機器能夠模擬人類智慧行為的科學與工程", "一種新型的程式語言", "專門用來製造機器人的技術"], "answer": "B", "image": null },
      { "id": 2, "type": "single", "text": "下列何者「不是」機器學習（Machine Learning）的主要學習類型？", "options": ["監督式學習（Supervised Learning）", "非監督式學習（Unsupervised Learning）", "強化學習（Reinforcement Learning）", "編譯式學習（Compiled Learning）"], "answer": "D", "image": null },
      { "id": 3, "type": "multiple", "text": "下列哪些是目前常見的深度學習框架？（複選）", "options": ["TensorFlow", "PyTorch", "Microsoft Word", "Keras"], "answer": ["A", "B", "D"], "image": null },
      { "id": 4, "type": "single", "text": "在監督式學習中，訓練資料需要包含什麼？", "options": ["僅需輸入資料", "僅需輸出資料（標籤）", "輸入資料及對應的輸出資料（標籤）", "不需要任何資料"], "answer": "C", "image": null },
      { "id": 5, "type": "single", "text": "「自然語言處理（NLP）」主要處理的對象是什麼？", "options": ["影像資料", "聲音訊號", "人類語言文字", "數值型資料"], "answer": "C", "image": null },
      { "id": 6, "type": "multiple", "text": "下列哪些屬於人工智慧的應用領域？（複選）", "options": ["智慧客服聊天機器人", "醫療影像輔助診斷", "自動駕駛車輛", "傳統紙本文件歸檔"], "answer": ["A", "B", "C"], "image": null },
      { "id": 7, "type": "single", "text": "下列何者是「過度擬合（Overfitting）」的特徵？", "options": ["模型在訓練集和測試集上表現都很差", "模型在訓練集上表現很好，但在測試集上表現很差", "模型完全無法學習", "模型在測試集上表現優於訓練集"], "answer": "B", "image": null },
      { "id": 8, "type": "single", "text": "下列何者「不是」生成式 AI（Generative AI）的代表性應用？", "options": ["ChatGPT 文字生成", "DALL-E 圖片生成", "傳統資料庫查詢", "Midjourney 藝術創作"], "answer": "C", "image": null },
      { "id": 9, "type": "multiple", "text": "下列哪些是使用 AI 時應注意的倫理議題？（複選）", "options": ["資料隱私與個人資料保護", "演算法偏見（Bias）與公平性", "AI 決策的透明度與可解釋性", "AI 的運算速度"], "answer": ["A", "B", "C"], "image": null },
      { "id": 10, "type": "single", "text": "「大型語言模型（LLM）」如 GPT 系列，其核心架構是基於下列哪種技術？", "options": ["決策樹（Decision Tree）", "Transformer 架構", "支持向量機（SVM）", "K-近鄰演算法（KNN）"], "answer": "B", "image": null },
      { "id": 11, "type": "single", "text": "下列何者最適合描述「提示工程（Prompt Engineering）」？", "options": ["設計 AI 硬體電路的工程", "設計有效的輸入提示以引導 AI 模型產生期望輸出的技術", "管理 AI 專案進度的方法", "訓練 AI 模型的演算法"], "answer": "B", "image": null },
      { "id": 12, "type": "multiple", "text": "下列哪些是公務機關導入 AI 時可能面臨的挑戰？（複選）", "options": ["資料品質與資料治理問題", "法規與制度配套不足", "公務人員 AI 素養不足", "AI 系統的電力消耗"], "answer": ["A", "B", "C"], "image": null },
      { "id": 13, "type": "single", "text": "在資料科學的流程中，「資料清洗（Data Cleaning）」的主要目的是什麼？", "options": ["增加資料的數量", "處理缺失值、異常值及格式不一致等問題", "將資料加密保護", "將資料轉換為圖表"], "answer": "B", "image": null },
      { "id": 14, "type": "single", "text": "下列何者是「電腦視覺（Computer Vision）」的典型應用？", "options": ["語音辨識", "文字翻譯", "人臉辨識", "音樂推薦"], "answer": "C", "image": null },
      { "id": 15, "type": "multiple", "text": "下列哪些做法有助於避免 AI 模型的偏見問題？（複選）", "options": ["使用多元且具代表性的訓練資料", "定期檢測模型輸出是否存在偏差", "僅使用單一來源的資料進行訓練", "建立公平性評估指標"], "answer": ["A", "B", "D"], "image": null },
      { "id": 16, "type": "single", "text": "下列何者最能說明「資料標註（Data Labeling）」的作用？", "options": ["將資料進行壓縮儲存", "為訓練資料加上正確的分類或標記", "刪除不需要的資料", "將資料轉換為不同的格式"], "answer": "B", "image": null },
      { "id": 17, "type": "single", "text": "下列何者「不是」聊天機器人（Chatbot）常見的應用場景？", "options": ["線上客服諮詢", "預約掛號服務", "實體商品物流配送", "常見問題自動回覆"], "answer": "C", "image": null },
      { "id": 18, "type": "multiple", "text": "關於「開放資料（Open Data）」與 AI 應用的關係，下列敘述哪些正確？（複選）", "options": ["開放資料可作為 AI 模型訓練的資料來源", "開放資料不需考慮個人資料保護", "開放資料有助於促進 AI 應用的創新與發展", "開放資料在使用前仍需進行資料品質評估"], "answer": ["A", "C", "D"], "image": null },
      { "id": 19, "type": "single", "text": "下列何者是「強化學習（Reinforcement Learning）」的核心概念？", "options": ["透過大量標記資料進行訓練", "透過分群找出資料的隱藏結構", "透過與環境互動，依據獎勵訊號來學習最佳行動策略", "透過複製人類行為來學習"], "answer": "C", "image": null },
      { "id": 20, "type": "single", "text": "根據我國《個人資料保護法》，下列何種資料「不屬於」個人資料？", "options": ["身分證字號", "健康檢查報告", "公司統一編號", "指紋生物特徵"], "answer": "C", "image": null },
      { "id": 21, "type": "multiple", "text": "下列哪些是負責任 AI（Responsible AI）的核心原則？（複選）", "options": ["公平性（Fairness）", "透明性（Transparency）", "追求最大商業利潤", "可問責性（Accountability）"], "answer": ["A", "B", "D"], "image": null },
      { "id": 22, "type": "single", "text": "下列何者最適合用來評估分類模型的效能？", "options": ["均方誤差（MSE）", "混淆矩陣（Confusion Matrix）", "梯度下降法", "主成分分析（PCA）"], "answer": "B", "image": null },
      { "id": 23, "type": "single", "text": "「邊緣運算（Edge Computing）」與 AI 的結合，主要優勢為何？", "options": ["可以使用更大的資料集", "降低延遲，在本地端即時處理資料", "減少模型的參數數量", "不需要任何網路連線"], "answer": "B", "image": null },
      { "id": 24, "type": "multiple", "text": "下列哪些是 AI 在公務部門的實際應用案例？（複選）", "options": ["利用 AI 輔助審查公文及法規", "智慧交通號誌控制系統", "AI 輔助稅務稽核與異常偵測", "使用 AI 完全取代公務員的決策權"], "answer": ["A", "B", "C"], "image": null },
      { "id": 25, "type": "single", "text": "下列何者是「遷移學習（Transfer Learning）」的主要優點？", "options": ["不需要任何訓練資料", "可以利用預訓練模型的知識，減少新任務所需的訓練時間和資料量", "模型的準確度一定會達到 100%", "只能用於影像辨識任務"], "answer": "B", "image": null },
      { "id": 26, "type": "single", "text": "下列何者「不是」常見的資料視覺化工具或套件？", "options": ["Matplotlib", "Tableau", "Power BI", "MySQL"], "answer": "D", "image": null },
      { "id": 27, "type": "multiple", "text": "在使用生成式 AI 產出公文或報告時，下列哪些做法是正確的？（複選）", "options": ["應由人工審核確認 AI 生成的內容正確性", "可直接採用 AI 生成的內容，無需檢查", "應注意是否有著作權或智慧財產權的疑慮", "應避免輸入機密或敏感資料至 AI 系統"], "answer": ["A", "C", "D"], "image": null },
      { "id": 28, "type": "single", "text": "「數位轉型」與「AI 導入」的關係，下列敘述何者最正確？", "options": ["數位轉型就是 AI 導入", "AI 是數位轉型的工具之一，數位轉型的範疇更廣", "兩者完全無關", "AI 導入必須在數位轉型完成後才能開始"], "answer": "B", "image": null },
      { "id": 29, "type": "single", "text": "下列何者是「RAG（Retrieval-Augmented Generation）」技術的主要目的？", "options": ["加速模型的訓練速度", "讓生成式 AI 能檢索外部知識庫，產出更準確、有依據的回答", "減少模型的儲存空間", "將 AI 模型部署到手機上"], "answer": "B", "image": null },
      { "id": 30, "type": "multiple", "text": "下列哪些措施有助於確保公務機關使用 AI 的資訊安全？（複選）", "options": ["建立 AI 系統的存取控制與權限管理", "定期進行 AI 系統的安全性評估與稽核", "將所有資料上傳至公開雲端以利 AI 分析", "制定 AI 使用規範與資安政策"], "answer": ["A", "B", "D"], "image": null }
    ]
  };

  const SAMPLE_ROSTER = [
    { "name": "王小明", "password": "A123456789", "paid": true },
    { "name": "李大華", "password": "B234567890", "paid": true },
    { "name": "張美玲", "password": "C345678901", "paid": false }
  ];

  async function refreshExamList() {
    var practiceContainer = document.getElementById('examListContainer');
    var formalContainer = document.getElementById('formalExamListContainer');
    var result = await window.api.exam.list();

    var practiceExams = [];
    var formalExams = [];

    if (result.success && result.data.length > 0) {
      result.data.forEach(function (exam) {
        if (exam.category === 'formal') {
          formalExams.push(exam);
        } else {
          practiceExams.push(exam);
        }
      });
    }

    // ── Render practice exam list ──
    if (practiceExams.length === 0) {
      practiceContainer.innerHTML = '<div class="info-box info">尚未匯入任何模擬題庫</div>';
    } else {
      var activeIds = await window.api.exam.getActiveIds();
      var html = '<table class="exam-table"><thead><tr><th>啟用</th><th>題庫名稱</th><th>級別</th><th>題數</th><th>匯入日期</th><th>操作</th></tr></thead><tbody>';
      practiceExams.forEach(function (exam) {
        var isActive = activeIds.indexOf(exam.id) > -1;
        var date = new Date(exam.importedAt).toLocaleDateString('zh-TW');
        html += '<tr>'
          + '<td><input type="checkbox" ' + (isActive ? 'checked' : '') + ' onchange="toggleExam(\'' + exam.id + '\')" style="width:18px;height:18px;cursor:pointer;" /></td>'
          + '<td>' + exam.title + (exam.subject ? ' — ' + exam.subject : '') + '</td>'
          + '<td>' + (exam.level || '—') + '</td>'
          + '<td>' + exam.questionCount + ' 題</td>'
          + '<td>' + date + '</td>'
          + '<td class="action-btns">'
          + '<button class="btn btn-outline btn-sm" onclick="renameExam(\'' + exam.id + '\')">✏ 重命名</button> '
          + '<button class="btn btn-danger btn-sm" onclick="deleteExam(\'' + exam.id + '\')">刪除</button>'
          + '</td></tr>';
      });
      html += '</tbody></table>';
      practiceContainer.innerHTML = html;
    }

    // ── Render formal exam list ──
    if (formalExams.length === 0) {
      formalContainer.innerHTML = '<div class="info-box info">尚未匯入任何正式考卷</div>';
    } else {
      var html2 = '<table class="exam-table"><thead><tr><th>考卷名稱</th><th>題數</th><th>考試時間</th><th>匯入日期</th><th>操作</th></tr></thead><tbody>';
      formalExams.forEach(function (exam) {
        var date = new Date(exam.importedAt).toLocaleDateString('zh-TW');
        html2 += '<tr>'
          + '<td><strong>' + exam.title + '</strong>' + (exam.subject ? ' — ' + exam.subject : '') + '</td>'
          + '<td>' + exam.questionCount + ' 題</td>'
          + '<td>' + (exam.totalTime || 50) + ' 分鐘</td>'
          + '<td>' + date + '</td>'
          + '<td class="action-btns">'
          + '<button class="btn btn-outline btn-sm" onclick="renameExam(\'' + exam.id + '\')">✏ 重命名</button> '
          + '<button class="btn btn-danger btn-sm" onclick="deleteExam(\'' + exam.id + '\')">刪除</button>'
          + '</td></tr>';
      });
      html2 += '</tbody></table>';
      formalContainer.innerHTML = html2;
    }
  }

  // Toggle active exam (checkbox) — only for practice
  window.toggleExam = async function (examId) {
    var result = await window.api.exam.toggleActive(examId);
    if (result.success) {
      showToast('✔ 已更新啟用狀態', 'success');
      refreshExamList();
      refreshActiveExam();
    } else {
      showToast('❌ ' + result.error, 'error');
    }
  };

  // Rename exam — use custom modal (Electron doesn't support prompt())
  var _renameExamId = null;
  var renameOverlay = document.getElementById('renameOverlay');
  var renameInput = document.getElementById('renameInput');

  window.renameExam = function (examId) {
    _renameExamId = examId;
    renameInput.value = '';
    renameOverlay.style.display = 'flex';
    renameInput.focus();
  };

  document.getElementById('btnRenameCancel').addEventListener('click', function () {
    renameOverlay.style.display = 'none';
    _renameExamId = null;
  });

  document.getElementById('btnRenameConfirm').addEventListener('click', async function () {
    var newTitle = renameInput.value.trim();
    if (!newTitle) {
      renameInput.style.borderColor = 'var(--danger)';
      renameInput.focus();
      return;
    }
    var result = await window.api.exam.rename(_renameExamId, newTitle);
    renameOverlay.style.display = 'none';
    _renameExamId = null;
    if (result.success) {
      showToast('✔ 已重新命名為「' + newTitle + '」', 'success');
      refreshExamList();
      refreshActiveExam();
    } else {
      showToast('❌ ' + result.error, 'error');
    }
  });

  window.deleteExam = async function (examId) {
    var btn = await window.api.dialog.showConfirm({
      type: 'warning',
      title: '確認刪除',
      message: '確定要刪除此題庫嗎？',
      detail: '刪除後將無法復原。',
      buttons: ['確定刪除', '取消']
    });

    if (btn === 0) {
      var result = await window.api.exam.delete(examId);
      if (result.success) {
        showToast('✔ 題庫已刪除', 'success');
        refreshExamList();
        refreshActiveExam();
      } else {
        showToast('❌ ' + result.error, 'error');
      }
    }
  };

  // Import practice exam from file
  document.getElementById('btnImportExam').addEventListener('click', async function () {
    const result = await window.api.exam.import(adminPassword, 'practice');
    if (result.success) {
      showToast('✔ 模擬題庫匯入成功：' + result.data.title + '（' + result.data.questionCount + ' 題）', 'success');
      refreshExamList();
    } else if (result.error !== '已取消匯入') {
      showToast('❌ ' + result.error, 'error');
    }
  });

  // Import sample exam
  document.getElementById('btnImportSample').addEventListener('click', async function () {
    const result = await window.api.exam.importData(SAMPLE_EXAM, adminPassword, 'practice');
    if (result.success) {
      showToast('✔ 範例題庫匯入成功（' + result.data.questionCount + ' 題）', 'success');
      refreshExamList();
    } else {
      showToast('❌ ' + result.error, 'error');
    }
  });

  // Import formal exam paper
  document.getElementById('btnImportFormal').addEventListener('click', async function () {
    const result = await window.api.exam.import(adminPassword, 'formal');
    if (result.success) {
      showToast('✔ 正式考卷匯入成功：' + result.data.title + '（' + result.data.questionCount + ' 題）', 'success');
      refreshExamList();
    } else if (result.error !== '已取消匯入') {
      showToast('❌ ' + result.error, 'error');
    }
  });
  var _rosterStudents = []; // cache for search
  var _rosterResults = [];  // cache for student results

  async function refreshRoster() {
    const container = document.getElementById('rosterContainer');
    const hasMeta = await window.api.roster.has();

    if (!hasMeta) {
      container.innerHTML = '<div class="info-box info">尚未匯入考生名冊</div>';
      return;
    }

    const result = await window.api.roster.load(adminPassword);
    if (!result.success) {
      container.innerHTML = '<div class="info-box danger">' + result.error + '</div>';
      return;
    }

    _rosterStudents = result.data;
    const meta = await window.api.roster.meta();

    // Load all results for matching
    var resultsResult = await window.api.results.list();
    _rosterResults = (resultsResult.success && resultsResult.data) ? resultsResult.data : [];

    var html = '<div class="info-box success" style="margin-bottom:12px;">共 ' + _rosterStudents.length + ' 位考生'
      + (meta ? '（更新時間：' + new Date(meta.updatedAt).toLocaleString('zh-TW') + '）' : '')
      + '</div>';

    // Search box
    html += '<div class="search-box">'
      + '<input type="text" id="rosterSearch" placeholder="🔍 搜尋姓名或身分證字號..." />'
      + '<span class="search-count" id="rosterSearchCount"></span>'
      + '</div>';

    html += '<div id="rosterTableContainer"></div>';
    container.innerHTML = html;

    // Render initial table
    renderRosterTable(_rosterStudents);

    // Search handler
    document.getElementById('rosterSearch').addEventListener('input', function () {
      var keyword = this.value.trim().toUpperCase();
      if (!keyword) {
        renderRosterTable(_rosterStudents);
        document.getElementById('rosterSearchCount').textContent = '';
        return;
      }
      var filtered = _rosterStudents.filter(function (s) {
        return s.name.toUpperCase().indexOf(keyword) > -1
            || s.password.toUpperCase().indexOf(keyword) > -1;
      });
      renderRosterTable(filtered);
      document.getElementById('rosterSearchCount').textContent = '找到 ' + filtered.length + ' / ' + _rosterStudents.length;
    });
  }

  function renderRosterTable(students) {
    var tableContainer = document.getElementById('rosterTableContainer');
    if (students.length === 0) {
      tableContainer.innerHTML = '<div class="info-box warning">沒有符合條件的考生</div>';
      return;
    }

    var html = '<table class="roster-table"><thead><tr>'
      + '<th>#</th><th>姓名</th><th>身分證字號</th><th>繳費</th><th>允許考試</th><th>成績</th>'
      + '</tr></thead><tbody>';

    students.forEach(function (s, i) {
      var paidLabel = s.paid
        ? '<span style="color:var(--success);">✔</span>'
        : '<span style="color:var(--danger);">✖</span>';
      var isAllow = s.paid || s.allowExam;
      var allowCheckbox = '<input type="checkbox" ' + (isAllow ? 'checked' : '') + ' onchange="toggleStudentAllow(\'' + s.password + '\', this.checked)" style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary);" />';

      // Count results for this student
      var studentResults = _rosterResults.filter(function (r) {
        return r.studentPassword === s.password || r.studentId === s.password;
      });
      var practiceCount = studentResults.filter(function (r) { return r.mode !== 'exam'; }).length;
      var examCount = studentResults.filter(function (r) { return r.mode === 'exam'; }).length;
      var resultsSummary = '📝' + practiceCount + ' / 🏆' + examCount;

      html += '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + s.name + '</td>'
        + '<td style="font-family:monospace;font-size:0.8rem;">' + s.password + '</td>'
        + '<td style="text-align:center;">' + paidLabel + '</td>'
        + '<td style="text-align:center;">' + allowCheckbox + '</td>'
        + '<td><button class="btn btn-outline btn-sm" style="padding:4px 10px;font-size:0.75rem;" onclick="viewStudentResults(\'' + s.password + '\',\'' + s.name + '\')">'
        + resultsSummary + ' 📋</button></td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
  }

  // Toggle student allowExam
  window.toggleStudentAllow = async function (password, checked) {
    var result = await window.api.roster.toggleAllow(password, checked, adminPassword);
    if (result.success) {
      showToast('✔ 已更新「允許考試」狀態', 'success');
    } else {
      showToast('❌ ' + result.error, 'error');
      refreshRoster(); // revert checkbox
    }
  };

  // View student results popup
  window.viewStudentResults = function (password, name) {
    var studentResults = _rosterResults.filter(function (r) {
      return r.studentPassword === password || r.studentId === password;
    });

    if (studentResults.length === 0) {
      showToast('📭 ' + name + ' 尚無任何成績記錄', 'info');
      return;
    }

    // Sort by date desc
    studentResults.sort(function (a, b) {
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });

    var html = '<div style="max-height:60vh;overflow-y:auto;padding:16px;">'
      + '<h3 style="margin-bottom:12px;">📊 ' + name + '（' + password + '）的成績記錄</h3>'
      + '<table class="exam-table"><thead><tr>'
      + '<th>模式</th><th>得分</th><th>答對/答錯</th><th>結果</th><th>耗時</th><th>交卷時間</th>'
      + '</tr></thead><tbody>';

    studentResults.forEach(function (r) {
      var modeLabel = r.mode === 'exam' ? '🏆 正式' : '📝 練習';
      var timeMin = Math.floor((r.timeUsedSeconds || 0) / 60);
      var timeSec = (r.timeUsedSeconds || 0) % 60;
      var timeStr = timeMin + '分' + String(timeSec).padStart(2, '0') + '秒';
      var dateStr = r.submittedAt ? new Date(r.submittedAt).toLocaleString('zh-TW') : '—';
      var passStyle = r.passed ? 'color:var(--success);font-weight:700;' : 'color:var(--danger);font-weight:700;';
      html += '<tr>'
        + '<td>' + modeLabel + '</td>'
        + '<td><strong>' + (r.score || 0) + '</strong> / ' + (r.totalScore || 0) + '</td>'
        + '<td>' + (r.correctCount || 0) + ' / ' + (r.wrongCount || 0) + '</td>'
        + '<td style="' + passStyle + '">' + (r.passed ? '✔ 及格' : '✘ 不及格') + '</td>'
        + '<td>' + timeStr + '</td>'
        + '<td style="font-size:0.8rem;">' + dateStr + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div>';

    // Show in rename overlay (reuse modal)
    var overlay = document.getElementById('renameOverlay');
    var box = overlay.querySelector('.dialog-box') || overlay.firstElementChild;
    if (box) {
      var oldContent = box.innerHTML;
      box.innerHTML = html
        + '<div style="padding:12px 16px;text-align:right;border-top:1px solid #eee;">'
        + '<button class="btn btn-primary btn-sm" id="btnCloseStudentResults">關閉</button></div>';
      overlay.style.display = 'flex';
      document.getElementById('btnCloseStudentResults').addEventListener('click', function () {
        overlay.style.display = 'none';
        box.innerHTML = oldContent;
      });
    }
  };

  document.getElementById('btnImportRoster').addEventListener('click', async function () {
    const result = await window.api.roster.import(adminPassword);
    if (result.success) {
      showToast('✔ 考生名冊匯入成功（' + result.count + ' 位考生）', 'success');
      refreshRoster();
    } else if (result.error !== '已取消匯入') {
      showToast('❌ ' + result.error, 'error');
    }
  });

  document.getElementById('btnImportSampleRoster').addEventListener('click', async function () {
    const result = await window.api.roster.importData(SAMPLE_ROSTER, adminPassword);
    if (result.success) {
      showToast('✔ 範例名冊匯入成功（' + result.count + ' 位考生）', 'success');
      refreshRoster();
    } else {
      showToast('❌ ' + result.error, 'error');
    }
  });

  // ── Exam Settings ──

  async function refreshActiveExam() {
    var container = document.getElementById('activeExamContainer');
    var result = await window.api.exam.getActiveMeta();

    if (!result.success) {
      container.innerHTML = '<div class="info-box warning">尚未啟用任何題庫。請前往「題庫管理」匯入並勾選啟用題庫。</div>';
      return;
    }

    var info = result.data;
    container.innerHTML = '<div class="info-box success">'
      + '<strong>已啟用 ' + info.bankCount + ' 組題庫：</strong>' + info.title
      + '<br>總題數：' + info.questionCount + ' 題'
      + ' ｜ 每次隨機抽 50 題'
      + '</div>';
  }

  // ── Change Password ──

  document.getElementById('changePasswordForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const newPassConfirm = document.getElementById('newPasswordConfirm').value;

    if (!oldPass || !newPass) {
      showToast('❌ 請填寫所有欄位', 'error');
      return;
    }
    if (newPass.length < 6) {
      showToast('❌ 新密碼長度至少需要 6 個字元', 'error');
      return;
    }
    if (newPass !== newPassConfirm) {
      showToast('❌ 兩次輸入的新密碼不一致', 'error');
      return;
    }

    const result = await window.api.admin.changePassword(oldPass, newPass);
    if (result.success) {
      sessionStorage.setItem('adminPassword', newPass);
      showToast('✔ 密碼已變更成功', 'success');
      document.getElementById('changePasswordForm').reset();
    } else {
      showToast('❌ ' + result.error, 'error');
    }
  });

  // ── Logout ──

  document.getElementById('btnLogout').addEventListener('click', function () {
    sessionStorage.removeItem('adminPassword');
    window.location.href = 'index.html';
  });

  // ── Results（正式考試成績） ──

  async function refreshResults() {
    const container = document.getElementById('resultsContainer');
    const result = await window.api.results.list();

    if (!result.success || result.data.length === 0) {
      container.innerHTML = '<div class="info-box info">目前沒有正式考試成績記錄</div>';
      return;
    }

    // Only formal exam results
    const results = result.data.filter(function (r) { return r.mode === 'exam'; });

    if (results.length === 0) {
      container.innerHTML = '<div class="info-box info">目前沒有正式考試成績記錄</div>';
      return;
    }

    let html = '<div class="info-box success" style="margin-bottom:12px;">共 ' + results.length + ' 筆正式考試成績</div>';

    html += '<table class="exam-table"><thead><tr>'
      + '<th>#</th>'
      + '<th>姓名</th>'
      + '<th>身分證字號</th>'
      + '<th>得分</th>'
      + '<th>答對</th>'
      + '<th>答錯</th>'
      + '<th>結果</th>'
      + '<th>耗時</th>'
      + '<th>交卷時間</th>'
      + '<th>操作</th>'
      + '</tr></thead><tbody>';

    results.forEach(function (r, i) {
      const timeMin = Math.floor((r.timeUsedSeconds || 0) / 60);
      const timeSec = (r.timeUsedSeconds || 0) % 60;
      const timeStr = timeMin + '分' + String(timeSec).padStart(2, '0') + '秒';
      const dateStr = r.submittedAt ? new Date(r.submittedAt).toLocaleString('zh-TW') : '—';
      const passStyle = r.passed ? 'color:var(--success);font-weight:700;' : 'color:var(--danger);font-weight:700;';

      html += '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + (r.studentName || '—') + '</td>'
        + '<td>' + (r.studentPassword || r.studentId || '—') + '</td>'
        + '<td><strong>' + (r.score || 0) + '</strong> / ' + (r.totalScore || 0) + '</td>'
        + '<td>' + (r.correctCount || 0) + '</td>'
        + '<td>' + (r.wrongCount || 0) + '</td>'
        + '<td style="' + passStyle + '">' + (r.passed ? '✔ 通過' : '✘ 未通過') + '</td>'
        + '<td>' + timeStr + '</td>'
        + '<td style="font-size:0.8rem;">' + dateStr + '</td>'
        + '<td><button class="btn btn-danger btn-sm" style="padding:4px 10px;font-size:0.75rem;" onclick="deleteOneResult(\'' + (r._filename || '') + '\')">刪除</button></td>'
        + '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  window.deleteOneResult = async function (filename) {
    if (!filename) return;
    var result = await window.api.results.delete(filename);
    if (result.success) {
      showToast('✔ 已刪除該筆成績', 'success');
      refreshResults();
    } else {
      showToast('❌ ' + result.error, 'error');
    }
  };

  document.getElementById('btnRefreshResults').addEventListener('click', function () {
    refreshResults();
    showToast('✔ 成績已重新整理', 'success');
  });

  document.getElementById('btnClearResults').addEventListener('click', async function () {
    const btn = await window.api.dialog.showConfirm({
      type: 'warning',
      title: '確認清除',
      message: '確定要清除所有考試成績嗎？',
      detail: '清除後將無法復原。',
      buttons: ['確定清除', '取消']
    });

    if (btn === 0) {
      const result = await window.api.results.clear();
      if (result.success) {
        showToast('✔ 所有成績已清除', 'success');
        refreshResults();
      } else {
        showToast('❌ ' + result.error, 'error');
      }
    }
  });

  // ── Question Analysis ──

  document.getElementById('btnRunAnalysis').addEventListener('click', async function () {
    var container = document.getElementById('analysisContainer');
    container.innerHTML = '<div class="info-box info">⏳ 正在分析考題資料...</div>';

    var result = await window.api.results.list();
    if (!result.success || result.data.length === 0) {
      container.innerHTML = '<div class="info-box warning">沒有任何成績資料，無法進行分析</div>';
      return;
    }

    // Only formal exam results with answer details
    var examResults = result.data.filter(function (r) {
      return r.mode === 'exam' && r.answers && r.answers.length > 0;
    });

    if (examResults.length < 2) {
      container.innerHTML = '<div class="info-box warning">正式考試成績不足（至少需要 2 筆含作答記錄的成績），無法計算鑑別度</div>';
      return;
    }

    // Sort by score descending
    examResults.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });

    // High group (top 27%) and Low group (bottom 27%)
    var groupSize = Math.max(1, Math.ceil(examResults.length * 0.27));
    var highGroup = examResults.slice(0, groupSize);
    var lowGroup = examResults.slice(-groupSize);

    // Collect all question IDs
    var questionMap = {};
    examResults.forEach(function (r) {
      r.answers.forEach(function (a) {
        var qId = a.questionId || a.id;
        if (!questionMap[qId]) {
          questionMap[qId] = {
            id: qId,
            text: (a.questionText || '').substring(0, 60),
            totalAttempts: 0,
            totalCorrect: 0,
            highCorrect: 0,
            highTotal: 0,
            lowCorrect: 0,
            lowTotal: 0,
          };
        }
        questionMap[qId].totalAttempts++;
        if (a.isCorrect) questionMap[qId].totalCorrect++;
      });
    });

    // Calculate high/low group stats
    function processGroup(group, prefix) {
      group.forEach(function (r) {
        r.answers.forEach(function (a) {
          var qId = a.questionId || a.id;
          if (questionMap[qId]) {
            questionMap[qId][prefix + 'Total']++;
            if (a.isCorrect) questionMap[qId][prefix + 'Correct']++;
          }
        });
      });
    }
    processGroup(highGroup, 'high');
    processGroup(lowGroup, 'low');

    // Calculate metrics
    var questions = Object.values(questionMap).map(function (q) {
      q.difficulty = q.totalAttempts > 0 ? q.totalCorrect / q.totalAttempts : 0;
      var pH = q.highTotal > 0 ? q.highCorrect / q.highTotal : 0;
      var pL = q.lowTotal > 0 ? q.lowCorrect / q.lowTotal : 0;
      q.discrimination = pH - pL;
      return q;
    });

    // Sort: worst discrimination first
    questions.sort(function (a, b) { return a.discrimination - b.discrimination; });

    // Build report
    var html = '<div class="info-box success" style="margin-bottom:16px;">'
      + '分析基於 <strong>' + examResults.length + '</strong> 筆正式考試成績'
      + '（高分組 ' + groupSize + ' 人 / 低分組 ' + groupSize + ' 人）'
      + '</div>';

    // Summary stats
    var tooHard = questions.filter(function (q) { return q.difficulty < 0.3; }).length;
    var tooEasy = questions.filter(function (q) { return q.difficulty > 0.9; }).length;
    var lowDisc = questions.filter(function (q) { return q.discrimination < 0.2; }).length;

    html += '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:140px;padding:16px;background:rgba(231,76,60,0.08);border-radius:8px;text-align:center;">'
      + '<div style="font-size:2rem;font-weight:900;color:var(--danger);">' + tooHard + '</div>'
      + '<div style="font-size:0.85rem;color:var(--text-secondary);">太難 (答對率＜30%)</div></div>'
      + '<div style="flex:1;min-width:140px;padding:16px;background:rgba(243,156,18,0.08);border-radius:8px;text-align:center;">'
      + '<div style="font-size:2rem;font-weight:900;color:var(--warning);">' + tooEasy + '</div>'
      + '<div style="font-size:0.85rem;color:var(--text-secondary);">太簡單 (答對率＞90%)</div></div>'
      + '<div style="flex:1;min-width:140px;padding:16px;background:rgba(91,62,150,0.08);border-radius:8px;text-align:center;">'
      + '<div style="font-size:2rem;font-weight:900;color:var(--primary);">' + lowDisc + '</div>'
      + '<div style="font-size:0.85rem;color:var(--text-secondary);">低鑑別度 (D＜0.2)</div></div>'
      + '</div>';

    // Detail table
    html += '<table class="exam-table"><thead><tr>'
      + '<th>題號</th><th>題目摘要</th><th>答對率 (P)</th><th>難度</th><th>鑑別度 (D)</th><th>評等</th>'
      + '</tr></thead><tbody>';

    questions.forEach(function (q) {
      var pPct = (q.difficulty * 100).toFixed(1) + '%';
      var dVal = q.discrimination.toFixed(2);

      var diffLabel, diffColor;
      if (q.difficulty < 0.3) { diffLabel = '太難'; diffColor = 'var(--danger)'; }
      else if (q.difficulty > 0.9) { diffLabel = '太簡單'; diffColor = 'var(--warning)'; }
      else if (q.difficulty > 0.7) { diffLabel = '容易'; diffColor = 'var(--success)'; }
      else { diffLabel = '適中'; diffColor = 'var(--secondary-dark)'; }

      var discLabel, discColor;
      if (q.discrimination < 0) { discLabel = '⚠ 需檢查'; discColor = 'var(--danger)'; }
      else if (q.discrimination < 0.2) { discLabel = '低'; discColor = 'var(--warning)'; }
      else if (q.discrimination < 0.4) { discLabel = '中等'; discColor = 'var(--secondary-dark)'; }
      else { discLabel = '優良'; discColor = 'var(--success)'; }

      var rowBg = (q.discrimination < 0.2 || q.difficulty < 0.3) ? 'background:rgba(231,76,60,0.04);' : '';

      html += '<tr style="' + rowBg + '">'
        + '<td style="font-weight:700;">' + q.id + '</td>'
        + '<td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + q.text + '</td>'
        + '<td>' + pPct + '</td>'
        + '<td style="color:' + diffColor + ';font-weight:700;">' + diffLabel + '</td>'
        + '<td style="font-weight:700;">' + dVal + '</td>'
        + '<td style="color:' + discColor + ';font-weight:700;">' + discLabel + '</td>'
        + '</tr>';
    });

    html += '</tbody></table>';
    html += '<div style="margin-top:16px;padding:12px 16px;background:#F8F9FA;border-radius:8px;font-size:0.8rem;color:var(--text-secondary);line-height:1.8;">'
      + '<strong>指標說明：</strong><br>'
      + '• <strong>答對率 (P)</strong>：所有考生答對該題的比例，越低表示越難<br>'
      + '• <strong>鑑別度 (D)</strong>：高分組答對率 - 低分組答對率，D ≥ 0.4 優良，0.2~0.4 中等，D &lt; 0.2 低鑑別度<br>'
      + '• D &lt; 0 表示低分組答對率反而高於高分組，建議檢查題目或答案是否有誤'
      + '</div>';

    container.innerHTML = html;
  });

  // ── Reports ──

  async function refreshReports() {
    var container = document.getElementById('reportsContainer');
    var result = await window.api.reports.list();

    if (!result.success || result.data.length === 0) {
      container.innerHTML = '<div class="info-box info">目前沒有報錯記錄 👍</div>';
      return;
    }

    var reports = result.data;
    var html = '<div class="info-box warning" style="margin-bottom:12px;">共 ' + reports.length + ' 筆報錯記錄，請逐一檢查</div>';

    reports.forEach(function (r, i) {
      var dateStr = r.reportedAt ? new Date(r.reportedAt).toLocaleString('zh-TW') : '—';
      html += '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px 18px;margin-bottom:10px;border-left:4px solid #f59e0b;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
        + '<strong style="color:var(--primary);">第 ' + (r.questionIndex || r.questionId) + ' 題</strong>'
        + '<span style="font-size:0.8rem;color:var(--text-light);">' + dateStr + '</span>'
        + '</div>'
        + '<div style="font-size:0.9rem;line-height:1.6;color:var(--text-secondary);margin-bottom:6px;">' + (r.questionText || '—') + '</div>'
        + '<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:8px;">目前答案：<strong>' + (r.currentAnswer || '—') + '</strong></div>'
        + '<div style="background:var(--bg-card);border-radius:8px;padding:10px 14px;font-size:0.9rem;line-height:1.6;">'
        + '💬 <strong>考生回報：</strong>' + (r.reportContent || '—')
        + '</div>'
        + '<div style="font-size:0.78rem;color:var(--text-light);margin-top:6px;">回報者：' + (r.studentName || '—') + '（' + (r.studentId || '—') + '）</div>'
        + '</div>';
    });

    container.innerHTML = html;
  }

  document.getElementById('btnRefreshReports').addEventListener('click', function () {
    refreshReports();
    showToast('✔ 報錯記錄已重新整理', 'success');
  });

  document.getElementById('btnClearReports').addEventListener('click', async function () {
    var btn = await window.api.dialog.showConfirm({
      type: 'warning',
      title: '確認清除',
      message: '確定要清除所有報錯記錄嗎？',
      detail: '清除後將無法復原。',
      buttons: ['確定清除', '取消']
    });

    if (btn === 0) {
      var result = await window.api.reports.clear();
      if (result.success) {
        showToast('✔ 所有報錯已清除', 'success');
        refreshReports();
      } else {
        showToast('❌ ' + result.error, 'error');
      }
    }
  });

  // ── Init ──
  refreshExamList();
  refreshRoster();
  refreshActiveExam();
  refreshResults();
  refreshReports();

  // Display version
  (async function () {
    if (window.api && window.api.getVersion) {
      var ver = await window.api.getVersion();
      var tag = document.getElementById('adminVersionTag');
      if (tag) tag.textContent = 'v' + ver;
    }
  })();
})();
