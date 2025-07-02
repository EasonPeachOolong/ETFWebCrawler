const FarsideCrawler = require('../src/crawlers/farsideCrawler');  
const RequestService = require('../src/services/requestService');
const StorageService = require('../src/services/storageService');
const ScheduleService = require('../src/services/scheduleService');
const logger = require('../src/utils/logger');

/**
 * 验证所有修复是否生效
 */
async function verifyFixes() {
  console.log('🔧 开始验证修复效果...\n');
  
  const issues = [];
  
  try {
    // 1. 验证FarsideCrawler是否实现了必需方法
    console.log('1️⃣ 验证FarsideCrawler方法实现');
    console.log('================================');
    
    const requestService = new RequestService();
    const storageService = new StorageService();
    const crawler = new FarsideCrawler(requestService, storageService);
    
    // 检查必需方法是否存在
    const requiredMethods = ['crawlHistoricalData', 'crawlIncrementalData'];
    for (const method of requiredMethods) {
      if (typeof crawler[method] === 'function') {
        console.log(`✅ ${method} 方法已实现`);
      } else {
        console.log(`❌ ${method} 方法缺失`);
        issues.push(`FarsideCrawler缺少${method}方法`);
      }
    }
    
    // 2. 验证数据统计功能
    console.log('\n2️⃣ 验证数据统计功能');
    console.log('================');
    
    try {
      const bitcoinData = await storageService.loadData('bitcoin_etf_data');
      if (bitcoinData.length > 0) {
        const tableData = bitcoinData[0];
        console.log(`✅ Bitcoin ETF数据加载成功: ${tableData.rows?.length || 0} 行数据`);
        
        // 验证日期解析
        if (tableData.rows && tableData.rows.length > 0) {
          let validDateFound = false;
          for (let i = tableData.rows.length - 1; i >= 0; i--) {
            const dateStr = tableData.rows[i][0];
            if (dateStr && dateStr !== 'Date' && dateStr !== 'Minimum' && dateStr.includes('2024')) {
              console.log(`✅ 找到有效日期: ${dateStr}`);
              validDateFound = true;
              break;
            }
          }
          if (!validDateFound) {
            console.log('⚠️ 未找到有效的日期数据');
            issues.push('日期数据解析问题');
          }
        }
      } else {
        console.log('⚠️ 暂无Bitcoin ETF数据');
      }
    } catch (error) {
      console.log(`❌ 数据统计验证失败: ${error.message}`);
      issues.push(`数据统计错误: ${error.message}`);
    }
    
    // 3. 验证定时任务服务
    console.log('\n3️⃣ 验证定时任务服务');
    console.log('================');
    
    const scheduleService = new ScheduleService();
    
    try {
      // 添加测试任务
      const added = scheduleService.addTask('test_task', '0 0 * * *', () => {
        logger.info('测试任务执行');
      });
      
      if (added) {
        console.log('✅ 添加定时任务成功');
        
        // 测试销毁功能
        scheduleService.destroy();
        console.log('✅ 定时任务服务销毁成功');
      } else {
        console.log('❌ 添加定时任务失败');
        issues.push('定时任务添加失败');
      }
    } catch (error) {
      console.log(`❌ 定时任务验证失败: ${error.message}`);
      issues.push(`定时任务错误: ${error.message}`);
    }
    
    // 4. 验证RequestService优化
    console.log('\n4️⃣ 验证RequestService优化');
    console.log('=======================');
    
    try {
      // 检查浏览器初始化能力
      await requestService.initBrowser();
      console.log('✅ Puppeteer浏览器初始化成功');
      
      await requestService.closeBrowser();
      console.log('✅ 浏览器关闭成功');
    } catch (error) {
      console.log(`❌ RequestService验证失败: ${error.message}`);
      issues.push(`RequestService错误: ${error.message}`);
    }
    
    // 汇总结果
    console.log('\n📊 修复验证结果');
    console.log('==============');
    
    if (issues.length === 0) {
      console.log('🎉 所有修复验证成功！');
      console.log('✅ FarsideCrawler方法实现完整');
      console.log('✅ 数据统计功能正常');
      console.log('✅ 定时任务服务稳定');
      console.log('✅ RequestService优化生效');
    } else {
      console.log(`⚠️ 发现 ${issues.length} 个问题:`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生异常:', error.message);
  }
}

// 运行验证
verifyFixes().catch(console.error); 