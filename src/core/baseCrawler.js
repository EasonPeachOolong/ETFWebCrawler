const logger = require('../utils/logger');

/**
 * 抽象爬虫基类
 */
class BaseCrawler {
  constructor(name, requestService, storageService) {
    if (new.target === BaseCrawler) {
      throw new TypeError('Cannot instantiate abstract class BaseCrawler directly');
    }
    
    this.name = name;
    this.requestService = requestService;
    this.storageService = storageService;
    this.logger = logger.createChildLogger(name);
    this.isRunning = false;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRecords: 0,
      lastRun: null,
      startTime: null,
      endTime: null
    };
  }
  
  /**
   * 抽象方法：获取历史数据
   * 子类必须实现此方法
   * @returns {Promise<Array>} 历史数据数组
   */
  async crawlHistoricalData() {
    throw new Error('crawlHistoricalData method must be implemented by subclass');
  }
  
  /**
   * 抽象方法：获取每日新数据
   * 子类必须实现此方法
   * @returns {Promise<Array>} 每日数据数组
   */
  async crawlDailyData() {
    throw new Error('crawlDailyData method must be implemented by subclass');
  }
  
  /**
   * 抽象方法：解析单个页面数据
   * 子类必须实现此方法
   * @param {string} url - 页面URL
   * @param {object} $ - Cheerio对象
   * @returns {Promise<Array>} 解析出的数据数组
   */
  async parsePage(url, $) {
    throw new Error('parsePage method must be implemented by subclass');
  }
  
  /**
   * 初始化爬虫（可选重写）
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    this.logger.info('爬虫初始化中...');
    
    try {
      // 子类可以重写此方法进行特定初始化
      await this.onInitialize();
      
      this.logger.info('爬虫初始化完成');
      return true;
    } catch (error) {
      this.logger.error('爬虫初始化失败', { error: error.message });
      return false;
    }
  }
  
  /**
   * 初始化钩子方法（可选重写）
   */
  async onInitialize() {
    // 子类可以重写此方法
  }
  
  /**
   * 运行爬虫
   * @param {boolean} forceHistorical - 是否强制爬取历史数据
   * @returns {Promise<boolean>} 运行是否成功
   */
  async run(forceHistorical = false) {
    if (this.isRunning) {
      this.logger.warn('爬虫已在运行中');
      return false;
    }
    
    this.isRunning = true;
    this.stats.startTime = new Date();
    this.resetStats();
    
    try {
      this.logger.info('开始运行爬虫');
      
      // 检查是否需要爬取历史数据
      const hasHistoricalData = await this.storageService.hasHistoricalData(this.name);
      
      if (!hasHistoricalData || forceHistorical) {
        this.logger.info('开始爬取历史数据');
        await this.runHistoricalCrawl();
      } else {
        this.logger.info('历史数据已存在，跳过历史数据爬取');
      }
      
      // 爬取每日数据
      this.logger.info('开始爬取每日数据');
      await this.runDailyCrawl();
      
      this.stats.endTime = new Date();
      this.stats.lastRun = new Date();
      
      this.logger.info('爬虫运行完成', {
        duration: this.stats.endTime - this.stats.startTime,
        stats: this.getStats()
      });
      
      return true;
    } catch (error) {
      this.logger.error('爬虫运行失败', { error: error.message, stack: error.stack });
      return false;
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * 运行历史数据爬取
   */
  async runHistoricalCrawl() {
    try {
      const historicalData = await this.crawlHistoricalData();
      
      if (historicalData && historicalData.length > 0) {
        const saved = await this.storageService.saveData(
          this.name, 
          historicalData, 
          'historical'
        );
        
        if (saved) {
          this.stats.totalRecords += historicalData.length;
          this.logger.info('历史数据保存成功', { 
            recordCount: historicalData.length 
          });
        } else {
          throw new Error('历史数据保存失败');
        }
      } else {
        this.logger.warn('未获取到历史数据');
      }
    } catch (error) {
      this.logger.error('历史数据爬取失败', { error: error.message });
      throw error;
    }
  }
  
  /**
   * 运行每日数据爬取
   */
  async runDailyCrawl() {
    try {
      const dailyData = await this.crawlDailyData();
      
      if (dailyData && dailyData.length > 0) {
        const saved = await this.storageService.saveData(
          this.name, 
          dailyData, 
          'daily'
        );
        
        if (saved) {
          this.stats.totalRecords += dailyData.length;
          this.logger.info('每日数据保存成功', { 
            recordCount: dailyData.length 
          });
        } else {
          throw new Error('每日数据保存失败');
        }
      } else {
        this.logger.warn('未获取到每日数据');
      }
    } catch (error) {
      this.logger.error('每日数据爬取失败', { error: error.message });
      throw error;
    }
  }
  
  /**
   * 通用页面请求方法
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {Promise<object>} 请求结果
   */
  async fetchPage(url, options = {}) {
    this.stats.totalRequests++;
    
    try {
      this.logger.debug('请求页面', { url });
      
      const result = await this.requestService.fetchAndParse(url, options);
      
      if (result.success) {
        this.stats.successfulRequests++;
        this.logger.debug('页面请求成功', { url });
      } else {
        this.stats.failedRequests++;
        this.logger.warn('页面请求失败', { url, error: result.error });
      }
      
      return result;
    } catch (error) {
      this.stats.failedRequests++;
      this.logger.error('页面请求异常', { url, error: error.message });
      return {
        success: false,
        error: error.message,
        url
      };
    }
  }
  
  /**
   * 使用Puppeteer请求页面
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {Promise<object>} 请求结果
   */
  async fetchPageWithBrowser(url, options = {}) {
    this.stats.totalRequests++;
    
    try {
      this.logger.debug('使用浏览器请求页面', { url });
      
      const result = await this.requestService.fetchWithPuppeteer(url, options);
      
      if (result.success) {
        this.stats.successfulRequests++;
        this.logger.debug('浏览器页面请求成功', { url });
      } else {
        this.stats.failedRequests++;
        this.logger.warn('浏览器页面请求失败', { url, error: result.error });
      }
      
      return result;
    } catch (error) {
      this.stats.failedRequests++;
      this.logger.error('浏览器页面请求异常', { url, error: error.message });
      return {
        success: false,
        error: error.message,
        url
      };
    }
  }
  
  /**
   * 批量处理URL列表
   * @param {Array} urls - URL数组
   * @param {Function} processFunction - 处理函数
   * @param {number} batchSize - 批次大小
   * @returns {Promise<Array>} 处理结果数组
   */
  async processBatch(urls, processFunction, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      this.logger.debug('处理批次', { 
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(urls.length / batchSize)
      });
      
      const batchPromises = batch.map(url => processFunction(url));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('批处理项目失败', { error: result.reason.message });
        }
      }
      
      // 批次间延迟
      if (i + batchSize < urls.length) {
        await this.delay(1000);
      }
    }
    
    return results.flat().filter(Boolean);
  }
  
  /**
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats.totalRequests = 0;
    this.stats.successfulRequests = 0;
    this.stats.failedRequests = 0;
    this.stats.totalRecords = 0;
  }
  
  /**
   * 获取爬虫统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      isRunning: this.isRunning
    };
  }
  
  /**
   * 获取爬虫状态
   * @returns {object} 爬虫状态
   */
  getStatus() {
    return {
      name: this.name,
      isRunning: this.isRunning,
      stats: this.getStats()
    };
  }
  
  /**
   * 停止爬虫
   */
  stop() {
    if (this.isRunning) {
      this.logger.info('正在停止爬虫...');
      this.isRunning = false;
    }
  }
  
  /**
   * 清理资源
   */
  async cleanup() {
    this.logger.info('清理爬虫资源');
    this.stop();
    // 子类可以重写此方法进行特定清理
    await this.onCleanup();
  }
  
  /**
   * 清理钩子方法（可选重写）
   */
  async onCleanup() {
    // 子类可以重写此方法
  }
}

module.exports = BaseCrawler; 