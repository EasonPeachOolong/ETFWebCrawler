#!/bin/bash

# ETF数据爬虫启动脚本
# 使用PM2进程管理器

echo "🚀 启动ETF数据爬虫系统"
echo "========================"

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2未安装，正在安装..."
    npm install -g pm2
fi

# 检查是否已经在运行
if pm2 describe webcrawl-etf > /dev/null 2>&1; then
    echo "⚠️  应用已在运行，正在重启..."
    pm2 restart webcrawl-etf
else
    echo "▶️  启动新应用..."
    pm2 start ecosystem.config.js --env production
fi

# 保存PM2配置（重启后自动恢复）
pm2 save

# 设置开机自启（首次运行需要）
pm2 startup

echo ""
echo "✅ ETF数据爬虫启动完成"
echo ""
echo "📊 状态查看: pm2 status"
echo "📋 日志查看: pm2 logs webcrawl-etf"
echo "⏹️  停止服务: pm2 stop webcrawl-etf"
echo "🔄 重启服务: pm2 restart webcrawl-etf"
echo "" 