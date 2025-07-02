const CrawlerManager = require('./src/core/crawlerManager');
const FarsideCrawler = require('./src/crawlers/farsideCrawler');
const logger = require('./src/utils/logger');
const config = require('./src/config');
const DataParser = require('./src/utils/dataParser');

/**
 * Web Crawler应用程序主入口
 */
class WebCrawlerApp {
  constructor() {
    this.crawlerManager = new CrawlerManager();
    this.isRunning = false;
  }

  /**
   * 初始化应用程序
   */
  async initialize() {
    try {
      logger.info('初始化Web Crawler应用程序');
      
      // 初始化爬虫管理器
      const initialized = await this.crawlerManager.initialize();
      if (!initialized) {
        throw new Error('爬虫管理器初始化失败');
      }

      // 注册FarsideCrawler
      const farsideCrawler = new FarsideCrawler();
      const registered = this.crawlerManager.registerCrawler(farsideCrawler);
      if (!registered) {
        throw new Error('FarsideCrawler注册失败');
      }

      logger.info('Web Crawler应用程序初始化完成');
      return true;
    } catch (error) {
      logger.error('应用程序初始化失败', { error: error.message });
      return false;
    }
  }

  /**
   * 启动应用程序
   */
  async start() {
    if (!await this.initialize()) {
      process.exit(1);
    }

    this.isRunning = true;
    logger.info('Web Crawler应用程序启动成功');

    // 显示欢迎信息
    this.displayWelcomeMessage();

    // 检查历史数据并启动爬虫
    await this.startCrawling();

    // 设置定时任务
    this.setupScheduledTasks();

    // 设置优雅关闭
    this.setupGracefulShutdown();
  }

  /**
   * 显示欢迎信息
   */
  displayWelcomeMessage() {
    console.log('\n🚀 Web Crawler 系统已启动');
    console.log('=====================================');
    console.log('📊 支持的数据源:');
    console.log('   • Bitcoin ETF Flow (farside.co.uk)');
    console.log('   • Ethereum ETF Flow (farside.co.uk)');
    console.log('📁 数据存储路径: ./data/');
    console.log('📋 日志文件: ./logs/');
    console.log('⏰ 定时任务: 每日 09:00 执行');
    console.log('=====================================\n');
  }

  /**
   * 开始爬取数据
   */
  async startCrawling() {
    try {
      logger.info('开始检查历史数据并启动爬虫');
      
      // 检查是否有历史数据
      const hasHistoricalData = await this.crawlerManager.storageService.hasHistoricalData('FarsideCrawler');
      
      if (!hasHistoricalData) {
        logger.info('未找到历史数据，开始全量爬取');
        console.log('📦 开始获取历史数据...');
        
        // 强制历史数据爬取
        await this.crawlerManager.runCrawler('FarsideCrawler', true);
      } else {
        logger.info('发现历史数据，执行增量爬取');
        console.log('🔄 执行增量数据更新...');
        
        // 增量数据爬取
        await this.crawlerManager.runCrawler('FarsideCrawler', false);
      }
      
      console.log('✅ 数据爬取完成！');
      
      // 显示数据统计
      await this.displayDataStatistics();
      
    } catch (error) {
      logger.error('爬取数据失败', { error: error.message });
      console.error('❌ 数据爬取失败:', error.message);
    }
  }

  /**
   * 显示数据统计
   */
  async displayDataStatistics() {
    try {
      console.log('\n📊 数据统计:');
      console.log('===========');
      
             // Bitcoin ETF数据统计
       const bitcoinData = await this.crawlerManager.storageService.loadData('bitcoin_etf_data');
       if (bitcoinData.length > 0) {
         const tableData = bitcoinData[0];
         console.log(`📈 Bitcoin ETF: ${tableData.headers?.length || 0} 个基金, ${tableData.rows?.length || 0} 天数据`);
         
         if (tableData.rows && tableData.rows.length > 0) {
           // 使用智能数据解析器找到最新日期
           const latestInfo = DataParser.findLatestDate(tableData.rows);
           if (latestInfo) {
             console.log(`   最新数据: ${latestInfo.dateString} (${latestInfo.formattedDate})`);
             console.log(`   定位方法: ${latestInfo.method === 'before_total' ? 'Total行前定位' : '反向扫描'}`);
             
             // 获取日期范围信息
             const dateRange = DataParser.getDateRange(tableData.rows);
             if (dateRange) {
               console.log(`   数据范围: ${dateRange.earliest.dateString} → ${dateRange.latest.dateString}`);
               console.log(`   有效天数: ${dateRange.totalDays} 天 (跨度${dateRange.daysBetween}天)`);
             }
           } else {
             console.log(`   ⚠️ 无法解析最新日期`);
           }
         }
       } else {
         console.log('📈 Bitcoin ETF: 暂无数据');
       }
      
             // Ethereum ETF数据统计
       const ethereumData = await this.crawlerManager.storageService.loadData('ethereum_etf_data');
       if (ethereumData.length > 0) {
         const tableData = ethereumData[0];
         console.log(`📈 Ethereum ETF: ${tableData.headers?.length || 0} 个基金, ${tableData.rows?.length || 0} 天数据`);
         
         if (tableData.rows && tableData.rows.length > 0) {
           const latestInfo = DataParser.findLatestDate(tableData.rows);
           if (latestInfo) {
             console.log(`   最新数据: ${latestInfo.dateString} (${latestInfo.formattedDate})`);
             console.log(`   定位方法: ${latestInfo.method === 'before_total' ? 'Total行前定位' : '反向扫描'}`);
           } else {
             console.log(`   ⚠️ 无法解析最新日期`);
           }
         }
       } else {
         console.log('📈 Ethereum ETF: 暂无数据');
       }
      
      console.log('');
      
    } catch (error) {
      logger.error('显示数据统计失败', { error: error.message });
    }
  }

  /**
   * 设置定时任务
   */
  setupScheduledTasks() {
    try {
      // 设置每日定时爬取任务 (上午9点)
      this.crawlerManager.setupSchedule('FarsideCrawler', '0 9 * * *');
      
      // 启动定时任务
      this.crawlerManager.startSchedule();
      
      logger.info('定时任务设置完成', { schedule: '每日 09:00' });
      console.log('⏰ 定时任务已设置: 每日 09:00 自动更新数据');
      
    } catch (error) {
      logger.error('设置定时任务失败', { error: error.message });
    }
  }

  /**
   * 设置优雅关闭
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`收到${signal}信号，开始优雅关闭`);
      console.log(`\n📴 收到${signal}信号，正在关闭系统...`);
      
      this.isRunning = false;
      
      try {
        // 停止定时任务
        this.crawlerManager.stopSchedule();
        
        // 停止所有爬虫
        await this.crawlerManager.stopAllCrawlers();
        
        // 销毁管理器
        await this.crawlerManager.destroy();
        
        logger.info('系统优雅关闭完成');
        console.log('✅ 系统已安全关闭');
        
        process.exit(0);
      } catch (error) {
        logger.error('优雅关闭失败', { error: error.message });
        console.error('❌ 关闭系统时发生错误:', error.message);
        process.exit(1);
      }
    };

    // 监听关闭信号
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
    
    // 监听未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常', { error: error.message, stack: error.stack });
      console.error('❌ 系统发生未捕获的异常:', error.message);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', { reason, promise });
      console.error('❌ 发生未处理的Promise拒绝:', reason);
      process.exit(1);
    });
  }

  /**
   * 手动触发数据爬取
   */
  async manualCrawl(forceHistorical = false) {
    if (!this.isRunning) {
      console.log('❌ 系统未运行');
      return false;
    }

    try {
      console.log('🔄 手动触发数据爬取...');
      const success = await this.crawlerManager.runCrawler('FarsideCrawler', forceHistorical);
      
      if (success) {
        console.log('✅ 手动爬取完成');
        await this.displayDataStatistics();
      } else {
        console.log('❌ 手动爬取失败');
      }
      
      return success;
    } catch (error) {
      logger.error('手动爬取异常', { error: error.message });
      console.error('❌ 手动爬取发生异常:', error.message);
      return false;
    }
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      crawlerManager: this.crawlerManager.getManagerStatus(),
      crawlers: this.crawlerManager.getAllCrawlerStatus()
    };
  }
}

// 创建应用程序实例
const app = new WebCrawlerApp();

// 如果直接运行此文件，启动应用程序
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('应用程序启动失败', { error: error.message });
    console.error('❌ 应用程序启动失败:', error.message);
    process.exit(1);
  });
}

module.exports = app; 