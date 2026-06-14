/**
 * test-cmv.js — 用 ECPay 官方測試向量驗證 CheckMacValue 實作
 *
 * 使用來自 ECPay API Skill test-vectors/checkmacvalue.json 的測試向量
 * 通過 = 實作正確，可安全串接金流
 */

const { generateCheckMacValue } = require('./lib/ecpay-cmv');

// ── 官方測試向量 ──
const vectors = [
  {
    name: 'SHA256 基本測試（AIO 金流）',
    method: 'sha256',
    hashKey: 'pwFHCqoQZGmho4w6',
    hashIV: 'EkRm7iFT261dpevs',
    params: {
      MerchantID: '3002607',
      MerchantTradeNo: 'Test1234567890',
      MerchantTradeDate: '2025/01/01 12:00:00',
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試',
      ItemName: '測試商品',
      ReturnURL: 'https://example.com/notify',
      ChoosePayment: 'ALL',
      EncryptType: '1',
    },
    expected: '291CBA324D31FB5A4BBBFDF2CFE5D32598524753AFD4959C3BF590C5B2F57FB2',
  },
  {
    name: 'MD5 測試（國內物流）',
    method: 'md5',
    hashKey: '5294y06JbISpM5x9',
    hashIV: 'v77hoKGq4kWxNNIS',
    params: {
      MerchantID: '2000132',
      LogisticsType: 'CVS',
      LogisticsSubType: 'UNIMART',
      MerchantTradeDate: '2025/01/01 12:00:00',
    },
    expected: '545E6146FD45BDA683C88454DB34CE8D',
  },
  {
    name: "特殊字元 ' 測試（Node.js 修正驗證）",
    method: 'sha256',
    hashKey: 'pwFHCqoQZGmho4w6',
    hashIV: 'EkRm7iFT261dpevs',
    params: {
      MerchantID: '3002607',
      ItemName: "Tom's Shop",
      TotalAmount: '100',
    },
    expected: 'CF0A3D4901D99459D8641516EC57210700E8A5C9AB26B1D021301E9CB93EF78D',
  },
  {
    name: '特殊字元 ~ 測試',
    method: 'sha256',
    hashKey: 'pwFHCqoQZGmho4w6',
    hashIV: 'EkRm7iFT261dpevs',
    params: {
      MerchantID: '3002607',
      ItemName: 'Test~Product',
      TotalAmount: '200',
    },
    expected: 'CEEAE01D2F9A8E74D4AC0DCE7735B046D73F35A5EC99558A31A2EE03159DA1C9',
  },
];

// ── 執行測試 ──
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   ECPay CheckMacValue 測試向量驗證                      ║');
console.log('║   來源：ECPay API Skill test-vectors/checkmacvalue.json ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

let passed = 0;
let failed = 0;

vectors.forEach((v, i) => {
  const calculated = generateCheckMacValue(v.params, v.hashKey, v.hashIV, v.method);
  const ok = calculated === v.expected;

  if (ok) {
    passed++;
    console.log(`  ✅ #${i + 1} ${v.name}`);
    console.log(`     方法: ${v.method.toUpperCase()} | 結果: ${calculated.slice(0, 16)}...`);
  } else {
    failed++;
    console.log(`  ❌ #${i + 1} ${v.name}`);
    console.log(`     方法: ${v.method.toUpperCase()}`);
    console.log(`     期望: ${v.expected}`);
    console.log(`     實際: ${calculated}`);
  }
  console.log('');
});

console.log('─────────────────────────────────────────────────');
if (failed === 0) {
  console.log(`  🎉 全部通過！${passed}/${passed + failed} 個測試向量驗證成功`);
  console.log('  ✅ CheckMacValue 實作正確，可安全用於金流串接');
} else {
  console.log(`  ⚠️  ${failed} 個測試失敗，${passed} 個通過`);
  console.log('  ❌ CheckMacValue 實作有誤，請勿用於金流串接');
}
console.log('');
