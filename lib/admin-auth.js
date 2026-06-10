/**
 * admin-auth.js — 管理者認證模組
 * 公務AI共通核心能力認證考試系統
 *
 * 使用 bcryptjs 進行密碼雜湊與驗證
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
let dataDir = '';

/**
 * Initialize the module with the application data directory
 * @param {string} appDataDir - Path to the app data directory
 */
function init(appDataDir) {
  dataDir = appDataDir;
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Get the path to the admin hash file
 */
function getHashFilePath() {
  return path.join(dataDir, 'admin.hash');
}

/**
 * Check if admin account has been initialized
 * @returns {boolean}
 */
function isAdminInitialized() {
  return fs.existsSync(getHashFilePath());
}

/**
 * Initialize admin password (first-time setup)
 * @param {string} password - The admin password to set
 * @returns {boolean} Success
 */
function initAdmin(password) {
  if (isAdminInitialized()) {
    throw new Error('管理者帳號已設定，請使用變更密碼功能');
  }

  if (!password || password.length < 6) {
    throw new Error('密碼長度至少需要 6 個字元');
  }

  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  fs.writeFileSync(getHashFilePath(), hash, 'utf8');
  return true;
}

/**
 * Verify admin password
 * @param {string} password - The password to verify
 * @returns {boolean} Whether the password is correct
 */
function verifyAdmin(password) {
  if (!isAdminInitialized()) {
    throw new Error('管理者帳號尚未設定');
  }

  const storedHash = fs.readFileSync(getHashFilePath(), 'utf8').trim();
  return bcrypt.compareSync(password, storedHash);
}

/**
 * Change admin password
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {boolean} Success
 */
function changePassword(oldPassword, newPassword) {
  if (!verifyAdmin(oldPassword)) {
    throw new Error('目前密碼不正確');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('新密碼長度至少需要 6 個字元');
  }

  const hash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
  fs.writeFileSync(getHashFilePath(), hash, 'utf8');
  return true;
}

module.exports = {
  init,
  isAdminInitialized,
  initAdmin,
  verifyAdmin,
  changePassword,
};
