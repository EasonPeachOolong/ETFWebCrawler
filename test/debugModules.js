#!/usr/bin/env node

/**
 * 调试模块加载问题
 */

console.log('测试单个模块加载...\n');

// 测试请求服务的依赖
console.log('1. 测试axios...');
try {
  require('axios');
  console.log('   ✅ axios 正常');
} catch (e) {
  console.log('   ❌ axios 错误:', e.message);
}

console.log('2. 测试cheerio...');
try {
  require('cheerio');
  console.log('   ✅ cheerio 正常');
} catch (e) {
  console.log('   ❌ cheerio 错误:', e.message);
}

console.log('3. 测试puppeteer...');
try {
  require('puppeteer');
  console.log('   ✅ puppeteer 正常');
} catch (e) {
  console.log('   ❌ puppeteer 错误:', e.message);
}

console.log('4. 测试p-limit...');
try {
  require('p-limit');
  console.log('   ✅ p-limit 正常');
} catch (e) {
  console.log('   ❌ p-limit 错误:', e.message);
}

console.log('5. 测试基础模块...');
try {
  require('../src/config');
  console.log('   ✅ config 正常');
} catch (e) {
  console.log('   ❌ config 错误:', e.message);
}

try {
  require('../src/utils/logger');
  console.log('   ✅ logger 正常');
} catch (e) {
  console.log('   ❌ logger 错误:', e.message);
}

try {
  require('../src/utils/rateLimiter');
  console.log('   ✅ rateLimiter 正常');
} catch (e) {
  console.log('   ❌ rateLimiter 错误:', e.message);
}

try {
  require('../src/utils/userAgentManager');
  console.log('   ✅ userAgentManager 正常');
} catch (e) {
  console.log('   ❌ userAgentManager 错误:', e.message);
}

console.log('\n现在测试问题模块...');

console.log('6. 逐步测试 requestService...');
try {
  // 尝试逐个导入依赖
  const axios = require('axios');
  const cheerio = require('cheerio');
  const pLimit = require('p-limit');
  const config = require('../src/config');
  const logger = require('../src/utils/logger');
  const RateLimiter = require('../src/utils/rateLimiter');
  const UserAgentManager = require('../src/utils/userAgentManager');
  
  console.log('   ✅ 所有依赖导入成功');
  
  // 现在尝试导入puppeteer
  const puppeteer = require('puppeteer');
  console.log('   ✅ puppeteer 导入成功');
  
  // 最后尝试导入requestService
  const RequestService = require('../src/services/requestService');
  console.log('   ✅ requestService 导入成功');
  
} catch (e) {
  console.log('   ❌ requestService 错误:', e.message);
  console.log('   详细错误:', e.stack);
}
