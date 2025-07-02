const config = require('../config');

/**
 * 请求限速器
 */
class RateLimiter {
  constructor() {
    this.requestTimes = new Map(); // 存储每个域名的请求时间
    this.minDelay = config.get('request.minDelay');
    this.maxDelay = config.get('request.maxDelay');
  }
  
  /**
   * 获取随机延迟时间
   * @returns {number} 延迟时间（毫秒）
   */
  getRandomDelay() {
    return Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
  }
  
  /**
   * 等待请求限速
   * @param {string} domain - 域名
   * @returns {Promise<void>}
   */
  async waitForRate(domain) {
    const now = Date.now();
    const lastRequestTime = this.requestTimes.get(domain) || 0;
    const timeSinceLastRequest = now - lastRequestTime;
    const delay = this.getRandomDelay();
    
    if (timeSinceLastRequest < delay) {
      const waitTime = delay - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    this.requestTimes.set(domain, Date.now());
  }
  
  /**
   * 睡眠函数
   * @param {number} ms - 毫秒
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 重置某个域名的限速记录
   * @param {string} domain - 域名
   */
  reset(domain) {
    this.requestTimes.delete(domain);
  }
  
  /**
   * 清理所有限速记录
   */
  clearAll() {
    this.requestTimes.clear();
  }
}

module.exports = RateLimiter; 