const FarsideCrawler = require('../src/crawlers/farsideCrawler');
const RequestService = require('../src/services/requestService');
const StorageService = require('../src/services/storageService');
const logger = require('../src/utils/logger');

/**
 * 测试Ethereum ETF数据爬取
 */
async function testEthereumETF() {
  console.log('🧪 测试Ethereum ETF数据爬取');
  console.log('==========================\n');
  
  try {
    // 初始化服务
    const requestService = new RequestService();
    const storageService = new StorageService();
    
    // 创建爬虫实例
    const crawler = new FarsideCrawler(requestService, storageService);
    
    // 只测试Ethereum网站
    console.log('🔄 开始爬取Ethereum ETF数据...');
    const ethereumSite = crawler.sites.ethereum;
    
    const startTime = Date.now();
    const result = await crawler.crawlSiteWithPuppeteer(ethereumSite);
    const endTime = Date.now();
    
    console.log(`\n📊 爬取结果 (耗时: ${(endTime - startTime) / 1000}秒):`);
    console.log('============================');
    
    if (result.success) {
      console.log('✅ 爬取成功！');
      console.log(`🌐 URL: ${result.url}`);
      console.log(`📝 标题: ${result.title}`);
      console.log(`📊 表格数据数量: ${result.tableData.length}`);
      console.log(`🕐 时间戳: ${result.timestamp}`);
      
      if (result.tableData.length > 0) {
        console.log(`\n📋 第一个表格预览:`);
        const firstTable = result.tableData[0];
        console.log(`  表头: ${firstTable.headers.slice(0, 5).join(', ')}${firstTable.headers.length > 5 ? '...' : ''}`);
        console.log(`  行数: ${firstTable.rows.length}`);
        
        if (firstTable.rows.length > 0) {
          console.log(`  第一行: ${firstTable.rows[0].slice(0, 3).join(', ')}${firstTable.rows[0].length > 3 ? '...' : ''}`);
          console.log(`  最后行: ${firstTable.rows[firstTable.rows.length - 1].slice(0, 3).join(', ')}`);
        }
        
        // 测试保存数据
        console.log(`\n💾 保存数据到存储...`);
        await storageService.saveData(ethereumSite.tableName, result.tableData, 'daily');
        console.log('✅ 数据保存成功');
        
        // 验证数据
        const savedData = await storageService.loadData(ethereumSite.tableName, 'daily');
        console.log(`📊 验证保存的数据: ${savedData.length} 个表格`);
      }
      
    } else {
      console.log('❌ 爬取失败');
      console.log(`错误: ${result.error}`);
      console.log(`URL: ${result.url}`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生异常:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n🎯 测试完成！');
}

// 运行测试
testEthereumETF().catch(console.error); 