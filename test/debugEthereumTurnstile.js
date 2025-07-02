const RequestService = require('../src/services/requestService');
const logger = require('../src/utils/logger');
const fs = require('fs-extra');

/**
 * 专门处理Ethereum ETF网站的Cloudflare Turnstile验证
 */
async function debugEthereumTurnstile() {
  const requestService = new RequestService();
  const url = 'https://farside.co.uk/ethereum-etf-flow-all-data/';
  
  console.log('🔐 Cloudflare Turnstile验证调试');
  console.log('================================\n');
  
  try {
    // 策略1: 超长等待时间处理Turnstile验证
    console.log('策略1: 超长等待 + Turnstile自动处理');
    console.log('============================');
    
    const response1 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'networkidle0',
      timeout: 60000, // 60秒超时
      evaluate: () => {
        return new Promise((resolve) => {
          console.log('🔍 开始检查页面状态...');
          
          let checkCount = 0;
          const maxChecks = 120; // 检查2分钟
          
          const checkPageStatus = () => {
            checkCount++;
            
            const title = document.title;
            const tables = document.querySelectorAll('table');
            const hasChallenge = document.querySelector('#challenge-error-text') || 
                                document.querySelector('[name="cf-turnstile-response"]');
            
            console.log(`检查 ${checkCount}/${maxChecks}: 标题="${title}", 表格=${tables.length}, 验证=${hasChallenge ? '是' : '否'}`);
            
            // 如果标题不再是"请稍候..."，说明验证可能已完成
            if (title !== '请稍候…' && !title.includes('稍候')) {
              console.log('✅ 标题已更改，可能验证成功');
              resolve({ success: true, tables: tables.length });
              return;
            }
            
            // 如果找到表格，说明验证成功
            if (tables.length > 0) {
              console.log('✅ 发现表格，验证成功！');
              resolve({ success: true, tables: tables.length });
              return;
            }
            
            // 如果没有验证元素，可能已经通过
            if (!hasChallenge) {
              console.log('✅ 无验证元素，可能已通过');
              resolve({ success: true, tables: tables.length });
              return;
            }
            
            // 超时
            if (checkCount >= maxChecks) {
              console.log('⏰ 等待超时');
              resolve({ success: false, timeout: true });
              return;
            }
            
            // 继续等待
            setTimeout(checkPageStatus, 1000);
          };
          
          // 开始检查
          setTimeout(checkPageStatus, 3000);
        });
      }
    });
    
    console.log(`策略1结果: ${response1.success ? '成功' : '失败'}`);
    if (response1.success) {
      console.log(`标题: ${response1.$ ? response1.$('title').text() : 'N/A'}`);
      console.log(`表格数量: ${response1.$ ? response1.$('table').length : 0}`);
      
      if (response1.$ && response1.$('table').length > 0) {
        console.log('🎉 策略1成功！获取到表格数据');
        await saveDebugFile('turnstile_success.html', response1.data);
        return { success: true, data: response1 };
      }
    }
    
    await delay(3000);
    
    // 策略2: 模拟人类行为 + 等待验证
    console.log('\n策略2: 模拟人类行为 + 等待验证');
    console.log('============================');
    
    // 重新启动浏览器
    await requestService.closeBrowser();
    await delay(2000);
    
    const response2 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000, // 90秒超时
      evaluate: () => {
        return new Promise(async (resolve) => {
          console.log('🤖 开始模拟人类行为...');
          
          // 模拟人类行为
          const simulateHumanBehavior = () => {
            // 模拟鼠标移动
            const moveEvent = new MouseEvent('mousemove', {
              clientX: Math.random() * window.innerWidth,
              clientY: Math.random() * window.innerHeight,
              bubbles: true
            });
            document.dispatchEvent(moveEvent);
            
            // 模拟点击
            const clickEvent = new MouseEvent('click', {
              clientX: Math.random() * window.innerWidth,
              clientY: Math.random() * window.innerHeight,
              bubbles: true
            });
            document.dispatchEvent(clickEvent);
            
            // 模拟滚动
            window.scrollBy(0, Math.random() * 100 - 50);
          };
          
          // 定期模拟人类行为
          const behaviorInterval = setInterval(simulateHumanBehavior, 2000);
          
          let checkCount = 0;
          const maxChecks = 180; // 检查3分钟
          
          const checkVerification = () => {
            checkCount++;
            
            const title = document.title;
            const tables = document.querySelectorAll('table');
            const turnstileWidget = document.querySelector('[name="cf-turnstile-response"]');
            const challengeComplete = document.querySelector('#challenge-success-text');
            
            console.log(`验证检查 ${checkCount}/${maxChecks}`);
            console.log(`  标题: ${title}`);
            console.log(`  表格: ${tables.length}`);
            console.log(`  验证组件: ${turnstileWidget ? '存在' : '不存在'}`);
            console.log(`  验证完成: ${challengeComplete ? '是' : '否'}`);
            
            // 检查是否验证成功
            if (challengeComplete && challengeComplete.style.display !== 'none') {
              console.log('✅ 验证成功提示出现');
              // 等待页面重定向
              setTimeout(() => {
                const finalTables = document.querySelectorAll('table');
                resolve({ 
                  success: true, 
                  tables: finalTables.length,
                  verificationComplete: true 
                });
              }, 5000);
              return;
            }
            
            // 检查是否已经跳转到实际内容页面
            if (title.includes('ETF') && !title.includes('稍候')) {
              console.log('✅ 已跳转到ETF页面');
              resolve({ 
                success: true, 
                tables: tables.length,
                redirected: true 
              });
              return;
            }
            
            // 如果有表格数据，说明验证成功
            if (tables.length > 0) {
              console.log('✅ 发现表格数据');
              resolve({ 
                success: true, 
                tables: tables.length,
                foundTables: true 
              });
              return;
            }
            
            // 超时
            if (checkCount >= maxChecks) {
              clearInterval(behaviorInterval);
              console.log('⏰ 验证等待超时');
              resolve({ success: false, timeout: true });
              return;
            }
            
            // 继续等待
            setTimeout(checkVerification, 1000);
          };
          
          // 开始验证检查
          setTimeout(checkVerification, 5000);
        });
      }
    });
    
    console.log(`策略2结果: ${response2.success ? '成功' : '失败'}`);
    if (response2.success) {
      console.log(`标题: ${response2.$ ? response2.$('title').text() : 'N/A'}`);
      console.log(`表格数量: ${response2.$ ? response2.$('table').length : 0}`);
      
      if (response2.$ && response2.$('table').length > 0) {
        console.log('🎉 策略2成功！获取到表格数据');
        await saveDebugFile('turnstile_strategy2_success.html', response2.data);
        return { success: true, data: response2 };
      }
    }
    
    await delay(3000);
    
    // 策略3: 尝试绕过验证的直接访问
    console.log('\n策略3: 尝试绕过验证的直接访问');
    console.log('============================');
    
    // 尝试使用不同的浏览器配置
    await requestService.closeBrowser();
    await delay(2000);
    
    const response3 = await requestService.fetchWithPuppeteer(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
      evaluate: () => {
        return new Promise((resolve) => {
          // 尝试通过JavaScript直接访问数据
          const scripts = Array.from(document.querySelectorAll('script'));
          const hasDataScript = scripts.some(script => {
            const content = script.textContent || script.innerHTML;
            return content && (content.includes('table') || content.includes('data') || content.includes('ETF'));
          });
          
          setTimeout(() => {
            resolve({
              hasDataScript,
              scriptCount: scripts.length,
              title: document.title,
              tables: document.querySelectorAll('table').length
            });
          }, 5000);
        });
      }
    });
    
    console.log('策略3 - 页面分析:');
    if (response3.success) {
      console.log(`  脚本数量: ${response3.scriptCount || 0}`);
      console.log(`  包含数据脚本: ${response3.hasDataScript ? '是' : '否'}`);
      console.log(`  标题: ${response3.title || 'N/A'}`);
      console.log(`  表格: ${response3.tables || 0}`);
    }
    
    console.log('\n📊 Turnstile调试总结:');
    console.log('====================');
    console.log('❌ Ethereum ETF网站受到Cloudflare Turnstile保护');
    console.log('🔐 需要完成人机验证才能访问实际内容');
    console.log('⏱️ 验证过程可能需要较长时间');
    console.log('');
    console.log('💡 建议解决方案:');
    console.log('1. 使用专业的Cloudflare绕过服务');
    console.log('2. 寻找其他数据源');
    console.log('3. 联系网站管理员申请API访问');
    console.log('4. 使用代理服务器尝试不同地区的访问');
    
    return { success: false, reason: 'Cloudflare Turnstile Protection' };
    
  } catch (error) {
    console.error('❌ 调试过程中发生异常:', error.message);
    return { success: false, error: error.message };
  } finally {
    await requestService.closeBrowser();
    console.log('\n🎯 Turnstile调试完成！');
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
debugEthereumTurnstile().catch(console.error); 