const RequestService = require('../src/services/requestService');
const logger = require('../src/utils/logger');

/**
 * 专门调试Ethereum ETF网站
 */
async function debugEthereumSite() {
  const requestService = new RequestService();
  const url = 'https://farside.co.uk/ethereum-etf-flow-all-data/';
  
  console.log('🔍 开始调试Ethereum ETF网站...\n');
  
  try {
    // 策略1: 基础Puppeteer请求
    console.log('策略1: 基础Puppeteer请求');
    console.log('=================');
    
    const response1 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'domcontentloaded'
    });
    
    console.log(`状态: ${response1.success ? '成功' : '失败'}`);
    console.log(`标题: ${response1.$ ? response1.$('title').text() : 'N/A'}`);
    console.log(`内容长度: ${response1.data ? response1.data.length : 0}`);
    
    if (response1.$) {
      const tables = response1.$('table').length;
      console.log(`表格数量: ${tables}`);
      console.log(`页面文本片段: ${response1.$('body').text().substring(0, 200)}...`);
    }
    
    await delay(5000);
    
    // 策略2: 长时间等待 + networkidle
    console.log('\n策略2: 长时间等待 + networkidle');
    console.log('============================');
    
    const response2 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'networkidle0',
      evaluate: () => {
        return new Promise((resolve) => {
          console.log('页面加载中，等待10秒...');
          setTimeout(() => {
            resolve();
          }, 10000);
        });
      }
    });
    
    console.log(`状态: ${response2.success ? '成功' : '失败'}`);
    console.log(`标题: ${response2.$ ? response2.$('title').text() : 'N/A'}`);
    console.log(`内容长度: ${response2.data ? response2.data.length : 0}`);
    
    if (response2.$) {
      const tables = response2.$('table').length;
      console.log(`表格数量: ${tables}`);
      
      // 检查是否有特定的ETF相关内容
      const bodyText = response2.$('body').text();
      const hasETF = bodyText.includes('ETF') || bodyText.includes('Flow');
      console.log(`是否包含ETF内容: ${hasETF}`);
      
      if (!hasETF) {
        console.log('页面可能被Cloudflare保护，内容:');
        console.log(bodyText.substring(0, 500));
      }
    }
    
    await delay(5000);
    
    // 策略3: 模拟真实用户行为
    console.log('\n策略3: 模拟真实用户行为');
    console.log('====================');
    
    const response3 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'networkidle2',
      evaluate: () => {
        return new Promise(async (resolve) => {
          // 模拟鼠标移动
          const event = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: Math.random() * window.innerWidth,
            clientY: Math.random() * window.innerHeight
          });
          document.dispatchEvent(event);
          
          // 等待一段时间
          await new Promise(r => setTimeout(r, 3000));
          
          // 检查页面是否已加载ETF数据
          const checkInterval = setInterval(() => {
            const tables = document.querySelectorAll('table');
            const title = document.title;
            
            console.log(`检查中... 标题: ${title}, 表格数: ${tables.length}`);
            
            if (tables.length > 0 && !title.includes('请稍候') && !title.includes('Just a moment')) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 2000);
          
          // 最大等待20秒
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 20000);
        });
      }
    });
    
    console.log(`状态: ${response3.success ? '成功' : '失败'}`);
    console.log(`标题: ${response3.$ ? response3.$('title').text() : 'N/A'}`);
    console.log(`内容长度: ${response3.data ? response3.data.length : 0}`);
    
    if (response3.$) {
      const tables = response3.$('table').length;
      console.log(`表格数量: ${tables}`);
      
      // 检查所有表格
      response3.$('table').each((i, table) => {
        const $table = response3.$(table);
        const headers = [];
        $table.find('tr:first-child th, tr:first-child td').each((j, cell) => {
          headers.push(response3.$(cell).text().trim());
        });
        console.log(`表格 ${i + 1} 表头: ${headers.join(', ')}`);
      });
    }
    
    // 保存调试信息到文件
    if (response3.data) {
      const fs = require('fs-extra');
      await fs.writeFile('./logs/ethereum_debug.html', response3.data);
      console.log('已保存调试页面到: ./logs/ethereum_debug.html');
    }
    
  } catch (error) {
    console.error('调试过程中出错:', error.message);
  } finally {
    await requestService.closeBrowser();
    console.log('\n🎉 调试完成！');
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行调试
 