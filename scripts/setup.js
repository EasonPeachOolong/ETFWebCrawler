#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

/**
 * 项目设置脚本
 */
class ProjectSetup {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.envPath = path.join(this.projectRoot, '.env');
    this.envExamplePath = path.join(this.projectRoot, '.env.example');
  }
  
  /**
   * 运行设置
   */
  async run() {
    console.log('🚀 开始设置Node.js网络爬虫系统...\n');
    
    try {
      // 创建必要的目录
      await this.createDirectories();
      
      // 复制环境变量文件
      await this.setupEnvironment();
      
      // 检查依赖
      await this.checkDependencies();
      
      console.log('✅ 项目设置完成！');
      console.log('\n📖 下一步操作：');
      console.log('1. 修改 .env 文件中的配置（如需要）');
      console.log('2. 运行 npm start 启动爬虫系统');
      console.log('3. 或运行 npm run dev 以开发模式启动\n');
      
    } catch (error) {
      console.error('❌ 设置失败:', error.message);
      process.exit(1);
    }
  }
  
  /**
   * 创建必要的目录
   */
  async createDirectories() {
    console.log('📁 创建项目目录...');
    
    const directories = [
      'data',
      'logs',
      'src/crawlers',
      'scripts'
    ];
    
    for (const dir of directories) {
      const fullPath = path.join(this.projectRoot, dir);
      await fs.ensureDir(fullPath);
      console.log(`   ✓ 创建目录: ${dir}`);
    }
    
    console.log('');
  }
  
  /**
   * 设置环境变量
   */
  async setupEnvironment() {
    console.log('⚙️  设置环境变量...');
    
    // 检查.env文件是否存在
    const envExists = await fs.pathExists(this.envPath);
    
    if (!envExists) {
      // 复制.env.example到.env
      if (await fs.pathExists(this.envExamplePath)) {
        await fs.copy(this.envExamplePath, this.envPath);
        console.log('   ✓ 复制 .env.example 到 .env');
      } else {
        // 创建基本的.env文件
        const defaultEnv = `# 数据存储路径
DATA_PATH=./data

# 日志级别
LOG_LEVEL=info

# 请求延迟配置（毫秒）
MIN_DELAY=1000
MAX_DELAY=3000

# 并发限制
CONCURRENT_LIMIT=3

# 定时任务配置
DAILY_CRON=0 0 8 * * *

# 用户代理轮换
ROTATE_USER_AGENT=true`;
        
        await fs.writeFile(this.envPath, defaultEnv, 'utf8');
        console.log('   ✓ 创建默认 .env 文件');
      }
    } else {
      console.log('   ✓ .env 文件已存在');
    }
    
    console.log('');
  }
  
  /**
   * 检查依赖
   */
  async checkDependencies() {
    console.log('📦 检查项目依赖...');
    
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    
    if (await fs.pathExists(packageJsonPath)) {
      console.log('   ✓ package.json 存在');
      
      if (await fs.pathExists(nodeModulesPath)) {
        console.log('   ✓ node_modules 存在');
      } else {
        console.log('   ⚠️  node_modules 不存在，请运行 npm install');
      }
    } else {
      console.log('   ❌ package.json 不存在');
    }
    
    console.log('');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const setup = new ProjectSetup();
  setup.run();
}

module.exports = ProjectSetup; 