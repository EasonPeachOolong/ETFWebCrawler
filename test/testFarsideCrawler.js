const FarsideCrawler = require('../src/crawlers/farsideCrawler');
const RequestService = require('../src/services/requestService');
const StorageService = require('../src/services/storageService');
const logger = require('../src/utils/logger');

/**
 * 测试Farside ETF爬虫
 */
async function testFarsideCrawler() {
  logger.info('开始测试Farside ETF爬虫');
  
  try {
    // 初始化服务
    const requestService = new RequestService();
    const storageService = new StorageService();
    
    // 创建爬虫实例
    const crawler = new FarsideCrawler(requestService, storageService);
    
    console.log('🚀 正在测试Farside ETF爬虫...\n');
    
    // 开始爬取
    const results = await crawler.crawl();
    
    console.log('📊 爬取结果汇总:');
    console.log('================');
    
    for (const [key, result] of Object.entries(results)) {
      const siteName = key === 'bitcoin' ? 'Bitcoin ETF Flow' : 'Ethereum ETF Flow';
      console.log(`\n${siteName}:`);
      
      if (result.success) {
        console.log(`✅ 成功`);
        console.log(`   - 网页标题: ${result.title}`);
        console.log(`   - 表格数量: ${result.tableData.length}`);
        console.log(`   - 数据时间: ${result.timestamp}`);
        
        // 显示表格详情
        result.tableData.forEach((table, index) => {
          console.log(`   - 表格 ${index + 1}: ${table.headers.length} 列 × ${table.rows.length} 行`);
          if (table.headers.length > 0) {
            console.log(`     表头: ${table.headers.slice(0, 3).join(', ')}${table.headers.length > 3 ? '...' : ''}`);
          }
        });
      } else {
        console.log(`❌ 失败: ${result.error}`);
      }
    }
    
    // 检查保存的数据
    console.log('\n💾 检查保存的数据:');
    console.log('================');
    
    try {
      const bitcoinData = await storageService.loadData('bitcoin_etf_data');
      console.log(`Bitcoin ETF 数据: ${bitcoinData.length} 条记录`);
    } catch (error) {
      console.log(`Bitcoin ETF 数据: 未找到 (${error.message})`);
    }
    
    try {
      const ethereumData = await storageService.loadData('ethereum_etf_data');
      console.log(`Ethereum ETF 数据: ${ethereumData.length} 条记录`);
    } catch (error) {
      console.log(`Ethereum ETF 数据: 未找到 (${error.message})`);
    }
    
    // 关闭浏览器
    await requestService.closeBrowser();
    
    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    logger.error('测试Farside爬虫失败', { error: error.message });
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testFarsideCrawler().catch(console.error); 