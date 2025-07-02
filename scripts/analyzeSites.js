#!/usr/bin/env node

/**
 * 网站结构分析脚本
 * 分析farside.co.uk的ETF数据页面结构
 */

const RequestService = require('../src/services/requestService');
const logger = require('../src/utils/logger');

class SiteAnalyzer {
  constructor() {
    this.requestService = new RequestService();
    this.logger = logger.createChildLogger('SiteAnalyzer');
  }

  /**
   * 分析网站结构
   */
  async analyzeSites() {
    const sites = [
      {
        name: 'Bitcoin ETF Flow',
        url: 'https://farside.co.uk/bitcoin-etf-flow-all-data/',
        type: 'bitcoin'
      },
      {
        name: 'Ethereum ETF Flow', 
        url: 'https://farside.co.uk/ethereum-etf-flow-all-data/',
        type: 'ethereum'
      }
    ];

    for (const site of sites) {
      this.logger.info(`开始分析网站: ${site.name}`);
      await this.analyzeSite(site);
      
      // 等待一段时间避免请求过快
      await this.sleep(3000);
    }
  }

  /**
   * 分析单个网站
   */
  async analyzeSite(site) {
    try {
      // 使用普通HTTP请求先试试
      this.logger.info(`请求网站: ${site.url}`);
      let result = await this.requestService.fetchAndParse(site.url);
      
      if (!result.success) {
        this.logger.warn(`HTTP请求失败，尝试使用Puppeteer: ${result.error}`);
        
        // 使用Puppeteer获取动态内容
        result = await this.requestService.fetchWithPuppeteer(site.url, {
          waitUntil: 'networkidle0',
          waitForSelector: 'table, .table, [class*="table"]'
        });
      }

      if (!result.success) {
        this.logger.error(`无法访问网站: ${site.name}`, { error: result.error });
        return;
      }

      const $ = result.$;
      
      // 分析页面基本信息
      const title = $('title').text();
      const metaDescription = $('meta[name="description"]').attr('content');
      
      this.logger.info(`网站信息:`, {
        title,
        description: metaDescription,
        url: site.url
      });

      // 查找表格
      const tables = $('table');
      this.logger.info(`找到 ${tables.length} 个表格`);

      tables.each((index, table) => {
        const $table = $(table);
        
        // 分析表格结构
        const headers = [];
        $table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td').each((i, header) => {
          headers.push($(header).text().trim());
        });

        const rowCount = $table.find('tbody tr, tr').length;
        const hasClass = $table.attr('class');
        const hasId = $table.attr('id');

        this.logger.info(`表格 ${index + 1} 信息:`, {
          headers: headers.slice(0, 10), // 只显示前10个标题
          headerCount: headers.length,
          rowCount,
          class: hasClass,
          id: hasId
        });

        // 获取第一行数据作为样例
        const firstDataRow = [];
        $table.find('tbody tr:first-child td, tr:nth-child(2) td').each((i, cell) => {
          firstDataRow.push($(cell).text().trim());
        });

        if (firstDataRow.length > 0) {
          this.logger.info(`样例数据:`, {
            data: firstDataRow.slice(0, 10) // 只显示前10个数据
          });
        }
      });

      // 检查是否有JavaScript动态加载的内容
      const scripts = $('script');
      let hasDataScript = false;
      
      scripts.each((index, script) => {
        const scriptContent = $(script).html();
        if (scriptContent && (scriptContent.includes('data') || scriptContent.includes('table'))) {
          hasDataScript = true;
        }
      });

      this.logger.info(`JavaScript动态内容检测:`, {
        scriptCount: scripts.length,
        hasDataScript
      });

      // 保存页面源码供后续分析
      const fs = require('fs');
      const filename = `analysis_${site.type}_${Date.now()}.html`;
      fs.writeFileSync(`./logs/${filename}`, result.data);
      this.logger.info(`页面源码已保存: ./logs/${filename}`);

    } catch (error) {
      this.logger.error(`分析网站失败: ${site.name}`, {
        error: error.message
      });
    }
  }

  /**
   * 睡眠函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  async cleanup() {
    await this.requestService.destroy();
  }
}

// 运行分析
if (require.main === module) {
  const analyzer = new SiteAnalyzer();
  
  analyzer.analyzeSites()
    .then(() => {
      console.log('✅ 网站结构分析完成');
    })
    .catch(error => {
      console.error('❌ 分析失败:', error.message);
    })
    .finally(() => {
      analyzer.cleanup();
    });
}

module.exports = SiteAnalyzer; 