const BaseCrawler = require('../core/baseCrawler');
const logger = require('../utils/logger');

/**
 * Farside ETF数据爬虫
 * 专门爬取Bitcoin和Ethereum ETF流量数据
 */
class FarsideCrawler extends BaseCrawler {
  constructor(requestService, storageService) {
    super('FarsideCrawler', requestService, storageService);
    
    // ETF网站配置
    this.sites = {
      bitcoin: {
        name: 'Bitcoin ETF Flow',
        url: 'https://farside.co.uk/bitcoin-etf-flow-all-data/',
        tableName: 'bitcoin_etf_data'
      },
      ethereum: {
        name: 'Ethereum ETF Flow', 
        url: 'https://farside.co.uk/ethereum-etf-flow-all-data/',
        tableName: 'ethereum_etf_data'
      }
    };
  }

  /**
   * 爬取所有ETF数据
   */
  async crawl() {
    logger.info('开始爬取Farside ETF数据', { crawler: this.name });
    
    const results = {};
    
    for (const [key, site] of Object.entries(this.sites)) {
      try {
        logger.info(`开始爬取: ${site.name}`, { crawler: this.name });
        
        // 优先使用Puppeteer，因为这些网站有强反爬虫
        const data = await this.crawlSiteWithPuppeteer(site);
        
        if (data.success) {
          results[key] = data;
          
          // 保存数据
          await this.storageService.saveData(site.tableName, data.tableData, 'daily');
          
          logger.info(`${site.name} 数据爬取成功`, { 
            crawler: this.name,
            recordCount: data.tableData.length 
          });
        } else {
          logger.error(`${site.name} 数据爬取失败`, { 
            crawler: this.name,
            error: data.error 
          });
          results[key] = data;
        }
        
        // 间隔等待，避免被检测
        await this.delay(3000 + Math.random() * 5000);
        
      } catch (error) {
        logger.error(`爬取 ${site.name} 时发生异常`, { 
          crawler: this.name,
          error: error.message 
        });
        results[key] = {
          success: false,
          error: error.message,
          url: site.url
        };
      }
    }
    
    return results;
  }

  /**
   * 使用Puppeteer爬取网站数据
   */
  async crawlSiteWithPuppeteer(site) {
    try {
      // 使用增强的Puppeteer配置，处理Cloudflare等保护
      const puppeteerOptions = {
        waitUntil: 'networkidle0', // 等待网络空闲，处理异步加载
        timeout: 30000, // 默认30秒超时
        evaluate: () => {
          // 在页面中执行的脚本，等待Cloudflare挑战完成
          return new Promise((resolve) => {
            const maxWait = 15000; // 最大等待15秒
            const startTime = Date.now();
            
            const checkReady = () => {
              // 检查是否是Cloudflare挑战页面
              const title = document.title;
              if (title.includes('请稍候') || title.includes('Just a moment') || title.includes('Checking')) {
                if (Date.now() - startTime < maxWait) {
                  setTimeout(checkReady, 1000); // 每秒检查一次
                  return;
                }
              }
              
              // 检查是否有数据表格
              const tables = document.querySelectorAll('table');
              if (tables.length > 0) {
                resolve();
              } else {
                // 继续等待
                if (Date.now() - startTime < maxWait) {
                  setTimeout(checkReady, 1000);
                } else {
                  resolve(); // 超时也要返回
                }
              }
            };
            
            // 开始检查
            setTimeout(checkReady, 2000); // 先等待2秒
          });
        }
      };
      
      // Ethereum ETF需要特殊处理，因为有更强的Cloudflare Turnstile保护
      if (site.url.includes('ethereum')) {
        puppeteerOptions.timeout = 60000; // 60秒超时
        puppeteerOptions.evaluate = () => {
          return new Promise((resolve) => {
            console.log('🔍 检查Ethereum ETF页面状态...');
            
            let checkCount = 0;
            const maxChecks = 120; // 检查2分钟
            
            const checkPageStatus = () => {
              checkCount++;
              
              const title = document.title;
              const tables = document.querySelectorAll('table');
              const hasChallenge = document.querySelector('#challenge-error-text') || 
                                  document.querySelector('[name="cf-turnstile-response"]');
              
              console.log(`检查 ${checkCount}/${maxChecks}: 标题="${title}", 表格=${tables.length}`);
              
              // 如果标题包含ETF且不是验证页面，说明验证成功
              if (title.includes('ETF') && !title.includes('稍候')) {
                console.log('✅ Ethereum ETF验证成功');
                resolve();
                return;
              }
              
              // 如果找到表格，说明验证成功
              if (tables.length > 0) {
                console.log('✅ 发现表格，验证成功！');
                resolve();
                return;
              }
              
              // 如果没有验证元素，可能已经通过
              if (!hasChallenge) {
                console.log('✅ 无验证元素，可能已通过');
                resolve();
                return;
              }
              
              // 超时
              if (checkCount >= maxChecks) {
                console.log('⏰ 等待超时，继续执行');
                resolve();
                return;
              }
              
              // 继续等待
              setTimeout(checkPageStatus, 1000);
            };
            
            // 开始检查
            setTimeout(checkPageStatus, 3000);
          });
        };
      }
      
      const response = await this.requestService.fetchWithPuppeteer(site.url, puppeteerOptions);

      if (!response.success) {
        // 如果Puppeteer失败，尝试HTTP请求
        return await this.crawlSiteWithHttp(site);
      }

      // 解析表格数据
      const tableData = this.parseETFTables(response.$);
      
      return {
        success: true,
        url: site.url,
        title: response.$('title').text().trim(),
        tableData: tableData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.warn(`Puppeteer爬取失败，尝试HTTP请求`, { 
        crawler: this.name,
        error: error.message 
      });
      
      // 备用HTTP请求
      return await this.crawlSiteWithHttp(site);
    }
  }

  /**
   * 使用HTTP请求爬取（备用方案）
   */
  async crawlSiteWithHttp(site) {
    try {
      const response = await this.requestService.fetchAndParse(site.url, {
        headers: {
          'Referer': 'https://farside.co.uk/',
          'Origin': 'https://farside.co.uk'
        }
      });

      if (!response.success) {
        return response;
      }

      const tableData = this.parseETFTables(response.$);
      
      return {
        success: true,
        url: site.url,
        title: response.$('title').text().trim(),
        tableData: tableData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        url: site.url
      };
    }
  }

  /**
   * 解析ETF表格数据
   */
  parseETFTables($) {
    const tables = [];
    
    // 查找主要的ETF数据表格
    $('table.etf').each((index, table) => {
      const $table = $(table);
      const tableData = {
        index: index,
        headers: [],
        rows: []
      };

      // 提取表头
      $table.find('thead tr, tr:first-child').first().find('th, td').each((i, cell) => {
        const text = $(cell).text().trim();
        if (text) {
          tableData.headers.push(text);
        }
      });

      // 提取数据行
      $table.find('tbody tr, tr:not(:first-child)').each((i, row) => {
        const rowData = [];
        $(row).find('td, th').each((j, cell) => {
          const text = $(cell).text().trim();
          rowData.push(text);
        });
        
        if (rowData.length > 0 && rowData.some(cell => cell !== '')) {
          tableData.rows.push(rowData);
        }
      });

      // 只保存有效的表格数据
      if (tableData.headers.length > 0 && tableData.rows.length > 0) {
        tables.push(tableData);
      }
    });

    // 如果没有找到class为etf的表格，查找所有表格
    if (tables.length === 0) {
      $('table').each((index, table) => {
        const $table = $(table);
        const tableData = {
          index: index,
          headers: [],
          rows: []
        };

        // 提取表头
        $table.find('tr').first().find('th, td').each((i, cell) => {
          const text = $(cell).text().trim();
          if (text) {
            tableData.headers.push(text);
          }
        });

        // 提取数据行  
        $table.find('tr:not(:first-child)').each((i, row) => {
          const rowData = [];
          $(row).find('td, th').each((j, cell) => {
            const text = $(cell).text().trim();
            rowData.push(text);
          });
          
          if (rowData.length > 0 && rowData.some(cell => cell !== '')) {
            tableData.rows.push(rowData);
          }
        });

        // 过滤掉无效表格（如导航、页脚等）
        if (tableData.headers.length >= 3 && tableData.rows.length >= 3) {
          tables.push(tableData);
        }
      });
    }

    return tables;
  }

  /**
   * 爬取历史数据 (BaseCrawler要求的方法)
   */
  async crawlHistoricalData() {
    logger.info('开始爬取历史ETF数据', { crawler: this.name });
    return await this.crawl();
  }

  /**
   * 爬取每日数据 (BaseCrawler要求的方法)
   */
  async crawlDailyData() {
    logger.info('开始爬取每日ETF数据', { crawler: this.name });
    // ETF数据每日更新，直接调用crawl方法获取最新数据
    return await this.crawl();
  }

  /**
   * 解析页面数据 (BaseCrawler要求的方法)
   * @param {string} url - 页面URL
   * @param {object} $ - Cheerio对象
   * @returns {Promise<Array>} 解析出的数据数组
   */
  async parsePage(url, $) {
    logger.info('解析ETF页面数据', { crawler: this.name, url });
    
    // 对于ETF数据，我们解析表格数据
    const tableData = this.parseETFTables($);
    
    return [{
      success: true,
      url: url,
      title: $('title').text().trim(),
      tableData: tableData,
      timestamp: new Date().toISOString()
    }];
  }

  /**
   * 爬取增量数据 (BaseCrawler要求的方法)
   */
  async crawlIncrementalData() {
    logger.info('开始爬取增量ETF数据', { crawler: this.name });
    // ETF数据通常每日更新，这里直接爬取最新数据
    return await this.crawl();
  }

  /**
   * 获取增量数据 (向后兼容)
   */
  async getIncrementalData() {
    logger.info('获取增量ETF数据', { crawler: this.name });
    return await this.crawl();
  }

  /**
   * 获取历史数据 (向后兼容)
   */
  async getHistoricalData() {
    logger.info('获取历史ETF数据', { crawler: this.name });
    return await this.crawl();
  }

  /**
   * 数据验证
   */
  validateData(data) {
    if (!data || !Array.isArray(data)) {
      return false;
    }

    // 检查是否有有效的表格数据
    return data.some(table => 
      table.headers && table.headers.length > 0 &&
      table.rows && table.rows.length > 0
    );
  }

  /**
   * 延迟函数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = FarsideCrawler; 