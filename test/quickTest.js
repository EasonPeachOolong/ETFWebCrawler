#!/usr/bin/env node

/**
 * 快速测试脚本
 * 简单快速地验证主要模块是否可以正常加载
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

console.log(`${colors.blue}🔍 快速模块检测...${colors.reset}\n`);

const modules = [
  { name: '配置管理', path: '../src/config' },
  { name: '日志工具', path: '../src/utils/logger' },
  { name: '限速器', path: '../src/utils/rateLimiter' },
  { name: 'UserAgent管理器', path: '../src/utils/userAgentManager' },
  { name: '存储服务', path: '../src/services/storageService' },
  { name: '调度服务', path: '../src/services/scheduleService' },
  { name: '请求服务', path: '../src/services/requestService' },
  { name: '爬虫基类', path: '../src/core/baseCrawler' },
  { name: '爬虫管理器', path: '../src/core/crawlerManager' },
];

let passed = 0;
let failed = 0;

for (const module of modules) {
  try {
    require(module.path);
    console.log(`${colors.green}✅ ${module.name} - 加载成功${colors.reset}`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}❌ ${module.name} - 加载失败: ${error.message}${colors.reset}`);
    failed++;
  }
}

console.log(`\n${colors.blue}=============== 检测结果 ===============${colors.reset}`);
console.log(`总模块数: ${modules.length}`);
console.log(`${colors.green}成功: ${passed}${colors.reset}`);
console.log(`${colors.red}失败: ${failed}${colors.reset}`);
console.log(`成功率: ${((passed / modules.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log(`${colors.green}\n🎉 所有模块加载正常！可以进行详细测试或启动系统。${colors.reset}`);
} else {
  console.log(`${colors.yellow}\n⚠️ 有模块加载失败，建议先修复相关问题。${colors.reset}`);
}
console.log(`${colors.blue}=====================================${colors.reset}`);
