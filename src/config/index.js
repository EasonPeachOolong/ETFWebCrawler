const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

/**
 * 配置管理类
 */
class ConfigManager {
  constructor() {
    this.config = {
      // 数据存储配置
      storage: {
        dataPath: process.env.DATA_PATH || './data',
        enableDatabase: process.env.ENABLE_DATABASE === 'true'
      },
      
      // 日志配置
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        logPath: './logs'
      },
      
      // 请求配置
      request: {
        minDelay: parseInt(process.env.MIN_DELAY) || 1000,
        maxDelay: parseInt(process.env.MAX_DELAY) || 3000,
        concurrentLimit: parseInt(process.env.CONCURRENT_LIMIT) || 3,
        timeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
        retries: parseInt(process.env.REQUEST_RETRIES) || 3
      },
      
      // 调度配置
      scheduler: {
        dailyCron: process.env.DAILY_CRON || '0 0 8 * * *'
      },
      
      // 反爬虫配置
      antiBot: {
        rotateUserAgent: process.env.ROTATE_USER_AGENT === 'true',
        proxy: {
          host: process.env.PROXY_HOST,
          port: process.env.PROXY_PORT,
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD
        }
      },
      
      // 数据库配置
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'crawler_db',
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }
    };
  }
  
  /**
   * 获取配置项
   * @param {string} key - 配置键，支持点分隔符
   * @returns {*} 配置值
   */
  get(key) {
    return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
  }
  
  /**
   * 设置配置项
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   */
  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, this.config);
    target[lastKey] = value;
  }
  
  /**
   * 获取所有配置
   * @returns {object} 完整配置对象
   */
  getAll() {
    return { ...this.config };
  }
}

module.exports = new ConfigManager(); 