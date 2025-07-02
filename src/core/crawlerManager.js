const logger = require('../utils/logger');
const RequestService = require('../services/requestService');
const StorageService = require('../services/storageService');
const ScheduleService = require('../services/scheduleService');

/**
 * 爬虫管理器
 */
class CrawlerManager {
  constructor() {
    this.crawlers = new Map(); // 存储爬虫实例
    this.requestService = new RequestService();
    this.storageService = new StorageService();
    this.scheduleService = new ScheduleService();
    this.isInitialized = false;
    this.isRunning = false;
    
    this.logger = logger.createChildLogger('CrawlerManager');
  }
  
  /**
   * 初始化管理器
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('爬虫管理器已初始化');
      return true;
    }
    
    try {
      this.logger.info('初始化爬虫管理器');
      
      // 初始化各个服务
      // RequestService 和 StorageService 在构造函数中已初始化
      
      this.isInitialized = true;
      this.logger.info('爬虫管理器初始化完成');
      return true;
    } catch (error) {
      this.logger.error('爬虫管理器初始化失败', { error: error.message });
      return false;
    }
  }
  
  /**
   * 注册爬虫
   * @param {BaseCrawler} crawler - 爬虫实例
   * @returns {boolean} 注册是否成功
   */
  registerCrawler(crawler) {
    try {
      if (!crawler || !crawler.name) {
        throw new Error('无效的爬虫实例');
      }
      
      if (this.crawlers.has(crawler.name)) {
        this.logger.warn('爬虫已存在，将覆盖', { crawlerName: crawler.name });
      }
      
      // 注入服务依赖
      crawler.requestService = this.requestService;
      crawler.storageService = this.storageService;
      
      this.crawlers.set(crawler.name, crawler);
      
      this.logger.info('爬虫注册成功', { crawlerName: crawler.name });
      return true;
    } catch (error) {
      this.logger.error('爬虫注册失败', { 
        crawlerName: crawler?.name,
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 注销爬虫
   * @param {string} crawlerName - 爬虫名称
   * @returns {boolean} 注销是否成功
   */
  unregisterCrawler(crawlerName) {
    try {
      const crawler = this.crawlers.get(crawlerName);
      if (!crawler) {
        this.logger.warn('爬虫不存在', { crawlerName });
        return false;
      }
      
      // 停止爬虫
      if (crawler.isRunning) {
        crawler.stop();
      }
      
      // 清理资源
      crawler.cleanup();
      
      // 从管理器中移除
      this.crawlers.delete(crawlerName);
      
      // 移除相关的定时任务
      this.scheduleService.removeTask(`daily_crawl_${crawlerName}`);
      this.scheduleService.removeTask(`cleanup_${crawlerName}`);
      
      this.logger.info('爬虫注销成功', { crawlerName });
      return true;
    } catch (error) {
      this.logger.error('爬虫注销失败', { crawlerName, error: error.message });
      return false;
    }
  }
  
  /**
   * 获取爬虫实例
   * @param {string} crawlerName - 爬虫名称
   * @returns {BaseCrawler|null} 爬虫实例
   */
  getCrawler(crawlerName) {
    return this.crawlers.get(crawlerName) || null;
  }
  
  /**
   * 获取所有爬虫名称
   * @returns {Array<string>} 爬虫名称数组
   */
  getCrawlerNames() {
    return Array.from(this.crawlers.keys());
  }
  
  /**
   * 运行单个爬虫
   * @param {string} crawlerName - 爬虫名称
   * @param {boolean} forceHistorical - 是否强制爬取历史数据
   * @returns {Promise<boolean>} 运行是否成功
   */
  async runCrawler(crawlerName, forceHistorical = false) {
    try {
      const crawler = this.crawlers.get(crawlerName);
      if (!crawler) {
        this.logger.error('爬虫不存在', { crawlerName });
        return false;
      }
      
      this.logger.info('开始运行爬虫', { crawlerName });
      
      // 初始化爬虫
      const initialized = await crawler.initialize();
      if (!initialized) {
        throw new Error('爬虫初始化失败');
      }
      
      // 运行爬虫
      const success = await crawler.run(forceHistorical);
      
      if (success) {
        this.logger.info('爬虫运行完成', { 
          crawlerName,
          stats: crawler.getStats()
        });
      } else {
        this.logger.error('爬虫运行失败', { crawlerName });
      }
      
      return success;
    } catch (error) {
      this.logger.error('运行爬虫异常', { 
        crawlerName, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 运行所有爬虫
   * @param {boolean} forceHistorical - 是否强制爬取历史数据
   * @param {boolean} parallel - 是否并行运行
   * @returns {Promise<object>} 运行结果
   */
  async runAllCrawlers(forceHistorical = false, parallel = false) {
    if (!this.isInitialized) {
      this.logger.error('爬虫管理器未初始化');
      return { success: false, error: '爬虫管理器未初始化' };
    }
    
    const crawlerNames = Array.from(this.crawlers.keys());
    if (crawlerNames.length === 0) {
      this.logger.warn('没有注册的爬虫');
      return { success: true, results: [] };
    }
    
    this.isRunning = true;
    this.logger.info('开始运行所有爬虫', { 
      crawlerCount: crawlerNames.length,
      parallel,
      forceHistorical
    });
    
    const results = [];
    const startTime = Date.now();
    
    try {
      if (parallel) {
        // 并行运行
        const promises = crawlerNames.map(name => 
          this.runCrawler(name, forceHistorical)
            .then(success => ({ name, success }))
            .catch(error => ({ name, success: false, error: error.message }))
        );
        
        const parallelResults = await Promise.allSettled(promises);
        
        for (const result of parallelResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason.message
            });
          }
        }
      } else {
        // 串行运行
        for (const crawlerName of crawlerNames) {
          try {
            const success = await this.runCrawler(crawlerName, forceHistorical);
            results.push({ name: crawlerName, success });
          } catch (error) {
            results.push({ 
              name: crawlerName, 
              success: false, 
              error: error.message 
            });
          }
        }
      }
      
      const endTime = Date.now();
      const successCount = results.filter(r => r.success).length;
      
      this.logger.info('所有爬虫运行完成', {
        totalCrawlers: crawlerNames.length,
        successCount,
        failedCount: crawlerNames.length - successCount,
        duration: endTime - startTime
      });
      
      return {
        success: true,
        results,
        stats: {
          total: crawlerNames.length,
          success: successCount,
          failed: crawlerNames.length - successCount,
          duration: endTime - startTime
        }
      };
    } catch (error) {
      this.logger.error('运行所有爬虫异常', { error: error.message });
      return {
        success: false,
        error: error.message,
        results
      };
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * 设置定时任务
   * @param {string} crawlerName - 爬虫名称，null表示所有爬虫
   * @param {string} cronExpression - cron表达式，null使用默认
   * @returns {boolean} 设置是否成功
   */
  setupSchedule(crawlerName = null, cronExpression = null) {
    try {
      if (crawlerName) {
        // 为单个爬虫设置定时任务
        const crawler = this.crawlers.get(crawlerName);
        if (!crawler) {
          this.logger.error('爬虫不存在', { crawlerName });
          return false;
        }
        
        // 添加每日爬取任务
        const success = this.scheduleService.addDailyCrawlTask(
          crawlerName,
          () => this.runCrawler(crawlerName),
          cronExpression
        );
        
        if (success) {
          // 添加数据清理任务
          this.scheduleService.addCleanupTask(
            crawlerName,
            () => this.storageService.cleanupOldData(crawlerName)
          );
        }
        
        return success;
      } else {
        // 为所有爬虫设置定时任务
        let allSuccess = true;
        
        for (const name of this.crawlers.keys()) {
          const success = this.setupSchedule(name, cronExpression);
          if (!success) {
            allSuccess = false;
          }
        }
        
        return allSuccess;
      }
    } catch (error) {
      this.logger.error('设置定时任务失败', { 
        crawlerName, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 启动定时任务
   */
  startSchedule() {
    this.logger.info('启动定时任务');
    this.scheduleService.startAll();
  }
  
  /**
   * 停止定时任务
   */
  stopSchedule() {
    this.logger.info('停止定时任务');
    this.scheduleService.stopAll();
  }
  
  /**
   * 获取所有爬虫状态
   * @returns {Array} 爬虫状态数组
   */
  getAllCrawlerStatus() {
    const statuses = [];
    
    for (const [name, crawler] of this.crawlers) {
      statuses.push({
        name,
        status: crawler.getStatus(),
        storage: null // 将在异步方法中填充
      });
    }
    
    return statuses;
  }
  
  /**
   * 获取管理器状态
   * @returns {object} 管理器状态
   */
  getManagerStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      crawlerCount: this.crawlers.size,
      crawlers: this.getAllCrawlerStatus(),
      schedule: this.scheduleService.getServiceStatus(),
      request: this.requestService.getStats()
    };
  }
  
  /**
   * 获取详细状态（包含存储信息）
   * @returns {Promise<object>} 详细状态
   */
  async getDetailedStatus() {
    const basicStatus = this.getManagerStatus();
    
    // 异步获取存储统计
    for (const crawlerStatus of basicStatus.crawlers) {
      try {
        crawlerStatus.storage = await this.storageService.getStats(crawlerStatus.name);
      } catch (error) {
        crawlerStatus.storage = { error: error.message };
      }
    }
    
    return basicStatus;
  }
  
  /**
   * 停止所有爬虫
   */
  stopAllCrawlers() {
    this.logger.info('停止所有爬虫');
    
    for (const [name, crawler] of this.crawlers) {
      if (crawler.isRunning) {
        crawler.stop();
        this.logger.info('已停止爬虫', { crawlerName: name });
      }
    }
    
    this.isRunning = false;
  }
  
  /**
   * 销毁管理器
   */
  async destroy() {
    this.logger.info('销毁爬虫管理器');
    
    // 停止所有爬虫
    this.stopAllCrawlers();
    
    // 停止定时任务
    this.stopSchedule();
    this.scheduleService.destroy();
    
    // 清理所有爬虫
    for (const [name, crawler] of this.crawlers) {
      await crawler.cleanup();
    }
    this.crawlers.clear();
    
    // 销毁服务
    await this.requestService.destroy();
    
    this.isInitialized = false;
    this.logger.info('爬虫管理器已销毁');
  }
}

module.exports = CrawlerManager; 