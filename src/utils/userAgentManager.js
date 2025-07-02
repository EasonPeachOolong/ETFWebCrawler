const UserAgent = require('user-agents');
const config = require('../config');

/**
 * User-Agent管理器
 */
class UserAgentManager {
  constructor() {
    this.userAgent = new UserAgent();
    this.rotateEnabled = config.get('antiBot.rotateUserAgent');
    
    // 预定义的常用User-Agent列表
    this.commonUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
    ];
    
    this.currentIndex = 0;
  }
  
  /**
   * 获取随机User-Agent
   * @returns {string} User-Agent字符串
   */
  getRandomUserAgent() {
    if (!this.rotateEnabled) {
      return this.commonUserAgents[0]; // 使用固定的第一个
    }
    
    try {
      // 使用user-agents库生成随机UA
      return this.userAgent.toString();
    } catch (error) {
      // 如果出错，使用预定义列表
      return this.getCommonUserAgent();
    }
  }
  
  /**
   * 从预定义列表获取User-Agent
   * @returns {string} User-Agent字符串
   */
  getCommonUserAgent() {
    if (!this.rotateEnabled) {
      return this.commonUserAgents[0];
    }
    
    const userAgent = this.commonUserAgents[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.commonUserAgents.length;
    return userAgent;
  }
  
  /**
   * 获取移动端User-Agent
   * @returns {string} 移动端User-Agent字符串
   */
  getMobileUserAgent() {
    const mobileUserAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0',
      'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
    ];
    
    return mobileUserAgents[Math.floor(Math.random() * mobileUserAgents.length)];
  }
  
  /**
   * 获取桌面端User-Agent
   * @returns {string} 桌面端User-Agent字符串
   */
  getDesktopUserAgent() {
    return this.getCommonUserAgent();
  }
  
  /**
   * 重置索引
   */
  reset() {
    this.currentIndex = 0;
  }
}

module.exports = UserAgentManager; 