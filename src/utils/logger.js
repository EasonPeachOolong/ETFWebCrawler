const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config');

// 确保日志目录存在
const logDir = config.get('logging.logPath');
fs.ensureDirSync(logDir);

/**
 * 日志管理器
 */
class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: config.get('logging.level'),
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'web-crawler' },
      transports: [
        // 错误日志文件
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 10
        }),
        
        // 合并日志文件
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 10
        }),
        
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
              return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
          )
        })
      ]
    });
  }
  
  /**
   * 记录信息日志
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }
  
  /**
   * 记录警告日志
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }
  
  /**
   * 记录错误日志
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }
  
  /**
   * 记录调试日志
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }
  
  /**
   * 为特定爬虫创建子日志器
   * @param {string} crawlerName - 爬虫名称
   * @returns {object} 子日志器
   */
  createChildLogger(crawlerName) {
    return {
      info: (message, meta = {}) => this.info(message, { crawler: crawlerName, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { crawler: crawlerName, ...meta }),
      error: (message, meta = {}) => this.error(message, { crawler: crawlerName, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { crawler: crawlerName, ...meta })
    };
  }
}

module.exports = new Logger(); 