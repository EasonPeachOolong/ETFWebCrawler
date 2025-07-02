const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 调度服务类
 */
class ScheduleService {
  constructor() {
    this.tasks = new Map(); // 存储任务
    this.isRunning = false;
    this.defaultCron = config.get('scheduler.dailyCron');
  }
  
  /**
   * 添加定时任务
   * @param {string} name - 任务名称
   * @param {string} cronExpression - cron表达式
   * @param {Function} callback - 回调函数
   * @param {object} options - 任务选项
   * @returns {boolean} 是否添加成功
   */
  addTask(name, cronExpression, callback, options = {}) {
    try {
      // 验证cron表达式
      if (!cron.validate(cronExpression)) {
        logger.error('无效的cron表达式', { name, cronExpression });
        return false;
      }
      
      // 如果任务已存在，先停止它
      if (this.tasks.has(name)) {
        this.removeTask(name);
      }
      
      const taskOptions = {
        scheduled: false, // 不立即启动
        timezone: options.timezone || 'Asia/Shanghai',
        ...options
      };
      
      // 创建任务
      const task = cron.schedule(cronExpression, async () => {
        logger.info('定时任务开始执行', { name, cronExpression });
        
        try {
          await callback();
          logger.info('定时任务执行完成', { name });
        } catch (error) {
          logger.error('定时任务执行失败', { 
            name, 
            error: error.message,
            stack: error.stack
          });
        }
      }, taskOptions);
      
      // 存储任务信息
      this.tasks.set(name, {
        task,
        cronExpression,
        callback,
        options: taskOptions,
        createdAt: new Date(),
        lastRun: null,
        runCount: 0
      });
      
      logger.info('定时任务已添加', { name, cronExpression });
      return true;
    } catch (error) {
      logger.error('添加定时任务失败', { 
        name, 
        cronExpression,
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 移除定时任务
   * @param {string} name - 任务名称
   * @returns {boolean} 是否移除成功
   */
  removeTask(name) {
    try {
      const taskInfo = this.tasks.get(name);
      if (!taskInfo) {
        logger.warn('任务不存在', { name });
        return false;
      }
      
      // 停止任务
      taskInfo.task.stop();
      taskInfo.task.destroy();
      
      // 从Map中删除
      this.tasks.delete(name);
      
      logger.info('定时任务已移除', { name });
      return true;
    } catch (error) {
      logger.error('移除定时任务失败', { 
        name, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 启动指定任务
   * @param {string} name - 任务名称
   * @returns {boolean} 是否启动成功
   */
  startTask(name) {
    try {
      const taskInfo = this.tasks.get(name);
      if (!taskInfo) {
        logger.error('任务不存在', { name });
        return false;
      }
      
      taskInfo.task.start();
      logger.info('定时任务已启动', { name });
      return true;
    } catch (error) {
      logger.error('启动定时任务失败', { 
        name, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 停止指定任务
   * @param {string} name - 任务名称
   * @returns {boolean} 是否停止成功
   */
  stopTask(name) {
    try {
      const taskInfo = this.tasks.get(name);
      if (!taskInfo) {
        logger.error('任务不存在', { name });
        return false;
      }
      
      taskInfo.task.stop();
      logger.info('定时任务已停止', { name });
      return true;
    } catch (error) {
      logger.error('停止定时任务失败', { 
        name, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 立即执行指定任务
   * @param {string} name - 任务名称
   * @returns {Promise<boolean>} 是否执行成功
   */
  async runTask(name) {
    try {
      const taskInfo = this.tasks.get(name);
      if (!taskInfo) {
        logger.error('任务不存在', { name });
        return false;
      }
      
      logger.info('手动执行定时任务', { name });
      
      await taskInfo.callback();
      
      // 更新执行统计
      taskInfo.lastRun = new Date();
      taskInfo.runCount++;
      
      logger.info('手动执行定时任务完成', { name });
      return true;
    } catch (error) {
      logger.error('手动执行定时任务失败', { 
        name, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 启动所有任务
   */
  startAll() {
    logger.info('启动所有定时任务');
    
    for (const [name, taskInfo] of this.tasks) {
      try {
        taskInfo.task.start();
        logger.info('定时任务已启动', { name });
      } catch (error) {
        logger.error('启动定时任务失败', { 
          name, 
          error: error.message 
        });
      }
    }
    
    this.isRunning = true;
    logger.info('所有定时任务启动完成', { taskCount: this.tasks.size });
  }
  
  /**
   * 停止所有任务
   */
  stopAll() {
    logger.info('停止所有定时任务');
    
    for (const [name, taskInfo] of this.tasks) {
      try {
        taskInfo.task.stop();
        logger.info('定时任务已停止', { name });
      } catch (error) {
        logger.error('停止定时任务失败', { 
          name, 
          error: error.message 
        });
      }
    }
    
    this.isRunning = false;
    logger.info('所有定时任务停止完成');
  }
  
  /**
   * 获取任务状态
   * @param {string} name - 任务名称
   * @returns {object|null} 任务状态
   */
  getTaskStatus(name) {
    const taskInfo = this.tasks.get(name);
    if (!taskInfo) {
      return null;
    }
    
    return {
      name,
      cronExpression: taskInfo.cronExpression,
      createdAt: taskInfo.createdAt,
      lastRun: taskInfo.lastRun,
      runCount: taskInfo.runCount,
      isRunning: taskInfo.task.running || false
    };
  }
  
  /**
   * 获取所有任务状态
   * @returns {Array} 所有任务状态
   */
  getAllTaskStatus() {
    const statuses = [];
    
    for (const name of this.tasks.keys()) {
      statuses.push(this.getTaskStatus(name));
    }
    
    return statuses;
  }
  
  /**
   * 添加每日爬取任务
   * @param {string} crawlerName - 爬虫名称
   * @param {Function} crawlFunction - 爬取函数
   * @param {string} cronExpression - 可选的cron表达式
   * @returns {boolean} 是否添加成功
   */
  addDailyCrawlTask(crawlerName, crawlFunction, cronExpression = null) {
    const taskName = `daily_crawl_${crawlerName}`;
    const cron = cronExpression || this.defaultCron;
    
    return this.addTask(taskName, cron, async () => {
      logger.info('开始每日爬取任务', { crawlerName });
      
      try {
        await crawlFunction();
        logger.info('每日爬取任务完成', { crawlerName });
      } catch (error) {
        logger.error('每日爬取任务失败', { 
          crawlerName, 
          error: error.message 
        });
        throw error; // 重新抛出错误以便上层处理
      }
    });
  }
  
  /**
   * 添加数据清理任务
   * @param {string} crawlerName - 爬虫名称
   * @param {Function} cleanupFunction - 清理函数
   * @param {string} cronExpression - 可选的cron表达式，默认每周日凌晨3点
   * @returns {boolean} 是否添加成功
   */
  addCleanupTask(crawlerName, cleanupFunction, cronExpression = '0 3 * * 0') {
    const taskName = `cleanup_${crawlerName}`;
    
    return this.addTask(taskName, cronExpression, async () => {
      logger.info('开始数据清理任务', { crawlerName });
      
      try {
        await cleanupFunction();
        logger.info('数据清理任务完成', { crawlerName });
      } catch (error) {
        logger.error('数据清理任务失败', { 
          crawlerName, 
          error: error.message 
        });
        throw error;
      }
    });
  }
  
  /**
   * 获取服务状态
   * @returns {object} 服务状态
   */
  getServiceStatus() {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.size,
      defaultCron: this.defaultCron,
      activeTasks: this.getAllTaskStatus().filter(task => task.isRunning).length
    };
  }
  
  /**
   * 销毁调度服务
   */
  destroy() {
    logger.info('销毁调度服务');
    
    // 停止所有任务
    this.stopAll();
    
    // 清理所有任务
    for (const [name, taskInfo] of this.tasks) {
      try {
        // node-cron任务对象没有destroy方法，只需要stop即可
        if (taskInfo.task && typeof taskInfo.task.stop === 'function') {
          taskInfo.task.stop();
        }
      } catch (error) {
        logger.error('销毁任务失败', { name, error: error.message });
      }
    }
    
    this.tasks.clear();
    this.isRunning = false;
    
    logger.info('调度服务已销毁');
  }
}

module.exports = ScheduleService; 