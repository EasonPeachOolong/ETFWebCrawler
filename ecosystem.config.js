module.exports = {
  apps: [{
    name: 'webcrawl-etf',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    
    // 自动重启配置
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // 错误处理
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // 日志配置
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 开发环境
    env_development: {
      NODE_ENV: 'development',
      DEBUG: 'true'
    },
    
    // 进程监控
    instance_var: 'INSTANCE_ID',
    
    // cron重启 (可选，每天凌晨4点重启一次)
    cron_restart: '0 4 * * *'
  }]
}; 