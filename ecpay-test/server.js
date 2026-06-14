/**
 * server.js — ECPay AIO 金流測試伺服器
 *
 * 依據 ECPay API Skill (guides/01-payment-aio.md) 建立
 * 使用綠界測試環境帳號，模擬完整的 AIO 信用卡付款流程
 *
 * 測試環境帳號：
 *   MerchantID: 3002607
 *   HashKey:    pwFHCqoQZGmho4w6
 *   HashIV:     EkRm7iFT261dpevs
 *
 * 測試信用卡：
 *   卡號:    4311-9522-2222-2222
 *   有效期:  任意未來日期
 *   CVV:     222
 *   3DS 驗證碼: 1234
 */

const express = require('express');
const path = require('path');
const { generateCheckMacValue, verifyCheckMacValue } = require('./lib/ecpay-cmv');

const app = express();
const PORT = 3099;

// ── ECPay 測試環境設定 ──
const ECPAY_CONFIG = {
  MerchantID: '3002607',
  HashKey: 'pwFHCqoQZGmho4w6',
  HashIV: 'EkRm7iFT261dpevs',
  // 測試環境端點
  AioCheckOutUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  QueryTradeUrl: 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
};

// ── Middleware ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 訂單記錄（記憶體暫存）──
const orders = new Map();

// ── 首頁 ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── API: 建立訂單 ──
app.post('/api/create-order', (req, res) => {
  const { amount, itemName, description } = req.body;

  // 產生唯一交易編號（最長 20 字元）
  const tradeNo = 'AI' + Date.now().toString().slice(-12) + Math.floor(Math.random() * 100).toString().padStart(2, '0');

  // 交易時間格式：yyyy/MM/dd HH:mm:ss
  const now = new Date();
  const tradeDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('/') + ' ' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join(':');

  // AIO 必填參數
  const params = {
    MerchantID: ECPAY_CONFIG.MerchantID,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: String(parseInt(amount) || 100),
    TradeDesc: description || '公務AI認證考試系統-測試交易',
    ItemName: itemName || '測試商品',
    ReturnURL: `${req.protocol}://${req.get('host')}/ecpay/notify`,
    ChoosePayment: 'Credit',
    EncryptType: '1',
    // 可選：付款完成後導回的前端頁面
    OrderResultURL: `${req.protocol}://${req.get('host')}/ecpay/result`,
    ClientBackURL: `${req.protocol}://${req.get('host')}/`,
    NeedExtraPaidInfo: 'Y',
  };

  // 計算 CheckMacValue
  const checkMacValue = generateCheckMacValue(
    params,
    ECPAY_CONFIG.HashKey,
    ECPAY_CONFIG.HashIV,
    'sha256'
  );
  params.CheckMacValue = checkMacValue;

  // 記錄訂單
  orders.set(tradeNo, {
    tradeNo,
    amount: params.TotalAmount,
    itemName: params.ItemName,
    status: 'pending',
    createdAt: tradeDate,
    params: { ...params },
  });

  console.log(`[建單] 交易編號=${tradeNo} 金額=${params.TotalAmount} CMV=${checkMacValue.slice(0, 16)}...`);

  // 產生自動提交的 HTML 表單（瀏覽器會自動跳到綠界付款頁）
  const formHtml = generateAutoSubmitForm(params, ECPAY_CONFIG.AioCheckOutUrl);

  res.send(formHtml);
});

// ── ECPay Callback: ReturnURL（Server-to-Server）──
app.post('/ecpay/notify', (req, res) => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  📩 收到 ECPay ReturnURL Callback        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('  參數:', JSON.stringify(req.body, null, 2));

  // 驗證 CheckMacValue
  const isValid = verifyCheckMacValue(
    req.body,
    ECPAY_CONFIG.HashKey,
    ECPAY_CONFIG.HashIV,
    'sha256'
  );

  if (!isValid) {
    console.error('  ❌ CheckMacValue 驗證失敗！可能是偽造的 Callback');
    // ⚠️ 仍需回應 1|OK，否則 ECPay 會重試
    return res.type('text').send('1|OK');
  }

  console.log('  ✅ CheckMacValue 驗證通過');

  // ⚠️ AIO RtnCode 是字串 '1'（不是整數 1）
  const tradeNo = req.body.MerchantTradeNo;
  if (req.body.RtnCode === '1') {
    console.log(`  🎉 付款成功！訂單=${tradeNo}, TradeNo=${req.body.TradeNo}`);
    console.log(`     付款方式=${req.body.PaymentType}, 金額=${req.body.TradeAmt}`);

    // 更新訂單狀態
    if (orders.has(tradeNo)) {
      const order = orders.get(tradeNo);
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      order.ecpayTradeNo = req.body.TradeNo;
      order.paymentType = req.body.PaymentType;
      order.callbackData = req.body;
    }
  } else {
    console.log(`  ⚠️ 付款未成功 RtnCode=${req.body.RtnCode} RtnMsg=${req.body.RtnMsg}`);
    if (orders.has(tradeNo)) {
      orders.get(tradeNo).status = 'failed';
      orders.get(tradeNo).errorMsg = req.body.RtnMsg;
    }
  }

  // ⚠️ 必須回應純文字 1|OK，否則 ECPay 會每 5-15 分鐘重試，每日最多 4 次
  res.type('text').send('1|OK');
});

// ── ECPay Callback: OrderResultURL（瀏覽器導回）──
app.post('/ecpay/result', (req, res) => {
  console.log('');
  console.log('  📎 收到 OrderResultURL（瀏覽器導回）');

  const isValid = verifyCheckMacValue(
    req.body,
    ECPAY_CONFIG.HashKey,
    ECPAY_CONFIG.HashIV,
    'sha256'
  );

  const tradeNo = req.body.MerchantTradeNo || '';
  const success = req.body.RtnCode === '1';

  // 導回結果頁面
  res.redirect(`/result.html?tradeNo=${tradeNo}&success=${success}&valid=${isValid}&rtnCode=${req.body.RtnCode || ''}&rtnMsg=${encodeURIComponent(req.body.RtnMsg || '')}&amount=${req.body.TradeAmt || ''}&paymentType=${req.body.PaymentType || ''}`);
});

// ── API: 查詢訂單列表 ──
app.get('/api/orders', (req, res) => {
  const list = Array.from(orders.values()).reverse();
  res.json({ success: true, data: list });
});

// ── API: 主動查詢訂單（從 ECPay 查）──
app.post('/api/query-order', async (req, res) => {
  const { tradeNo } = req.body;
  if (!tradeNo) return res.json({ success: false, error: '缺少交易編號' });

  const params = {
    MerchantID: ECPAY_CONFIG.MerchantID,
    MerchantTradeNo: tradeNo,
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
  };

  params.CheckMacValue = generateCheckMacValue(
    params,
    ECPAY_CONFIG.HashKey,
    ECPAY_CONFIG.HashIV,
    'sha256'
  );

  try {
    const response = await fetch(ECPAY_CONFIG.QueryTradeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(15000),
    });

    const text = await response.text();
    // 回應為 URL-encoded 字串
    const result = Object.fromEntries(new URLSearchParams(text));

    console.log(`  🔍 查詢訂單 ${tradeNo}:`, result);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(`  ❌ 查詢失敗: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

// ── 輔助函式：產生自動提交的 HTML 表單 ──
function generateAutoSubmitForm(params, actionUrl) {
  const fields = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(String(v))}">`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>導向綠界付款頁...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; margin: 0;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #e2e8f0;
    }
    .loading {
      text-align: center;
    }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(99, 102, 241, 0.3);
      border-top: 4px solid #818cf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 18px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>正在導向綠界付款頁面...</p>
  </div>
  <form id="ecpay-form" method="POST" action="${actionUrl}" style="display:none;">
      ${fields}
  </form>
  <script>document.getElementById('ecpay-form').submit();</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 啟動伺服器 ──
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🏦 ECPay AIO 金流測試伺服器                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 http://localhost:${PORT}                              ║`);
  console.log('║                                                          ║');
  console.log('║  📋 測試環境帳號:                                        ║');
  console.log('║     MerchantID: 3002607                                  ║');
  console.log('║     HashKey:    pwFHCqoQZGmho4w6                         ║');
  console.log('║     HashIV:     EkRm7iFT261dpevs                         ║');
  console.log('║                                                          ║');
  console.log('║  💳 測試信用卡:                                          ║');
  console.log('║     卡號:    4311-9522-2222-2222                         ║');
  console.log('║     有效期:  任意未來日期                                 ║');
  console.log('║     CVV:     222                                         ║');
  console.log('║     3DS碼:   1234                                        ║');
  console.log('║                                                          ║');
  console.log('║  ⚡ 使用測試信用卡付款即可驗證金流                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});
