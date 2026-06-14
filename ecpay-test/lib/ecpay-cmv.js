/**
 * ecpay-cmv.js — ECPay CheckMacValue 計算與驗證模組
 *
 * 依據 ECPay API Skill (guides/13-checkmacvalue.md) 精確實作
 * 支援 SHA256 (AIO 金流) 與 MD5 (國內物流)
 */

const crypto = require('crypto');

/**
 * ECPay 專用 URL Encode
 * 對應 PHP SDK UrlService::ecpayUrlEncode()
 *
 * 流程：
 * 1. encodeURIComponent → %20 → +
 * 2. ~ → %7e, ' → %27 (PHP urlencode 會編碼這兩個字元)
 * 3. toLowerCase()
 * 4. .NET 特殊字元還原
 */
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');

  encoded = encoded.toLowerCase();

  const replacements = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [old, char] of Object.entries(replacements)) {
    encoded = encoded.split(old).join(char);
  }
  return encoded;
}

/**
 * 產生 CheckMacValue
 * 對應 PHP SDK CheckMacValueService::generate()
 *
 * @param {Object} params - API 參數
 * @param {string} hashKey - HashKey
 * @param {string} hashIv - HashIV
 * @param {string} method - 'sha256' 或 'md5'
 * @returns {string} CheckMacValue (大寫 hex)
 */
function generateCheckMacValue(params, hashKey, hashIv, method = 'sha256') {
  // 1. 移除既有 CheckMacValue
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );

  // 2. Key 不區分大小寫字典序排序
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // 3. 組合字串：HashKey={key}&{k1=v1&k2=v2&...}&HashIV={iv}
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;

  // 4. ECPay URL encode
  const encoded = ecpayUrlEncode(raw);

  // 5. Hash (SHA256 or MD5)
  const hash = crypto.createHash(method).update(encoded, 'utf8').digest('hex');

  // 6. 轉大寫
  return hash.toUpperCase();
}

/**
 * 驗證 CheckMacValue（Timing-Safe）
 *
 * @param {Object} params - 包含 CheckMacValue 的參數
 * @param {string} hashKey - HashKey
 * @param {string} hashIv - HashIV
 * @param {string} method - 'sha256' 或 'md5'
 * @returns {boolean}
 */
function verifyCheckMacValue(params, hashKey, hashIv, method = 'sha256') {
  const received = params.CheckMacValue || '';
  const calculated = generateCheckMacValue(params, hashKey, hashIv, method);

  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { ecpayUrlEncode, generateCheckMacValue, verifyCheckMacValue };
