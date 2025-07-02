/**
 * 基本使用示例
 * 展示如何使用爬虫系统的基本功能
 */

const CrawlerManager = require('../src/core/crawlerManager');
const ExampleCrawler1 = require('../src/crawlers/exampleCrawler1');

async function basicExample() {
  console.log('=== 爬虫系统基本使用示例 ===\n');
  
  // 1. 创建爬虫管理器
  const manager = new CrawlerManager();
  
  try {
    // 2. 初始化管理器
    console.log('正在初始化爬虫管理器...');
    const initialized = await manager.initialize();
    
    if (!initialized) {
      throw new Error('管理器初始化失败');
    }
    console.log('✅ 管理器初始化成功\n');
    
    // 3. 创建并注册爬虫
    console.log('正在注册爬虫...');
    const crawler = new ExampleCrawler1();
    const registered = manager.registerCrawler(crawler);
    
    if (!registered) {
      throw new Error('爬虫注册失败');
    }
    console.log('✅ 爬虫注册成功\n');
    
    // 4. 查看管理器状态
    console.log('=== 管理器状态 ===');
    const status = manager.getManagerStatus();
    console.log('已注册爬虫数量:', status.crawlerCount);
    console.log('爬虫列表:', manager.getCrawlerNames());
    console.log('');
    
    // 5. 运行单个爬虫
    console.log('=== 运行单个爬虫 ===');
    console.log('开始运行爬虫: example1');
    const runResult = await manager.runCrawler('example1', false);
    
    if (runResult) {
      console.log('✅ 爬虫运行成功');
      
      // 查看爬虫统计
      const crawlerStats = crawler.getStats();
      console.log('爬虫统计:', crawlerStats);
    } else {
      console.log('❌ 爬虫运行失败');
    }
    console.log('');
    
    // 6. 获取详细状态
    console.log('=== 详细状态信息 ===');
    const detailedStatus = await manager.getDetailedStatus();
    console.log('系统详细状态:', JSON.stringify(detailedStatus, null, 2));
    console.log('');
    
    // 7. 清理资源
    console.log('正在清理资源...');
    await manager.destroy();
    console.log('✅ 资源清理完成');
    
  } catch (error) {
    console.error('❌ 示例运行失败:', error.message);
    
    // 确保清理资源
    try {
      await manager.destroy();
    } catch (cleanupError) {
      console.error('清理资源时出错:', cleanupError.message);
    }
  }
}

async function scheduleExample() {
  console.log('\n=== 定时任务示例 ===\n');
  
  const manager = new CrawlerManager();
  
  try {
    // 初始化
    await manager.initialize();
    
    // 注册爬虫
    const crawler = new ExampleCrawler1();
    manager.registerCrawler(crawler);
    
    // 设置定时任务
    console.log('设置定时任务...');
    const scheduleSuccess = manager.setupSchedule('example1', '*/30 * * * * *'); // 每30秒执行一次（测试用）
    
    if (scheduleSuccess) {
      console.log('✅ 定时任务设置成功');
      
      // 启动定时任务
      console.log('启动定时任务...');
      manager.startSchedule();
      
      // 运行一段时间后停止
      console.log('定时任务将运行60秒...');
      setTimeout(async () => {
        console.log('停止定时任务...');
        manager.stopSchedule();
        
        // 获取任务状态
        const taskStatus = manager.scheduleService.getAllTaskStatus();
        console.log('任务状态:', taskStatus);
        
        await manager.destroy();
        console.log('✅ 定时任务示例完成');
      }, 60000);
      
    } else {
      console.log('❌ 定时任务设置失败');
      await manager.destroy();
    }
    
  } catch (error) {
    console.error('❌ 定时任务示例失败:', error.message);
    await manager.destroy();
  }
}

async function storageExample() {
  console.log('\n=== 存储服务示例 ===\n');
  
  const StorageService = require('../src/services/storageService');
  const storage = new StorageService();
  
  try {
    // 测试数据
    const testData = [
      { id: 1, title: '测试文章1', url: 'http://example.com/1' },
      { id: 2, title: '测试文章2', url: 'http://example.com/2' },
      { id: 3, title: '测试文章3', url: 'http://example.com/3' }
    ];
    
    const crawlerName = 'test-storage';
    
    // 1. 检查历史数据
    console.log('检查历史数据...');
    const hasData = await storage.hasHistoricalData(crawlerName);
    console.log('是否有历史数据:', hasData);
    
    // 2. 保存数据
    console.log('保存测试数据...');
    const saveSuccess = await storage.saveData(crawlerName, testData, 'test');
    console.log('保存结果:', saveSuccess);
    
    // 3. 读取数据
    console.log('读取数据...');
    const loadedData = await storage.loadData(crawlerName, 'test');
    console.log('读取到的数据数量:', loadedData.length);
    console.log('数据内容:', loadedData);
    
    // 4. 获取存储统计
    console.log('获取存储统计...');
    const stats = await storage.getStats(crawlerName);
    console.log('存储统计:', stats);
    
    console.log('✅ 存储服务示例完成');
    
  } catch (error) {
    console.error('❌ 存储服务示例失败:', error.message);
  }
}

// 运行示例
async function runExamples() {
  try {
    // 基本使用示例
    await basicExample();
    
    // 存储服务示例
    await storageExample();
    
    // 定时任务示例（注释掉，因为会运行较长时间）
    // await scheduleExample();
    
  } catch (error) {
    console.error('运行示例时出错:', error.message);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runExamples();
}

module.exports = {
  basicExample,
  scheduleExample,
  storageExample
}; 