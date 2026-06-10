/**
 * crypto-manager.js — 加密/解密模組
 * 公務AI共通核心能力認證考試系統
 *
 * 使用 AES-256-GCM 加密，PBKDF2 金鑰衍生
 * 確保題庫在磁碟上無法被直接讀取
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const AUTH_TAG_LENGTH = 16;

// Application-level salt prefix (adds extra protection layer)
const APP_SALT_PREFIX = Buffer.from('AI-TalentCert-2026-Secure', 'utf8');

/**
 * Derive an encryption key from a password using PBKDF2
 * @param {string} password - The password to derive the key from
 * @param {Buffer} salt - The salt for key derivation
 * @returns {Buffer} The derived key
 */
function deriveKey(password, salt) {
  const combinedSalt = Buffer.concat([APP_SALT_PREFIX, salt]);
  return crypto.pbkdf2Sync(password, combinedSalt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt plaintext data
 * @param {string} plaintext - The data to encrypt (JSON string or text)
 * @param {string} password - The password used for encryption
 * @returns {Buffer} Encrypted data buffer containing: salt + iv + authTag + ciphertext
 */
function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: salt(32) + iv(16) + authTag(16) + ciphertext(variable)
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt encrypted data
 * @param {Buffer} encryptedData - The encrypted data buffer
 * @param {string} password - The password used for decryption
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails (wrong password or corrupted data)
 */
function decrypt(encryptedData, password) {
  if (!Buffer.isBuffer(encryptedData)) {
    encryptedData = Buffer.from(encryptedData);
  }

  const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (encryptedData.length < minLength) {
    throw new Error('加密資料格式不正確或已損毀');
  }

  // Unpack
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('解密失敗：密碼不正確或資料已損毀');
  }
}

/**
 * Encrypt a JavaScript object (serializes to JSON first)
 * @param {Object} obj - The object to encrypt
 * @param {string} password - The password
 * @returns {Buffer} Encrypted buffer
 */
function encryptObject(obj, password) {
  const json = JSON.stringify(obj);
  return encrypt(json, password);
}

/**
 * Decrypt data back to a JavaScript object
 * @param {Buffer} encryptedData - The encrypted buffer
 * @param {string} password - The password
 * @returns {Object} Decrypted object
 */
function decryptObject(encryptedData, password) {
  const json = decrypt(encryptedData, password);
  return JSON.parse(json);
}

module.exports = {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
};
