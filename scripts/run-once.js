#!/usr/bin/env node

/**
 * ETF数据单次爬取脚本
 * 专门用于系统级cron调用
 * 
 * 使用方法:
 * node scripts/run-once.js
 * 
 * 系统cron配置示例:
 * 0 9 * * * cd /path/to/Data_WebcCrawl && node scripts/run-once.js >> logs/cron.log 2>&1
 */

const path = require('path');
const fs = require('fs-extra');

// 切换到项目根目录
process.chdir(path.join(__dirname, '..'));

const { CrawlerManager } = require('./src/core/crawlerManager');
const FarsideCrawler = require('./src/crawlers/farsideCrawler');
const logger = require('./src/utils/logger');

/**
 * 主执行函数
 */
async function main() {
  const startTime = Date.now();
  
  console.log(`🕐 开始执行ETF数据爬取任务: ${new Date().toISOString()}`);
  console.log('================================');
  
  let manager = null;
  
  try {
    // 创建锁文件，防止重复执行
    const lockFile = './logs/crawl.lock';
    
    if (await fs.pathExists(lockFile)) {
      const lockTime = await fs.readFile(lockFile, 'utf8');
      const lockAge = Date.now() - parseInt(lockTime);
      
      // 如果锁文件超过2小时，认为是僵尸锁，删除它
      if (lockAge > 2 * 60 * 60 * 1000) {
        console.log('⚠️  检测到僵尸锁文件，正在清理...');
        await fs.remove(lockFile);
      } else {
        console.log('⏸️  另一个爬取任务正在运行，跳过本次执行');
        process.exit(0);
      }
    }
    
    // 创建锁文件
    await fs.writeFile(lockFile, Date.now().toString());
    
    // 初始化爬虫管理器
    manager = new CrawlerManager();
    await manager.initialize();
    
    // 注册Farside爬虫
    const farsideCrawler = new FarsideCrawler(
      manager.requestService, 
      manager.storageService
    );
    
    manager.registerCrawler(farsideCrawler);
    
    console.log('📡 开始爬取ETF数据...');
    
    // 执行爬取
    const results = await manager.runCrawler('FarsideCrawler');
    
    // 分析结果
    if (results && results.success) {
      console.log('✅ 爬取任务成功完成');
      
      // 显示统计信息
      const stats = manager.getManagerStatus();
      console.log(`📊 爬虫状态: ${stats.crawlers.length} 个爬虫`);
      console.log(`🌐 请求统计: ${stats.request.totalRequests} 个请求`);
      
      // 检查数据文件
      const bitcoinData = await fs.pathExists('./data/bitcoin_etf_data');
      const ethereumData = await fs.pathExists('./data/ethereum_etf_data');
      
      console.log(`📁 Bitcoin数据: ${bitcoinData ? '✅' : '❌'}`);
      console.log(`📁 Ethereum数据: ${ethereumData ? '✅' : '❌'}`);
      
    } else {
      console.log('❌ 爬取任务失败');
      if (results && results.error) {
        console.log(`错误信息: ${results.error}`);
      }
      process.exit(1);
    }
    
    // 清理锁文件
    await fs.remove(lockFile);
    
  } catch (error) {
    console.error('❌ 执行过程中发生异常:', error.message);
    console.error(error.stack);
    
    // 记录错误日志
    logger.error('单次爬取任务异常', { 
      error: error.message,
      stack: error.stack 
    });
    
    // 清理锁文件
    try {
      await fs.remove('./logs/crawl.lock');
    } catch (cleanupError) {
      console.error('清理锁文件失败:', cleanupError.message);
    }
    
    process.exit(1);
    
  } finally {
    // 清理资源
    if (manager) {
      try {
        await manager.destroy();
      } catch (destroyError) {
        console.error('清理管理器失败:', destroyError.message);
      }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`🎯 任务完成，耗时: ${duration}秒`);
    console.log(`🕐 结束时间: ${new Date().toISOString()}`);
  }
}

// 运行主程序
main().catch((error) => {
  console.error('💥 程序启动失败:', error.message);
  process.exit(1);
}); 