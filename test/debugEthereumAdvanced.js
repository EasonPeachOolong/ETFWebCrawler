const RequestService = require('../src/services/requestService');
const logger = require('../src/utils/logger');
const fs = require('fs-extra');

/**
 * 高级Ethereum ETF网站调试
 * 专门解决Cloudflare保护问题
 */
async function debugEthereumAdvanced() {
  const requestService = new RequestService();
  const url = 'https://farside.co.uk/ethereum-etf-flow-all-data/';
  
  console.log('🔍 Ethereum ETF网站高级调试');
  console.log('============================\n');
  
  try {
    
    // 策略1: 加载Bitcoin网站cookies后访问Ethereum
    console.log('策略1: 先访问Bitcoin网站建立会话');
    console.log('================================');
    
    const bitcoinUrl = 'https://farside.co.uk/bitcoin-etf-flow-all-data/';
    console.log('🔄 先访问Bitcoin网站...');
    
    const bitcoinResponse = await requestService.fetchWithPuppeteer(bitcoinUrl, {
      waitUntil: 'networkidle2',
      evaluate: () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(), 3000);
        });
      }
    });
    
    console.log(`Bitcoin访问: ${bitcoinResponse.success ? '成功' : '失败'}`);
    console.log(`Bitcoin标题: ${bitcoinResponse.$ ? bitcoinResponse.$('title').text() : 'N/A'}`);
    
    await delay(2000);
    
    // 现在尝试访问Ethereum网站
    console.log('\n🔄 使用同一浏览器会话访问Ethereum...');
    
    const ethResponse1 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'networkidle2',
      evaluate: () => {
        return new Promise((resolve) => {
          // 更长的等待时间
          setTimeout(() => resolve(), 8000);
        });
      }
    });
    
    console.log(`Ethereum访问: ${ethResponse1.success ? '成功' : '失败'}`);
    console.log(`Ethereum标题: ${ethResponse1.$ ? ethResponse1.$('title').text() : 'N/A'}`);
    console.log(`内容长度: ${ethResponse1.data ? ethResponse1.data.length : 0}`);
    
    if (ethResponse1.$) {
      const tables = ethResponse1.$('table').length;
      console.log(`表格数量: ${tables}`);
      
      if (tables > 0) {
        console.log('✅ 策略1成功！发现表格数据');
        await saveDebugFile('strategy1_success.html', ethResponse1.data);
        return;
      }
    }
    
    await delay(3000);
    
    // 策略2: 使用不同的User-Agent和更多反检测
    console.log('\n策略2: 增强反检测 + 随机延迟');
    console.log('==============================');
    
    // 关闭之前的浏览器，重新初始化
    await requestService.closeBrowser();
    await delay(2000);
    
    const ethResponse2 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'load',
      evaluate: () => {
        return new Promise(async (resolve) => {
          // 隐藏更多automation痕迹
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          
          // 模拟人类行为
          document.addEventListener('DOMContentLoaded', () => {
            // 模拟鼠标移动
            const moveEvent = new MouseEvent('mousemove', {
              clientX: Math.random() * window.innerWidth,
              clientY: Math.random() * window.innerHeight
            });
            document.dispatchEvent(moveEvent);
          });
          
          // 等待页面完全加载
          let waitTime = 0;
          const maxWait = 15000;
          
          const checkContent = () => {
            waitTime += 1000;
            const title = document.title;
            const tables = document.querySelectorAll('table');
            
            console.log(`检查中... 等待时间: ${waitTime}ms, 标题: ${title}, 表格: ${tables.length}`);
            
            // 如果找到表格或超时，返回
            if (tables.length > 0 || waitTime >= maxWait) {
              resolve();
            } else {
              setTimeout(checkContent, 1000);
            }
          };
          
          // 开始检查
          setTimeout(checkContent, 2000);
        });
      }
    });
    
    console.log(`策略2结果: ${ethResponse2.success ? '成功' : '失败'}`);
    console.log(`标题: ${ethResponse2.$ ? ethResponse2.$('title').text() : 'N/A'}`);
    console.log(`内容长度: ${ethResponse2.data ? ethResponse2.data.length : 0}`);
    
    if (ethResponse2.$) {
      const tables = ethResponse2.$('table').length;
      console.log(`表格数量: ${tables}`);
      
      if (tables > 0) {
        console.log('✅ 策略2成功！');
        await saveDebugFile('strategy2_success.html', ethResponse2.data);
        return;
      }
    }
    
    await delay(3000);
    
    // 策略3: 直接分析页面，寻找数据API
    console.log('\n策略3: 分析页面寻找数据API');
    console.log('=========================');
    
    const ethResponse3 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'networkidle0',
      evaluate: () => {
        return new Promise((resolve) => {
          // 寻找可能的数据源
          const scripts = Array.from(document.querySelectorAll('script'));
          const dataInfo = {
            scriptCount: scripts.length,
            hasDataScript: false,
            apiUrls: [],
            jsonData: []
          };
          
          scripts.forEach((script, index) => {
            const content = script.textContent || script.innerHTML;
            if (content) {
              // 寻找API调用
              const apiMatches = content.match(/https?:\/\/[^"'\s]+/g);
              if (apiMatches) {
                dataInfo.apiUrls.push(...apiMatches);
              }
              
              // 寻找JSON数据
              const jsonMatches = content.match(/\{[^{}]*"[^"]*"[^{}]*\}/g);
              if (jsonMatches) {
                dataInfo.jsonData.push(...jsonMatches.slice(0, 3)); // 只取前3个
              }
              
              // 检查是否包含ETF数据
              if (content.includes('ETF') || content.includes('flow') || content.includes('data')) {
                dataInfo.hasDataScript = true;
              }
            }
          });
          
          // 返回页面分析信息
          window.debugInfo = dataInfo;
          
          setTimeout(() => {
            resolve();
          }, 5000);
        });
      }
    });
    
    console.log(`策略3结果: ${ethResponse3.success ? '成功' : '失败'}`);
    
    if (ethResponse3.success) {
      // 获取调试信息
      const debugInfo = await requestService.browser.pages().then(pages => {
        if (pages.length > 0) {
          return pages[pages.length - 1].evaluate(() => window.debugInfo);
        }
        return null;
      });
      
      if (debugInfo) {
        console.log(`脚本数量: ${debugInfo.scriptCount}`);
        console.log(`包含数据脚本: ${debugInfo.hasDataScript}`);
        console.log(`发现API: ${debugInfo.apiUrls.length} 个`);
        console.log(`JSON数据: ${debugInfo.jsonData.length} 个`);
        
        if (debugInfo.apiUrls.length > 0) {
          console.log('🔍 发现的API URLs:');
          debugInfo.apiUrls.slice(0, 5).forEach((url, i) => {
            console.log(`  ${i+1}. ${url}`);
          });
        }
      }
      
      await saveDebugFile('strategy3_analysis.html', ethResponse3.data);
    }
    
    // 策略4: 尝试直接HTTP请求（可能绕过JavaScript检查）
    console.log('\n策略4: 尝试高级HTTP请求');
    console.log('========================');
    
    try {
      const httpResponse = await requestService.request(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://farside.co.uk/bitcoin-etf-flow-all-data/'
        }
      });
      
      console.log(`HTTP请求: ${httpResponse.success ? '成功' : '失败'}`);
      console.log(`状态码: ${httpResponse.status}`);
      console.log(`内容长度: ${httpResponse.data ? httpResponse.data.length : 0}`);
      
      if (httpResponse.success && httpResponse.data) {
        const cheerio = require('cheerio');
        const $ = cheerio.load(httpResponse.data);
        const tables = $('table').length;
        console.log(`HTTP表格数量: ${tables}`);
        
        if (tables > 0) {
          console.log('✅ 策略4成功！HTTP请求获得数据');
          await saveDebugFile('strategy4_http_success.html', httpResponse.data);
          return;
        }
      }
      
    } catch (error) {
      console.log(`HTTP请求失败: ${error.message}`);
    }
    
    console.log('\n📊 调试总结:');
    console.log('===========');
    console.log('❌ 所有策略都未能获取到Ethereum ETF表格数据');
    console.log('🔍 网站可能采用了以下保护机制:');
    console.log('   • 高级Cloudflare保护');
    console.log('   • JavaScript挑战验证');
    console.log('   • 地理位置限制');
    console.log('   • 动态数据加载');
    console.log('   • 反自动化检测');
    
  } catch (error) {
    console.error('❌ 调试过程中发生异常:', error.message);
  } finally {
    await requestService.closeBrowser();
    console.log('\n🎯 调试完成！');
  }
}

/**
 * 保存调试文件
 */
async function saveDebugFile(filename, content) {
  try {
    const filepath = `./logs/${filename}`;
    await fs.writeFile(filepath, content);
    console.log(`💾 调试文件已保存: ${filepath}`);
  } catch (error) {
    console.log(`保存文件失败: ${error.message}`);
  }
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行调试
debugEthereumAdvanced().catch(console.error); 