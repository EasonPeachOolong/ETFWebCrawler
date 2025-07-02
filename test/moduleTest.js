#!/usr/bin/env node

/**
 * 模块测试脚本
 * 测试各个核心模块的基础功能
 */

// 测试颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

class ModuleTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.testResults = [];
  }
  
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    switch(type) {
      case 'success':
        console.log(`${colors.green}[${timestamp}] ✅ ${message}${colors.reset}`);
        this.passed++;
        break;
      case 'error':
        console.log(`${colors.red}[${timestamp}] ❌ ${message}${colors.reset}`);
        this.failed++;
        break;
      default:
        console.log(`${colors.blue}[${timestamp}] ${message}${colors.reset}`);
    }
  }
  
  async test(testName, testFunction) {
    try {
      console.log(`\n${colors.yellow}🧪 测试: ${testName}${colors.reset}`);
      await testFunction();
      this.log(`${testName} - 通过`, 'success');
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.log(`${testName} - 失败: ${error.message}`, 'error');
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }
  
  async runAllTests() {
    console.log(`${colors.blue}🚀 开始模块测试...${colors.reset}\n`);
    
    // 测试1: 配置模块
    await this.test('配置模块加载', async () => {
      const config = require('../src/config');
      const dataPath = config.get('storage.dataPath');
      if (!dataPath) throw new Error('配置读取失败');
      
      const allConfig = config.getAll();
      if (!allConfig || typeof allConfig !== 'object') {
        throw new Error('获取所有配置失败');
      }
      console.log('  - 数据路径:', dataPath);
      console.log('  - 配置项数量:', Object.keys(allConfig).length);
    });
    
    // 测试2: 日志模块
    await this.test('日志模块功能', async () => {
      const logger = require('../src/utils/logger');
      logger.info('模块测试 - 信息日志');
      logger.warn('模块测试 - 警告日志');
      
      const childLogger = logger.createChildLogger('test-module');
      childLogger.debug('模块测试 - 子日志器');
      console.log('  - 日志输出正常');
    });
    
    // 测试3: 限速器
    await this.test('限速器功能', async () => {
      const RateLimiter = require('../src/utils/rateLimiter');
      const limiter = new RateLimiter();
      
      const delay = limiter.getRandomDelay();
      if (delay < 1000 || delay > 3000) {
        throw new Error(`延迟时间异常: ${delay}ms`);
      }
      
      // 测试睡眠功能
      const start = Date.now();
      await limiter.sleep(100);
      const elapsed = Date.now() - start;
      if (elapsed < 95) {
        throw new Error('睡眠时间过短');
      }
      
      console.log('  - 随机延迟:', delay + 'ms');
      console.log('  - 睡眠测试:', elapsed + 'ms');
    });
    
    // 测试4: User-Agent管理器
    await this.test('UserAgent管理器', async () => {
      const UserAgentManager = require('../src/utils/userAgentManager');
      const uaManager = new UserAgentManager();
      
      const randomUA = uaManager.getRandomUserAgent();
      const mobileUA = uaManager.getMobileUserAgent();
      const desktopUA = uaManager.getDesktopUserAgent();
      
      if (!randomUA || randomUA.length === 0) {
        throw new Error('随机UserAgent生成失败');
      }
      if (!mobileUA.includes('Mobile') && !mobileUA.includes('iPhone') && !mobileUA.includes('Android')) {
        throw new Error('移动端UserAgent识别失败');
      }
      
      console.log('  - 随机UA:', randomUA.substring(0, 50) + '...');
      console.log('  - 移动UA类型检测: 通过');
    });
    
    // 测试5: 存储服务
    await this.test('存储服务基础功能', async () => {
      const StorageService = require('../src/services/storageService');
      const storage = new StorageService();
      
      // 测试历史数据检查
      const hasData = await storage.hasHistoricalData('test-module');
      if (typeof hasData !== 'boolean') {
        throw new Error('历史数据检查返回类型异常');
      }
      
      // 测试数据保存和读取
      const testData = [
        { id: 1, title: '测试数据1', timestamp: Date.now() },
        { id: 2, title: '测试数据2', timestamp: Date.now() }
      ];
      
      const saveResult = await storage.saveData('test-module', testData, 'unit-test');
      if (!saveResult) {
        throw new Error('数据保存失败');
      }
      
      const loadedData = await storage.loadData('test-module', 'unit-test');
      if (!Array.isArray(loadedData) || loadedData.length < 2) {
        throw new Error('数据读取失败或数据不完整');
      }
      
      console.log('  - 历史数据存在:', hasData);
      console.log('  - 测试数据保存/读取: 成功');
    });
    
    // 测试6: 调度服务
    await this.test('调度服务功能', async () => {
      const ScheduleService = require('../src/services/scheduleService');
      const scheduler = new ScheduleService();
      
      // 测试任务添加
      let testExecuted = false;
      const taskAdded = scheduler.addTask('test-task', '*/10 * * * * *', () => {
        testExecuted = true;
      });
      
      if (!taskAdded) {
        throw new Error('任务添加失败');
      }
      
      // 测试任务状态
      const taskStatus = scheduler.getTaskStatus('test-task');
      if (!taskStatus || taskStatus.name !== 'test-task') {
        throw new Error('任务状态查询失败');
      }
      
      // 测试手动执行
      await scheduler.runTask('test-task');
      if (!testExecuted) {
        throw new Error('任务手动执行失败');
      }
      
      // 清理任务
      scheduler.removeTask('test-task');
      
      console.log('  - 任务添加/执行/清理: 成功');
    });
    
    // 测试7: 请求服务
    await this.test('请求服务初始化', async () => {
      const RequestService = require('../src/services/requestService');
      const requestService = new RequestService();
      
      const stats = requestService.getStats();
      if (!stats || typeof stats !== 'object') {
        throw new Error('请求统计获取失败');
      }
      
      console.log('  - 请求服务初始化: 成功');
      console.log('  - 统计数据获取: 成功');
    });
    
    // 测试8: 爬虫基类
    await this.test('爬虫基类功能', async () => {
      const BaseCrawler = require('../src/core/baseCrawler');
      
      // 测试抽象类保护
      let abstractError = false;
      try {
        new BaseCrawler('test', null, null);
      } catch (error) {
        abstractError = error.message.includes('abstract');
      }
      
      if (!abstractError) {
        throw new Error('抽象类保护机制失效');
      }
      
      // 测试继承
      class TestCrawler extends BaseCrawler {
        async crawlHistoricalData() { return []; }
        async crawlDailyData() { return []; }
        async parsePage() { return []; }
      }
      
      const crawler = new TestCrawler('test-crawler', null, null);
      if (crawler.name !== 'test-crawler') {
        throw new Error('爬虫名称设置失败');
      }
      
      const stats = crawler.getStats();
      if (!stats || typeof stats !== 'object') {
        throw new Error('爬虫统计获取失败');
      }
      
      console.log('  - 抽象类保护: 正常');
      console.log('  - 继承机制: 正常');
    });
    
    // 测试9: 爬虫管理器
    await this.test('爬虫管理器功能', async () => {
      const CrawlerManager = require('../src/core/crawlerManager');
      const manager = new CrawlerManager();
      
      const initialized = await manager.initialize();
      if (!initialized) {
        throw new Error('管理器初始化失败');
      }
      
      const status = manager.getManagerStatus();
      if (!status || typeof status !== 'object') {
        throw new Error('管理器状态获取失败');
      }
      
      await manager.destroy();
      
      console.log('  - 管理器初始化: 成功');
      console.log('  - 状态获取: 成功');
      console.log('  - 资源清理: 成功');
    });
    
    // 打印测试结果
    this.printResults();
  }
  
  printResults() {
    const total = this.passed + this.failed;
    const successRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`\n${colors.blue}=============== 测试结果 ===============${colors.reset}`);
    console.log(`总测试数: ${total}`);
    console.log(`${colors.green}通过: ${this.passed}${colors.reset}`);
    console.log(`${colors.red}失败: ${this.failed}${colors.reset}`);
    console.log(`成功率: ${successRate}%`);
    
    if (this.failed === 0) {
      console.log(`${colors.green}\n🎉 所有模块测试通过！${colors.reset}`);
      console.log(`${colors.green}✅ 系统各模块功能正常，可以安全启动！${colors.reset}`);
    } else {
      console.log(`${colors.yellow}\n⚠️ 有 ${this.failed} 个测试失败，建议检查以下模块:${colors.reset}`);
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`${colors.red}  - ${r.name}: ${r.error}${colors.reset}`);
        });
    }
    console.log(`${colors.blue}=====================================${colors.reset}`);
  }
}

// 运行测试
if (require.main === module) {
  const tester = new ModuleTester();
  tester.runAllTests().catch(error => {
    console.error(`${colors.red}测试运行异常: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = ModuleTester;
