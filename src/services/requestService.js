const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const config = require('../config');
const logger = require('../utils/logger');
const RateLimiter = require('../utils/rateLimiter');
const UserAgentManager = require('../utils/userAgentManager');

// 动态导入p-limit（ES模块）
let pLimit;
const loadPLimit = async () => {
  if (!pLimit) {
    const module = await import('p-limit');
    pLimit = module.default;
  }
  return pLimit;
};

/**
 * 请求服务类
 */
class RequestService {
  constructor() {
    this.rateLimiter = new RateLimiter();
    this.userAgentManager = new UserAgentManager();
    this.concurrentLimit = null; // 将在initializePLimit中设置
    this.browser = null;
    this.timeout = config.get('request.timeout');
    this.retries = config.get('request.retries');
    
    // 异步初始化p-limit
    this.initializePLimit();
    
    // 初始化axios实例
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
      }
    });
    
    this.setupAxiosInterceptors();
  }
  
  /**
   * 异步初始化p-limit
   */
  async initializePLimit() {
    try {
      const limitFn = await loadPLimit();
      this.concurrentLimit = limitFn(config.get('request.concurrentLimit'));
    } catch (error) {
      logger.error('p-limit初始化失败', { error: error.message });
      // 使用简单的并发控制作为后备方案
      this.concurrentLimit = (fn) => fn();
    }
  }
  
  /**
   * 设置axios拦截器
   */
  setupAxiosInterceptors() {
    // 请求拦截器
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // 设置随机User-Agent
        config.headers['User-Agent'] = this.userAgentManager.getRandomUserAgent();
        
        // 设置Referer
        if (config.url) {
          const urlObj = new URL(config.url);
          config.headers['Referer'] = `${urlObj.protocol}//${urlObj.host}`;
        }
        
        return config;
      },
      (error) => {
        logger.error('请求拦截器错误', { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // 响应拦截器
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        logger.error('响应拦截器错误', { 
          url: error.config?.url,
          status: error.response?.status,
          message: error.message 
        });
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * 发送HTTP请求
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {Promise<object>} 请求结果
   */
  async request(url, options = {}) {
    const domain = new URL(url).hostname;
    
    // 确保p-limit已初始化
    if (!this.concurrentLimit) {
      await this.initializePLimit();
    }
    
    return this.concurrentLimit(async () => {
      // 应用限速
      await this.rateLimiter.waitForRate(domain);
      
      let lastError;
      
      // 重试机制
      for (let attempt = 1; attempt <= this.retries; attempt++) {
        try {
          logger.debug(`发送请求 (尝试 ${attempt}/${this.retries})`, { url, domain });
          
          const response = await this.axiosInstance({
            url,
            method: options.method || 'GET',
            data: options.data,
            params: options.params,
            headers: options.headers || {},
            ...options
          });
          
          logger.info('请求成功', { 
            url, 
            status: response.status,
            contentLength: response.data?.length 
          });
          
          return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
            url: response.config.url
          };
          
        } catch (error) {
          lastError = error;
          logger.warn(`请求失败 (尝试 ${attempt}/${this.retries})`, {
            url,
            error: error.message,
            status: error.response?.status
          });
          
          // 如果不是最后一次尝试，等待后重试
          if (attempt < this.retries) {
            await this.rateLimiter.sleep(1000 * attempt); // 指数退避
          }
        }
      }
      
      // 所有重试都失败
      logger.error('请求最终失败', {
        url,
        error: lastError.message,
        attempts: this.retries
      });
      
      return {
        success: false,
        error: lastError.message,
        status: lastError.response?.status,
        url
      };
    });
  }
  
  /**
   * 获取HTML内容并解析
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {Promise<object>} 解析结果
   */
  async fetchAndParse(url, options = {}) {
    const result = await this.request(url, options);
    
    if (!result.success) {
      return result;
    }
    
    try {
      const $ = cheerio.load(result.data);
      return {
        ...result,
        $ // 添加cheerio对象
      };
    } catch (error) {
      logger.error('HTML解析失败', { url, error: error.message });
      return {
        success: false,
        error: `HTML解析失败: ${error.message}`,
        url
      };
    }
  }
  
  /**
   * 使用Puppeteer获取动态内容
   * @param {string} url - 请求URL
   * @param {object} options - 选项
   * @returns {Promise<object>} 获取结果
   */
  async fetchWithPuppeteer(url, options = {}) {
    const domain = new URL(url).hostname;
    
    // 确保p-limit已初始化
    if (!this.concurrentLimit) {
      await this.initializePLimit();
    }
    
    return this.concurrentLimit(async () => {
      // 应用限速
      await this.rateLimiter.waitForRate(domain);
      
      let page;
      try {
        // 初始化浏览器
        if (!this.browser) {
          await this.initBrowser();
        }
        
        page = await this.browser.newPage();
        
        // 隐藏webdriver痕迹
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
        });
        
        // 覆盖plugins属性
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          });
        });
        
        // 覆盖languages属性
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'languages', {
            get: () => ['zh-CN', 'zh', 'en'],
          });
        });
        
        // 覆盖Chrome属性
        await page.evaluateOnNewDocument(() => {
          window.chrome = {
            runtime: {},
          };
        });
        
        // 覆盖permissions属性
        await page.evaluateOnNewDocument(() => {
          const originalQuery = window.navigator.permissions.query;
          return window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
        });
        
        // 设置User-Agent
        await page.setUserAgent(this.userAgentManager.getRandomUserAgent());
        
        // 设置视口
        await page.setViewport({
          width: 1366 + Math.floor(Math.random() * 100),
          height: 768 + Math.floor(Math.random() * 100),
          deviceScaleFactor: 1
        });
        
        // 设置额外的请求头
        await page.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'DNT': '1'
        });
        
        // 禁用图片加载以提高速度（可选）
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
            request.abort();
          } else {
            request.continue();
          }
        });
        
        logger.debug('使用Puppeteer访问页面', { url });
        
        // 导航到页面
        const response = await page.goto(url, {
          waitUntil: options.waitUntil || 'networkidle0',
          timeout: this.timeout
        });
        
        // 等待特定选择器（如果指定）
        if (options.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, {
            timeout: options.selectorTimeout || 10000
          });
        }
        
        // 执行自定义脚本（如果指定）
        if (options.evaluate) {
          await page.evaluate(options.evaluate);
        }
        
        // 获取页面内容
        const content = await page.content();
        
        // 解析HTML
        const $ = cheerio.load(content);
        
        logger.info('Puppeteer请求成功', { 
          url, 
          status: response.status(),
          contentLength: content.length 
        });
        
        return {
          success: true,
          data: content,
          $,
          status: response.status(),
          url: response.url()
        };
        
      } catch (error) {
        logger.error('Puppeteer请求失败', {
          url,
          error: error.message
        });
        
        return {
          success: false,
          error: error.message,
          url
        };
      } finally {
        if (page) {
          await page.close();
        }
      }
    });
  }
  
  /**
   * 初始化浏览器
   */
  async initBrowser() {
    if (this.browser) {
      return;
    }
    
    try {
      // Chrome浏览器路径配置
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome', // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows x86
      ];
      
      // 查找可用的Chrome路径
      let executablePath = null;
      const fs = require('fs');
      
      for (const path of chromePaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      }
      
      const browserOptions = {
        headless: 'new', // 使用新的headless模式
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--disable-javascript-harmony-shipping',
          '--disable-client-side-phishing-detection',
          '--disable-sync',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-component-extensions-with-background-pages',
          '--disable-ipc-flooding-protection',
          '--enable-features=NetworkService,NetworkServiceLogging',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--no-first-run',
          '--no-default-browser-check',
          '--no-crash-upload',
          '--disable-domain-reliability',
          '--disable-component-update',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        ]
      };
      
      // 如果找到系统Chrome，使用它；否则使用Puppeteer下载的Chromium
      if (executablePath) {
        browserOptions.executablePath = executablePath;
        logger.info('使用系统Chrome浏览器', { path: executablePath });
      } else {
        logger.info('使用Puppeteer Chromium');
      }
      
      this.browser = await puppeteer.launch(browserOptions);
      
      logger.info('Puppeteer浏览器初始化成功');
    } catch (error) {
      logger.error('Puppeteer浏览器初始化失败', { error: error.message });
      throw error;
    }
  }
  
  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Puppeteer浏览器已关闭');
    }
  }
  
  /**
   * 获取请求统计信息
   */
  getStats() {
    return {
      rateLimiterActive: this.rateLimiter.requestTimes.size,
      concurrentLimit: config.get('request.concurrentLimit'),
      browserActive: !!this.browser
    };
  }
  
  /**
   * 重置请求服务
   */
  reset() {
    this.rateLimiter.clearAll();
    this.userAgentManager.reset();
  }
  
  /**
   * 销毁服务
   */
  async destroy() {
    await this.closeBrowser();
    this.reset();
  }
}

module.exports = RequestService; 