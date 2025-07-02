# ETF数据爬虫部署指南

本文档提供多种部署方案，确保ETF数据爬虫系统能够**自动运行**和**开机自启**。

## 🎯 目标

解决当前系统需要手动启动和持续运行的问题，实现：
- ✅ 自动重启（进程崩溃后）
- ✅ 开机自启（服务器重启后）
- ✅ 定时任务（每日自动爬取）
- ✅ 日志管理
- ✅ 进程监控

## 📋 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **PM2** | 功能丰富、易管理、重启快 | 需要额外安装 | 推荐，生产环境 |
| **系统Cron** | 系统原生、资源占用低 | 执行时间固定 | 简单场景 |
| **Systemd** | 系统级服务、最稳定 | 配置复杂 | 企业级部署 |

---

## 🚀 方案一：PM2进程管理器（推荐）

### 特点
- ✅ **自动重启**：进程崩溃后立即重启
- ✅ **开机自启**：服务器重启后自动恢复
- ✅ **内存监控**：超过500M自动重启
- ✅ **日志管理**：自动轮转和存储
- ✅ **实时监控**：Web界面和命令行工具

### 1. 安装PM2

```bash
# 全局安装PM2
npm install -g pm2

# 验证安装
pm2 --version
```

### 2. 启动服务

```bash
# 方式1：使用启动脚本（推荐）
chmod +x scripts/start.sh
./scripts/start.sh

# 方式2：直接启动
pm2 start ecosystem.config.js --env production
```

### 3. 设置开机自启

```bash
# 生成启动脚本
pm2 startup

# 保存当前进程列表
pm2 save
```

### 4. 常用管理命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs webcrawl-etf

# 重启服务
pm2 restart webcrawl-etf

# 停止服务
pm2 stop webcrawl-etf

# 删除服务
pm2 delete webcrawl-etf

# 监控界面
pm2 monit
```

### 5. 日志文件位置

- 应用日志：`./logs/pm2-combined.log`
- 输出日志：`./logs/pm2-out.log`
- 错误日志：`./logs/pm2-error.log`

---

## ⏰ 方案二：系统级Cron + 单次执行

### 特点
- ✅ **系统原生**：无需额外软件
- ✅ **资源节约**：只在执行时占用资源
- ✅ **防重复执行**：锁文件机制
- ✅ **灵活调度**：可自定义执行时间

### 1. 测试单次执行脚本

```bash
# 给脚本执行权限
chmod +x scripts/run-once.js

# 测试执行
node scripts/run-once.js
```

### 2. 设置系统Cron

```bash
# 编辑用户crontab
crontab -e

# 添加以下行（每日上午9点执行）
0 9 * * * cd /Users/easonyang/Data_WebcCrawl && node scripts/run-once.js >> logs/cron.log 2>&1

# 或者每隔4小时执行一次
0 */4 * * * cd /Users/easonyang/Data_WebcCrawl && node scripts/run-once.js >> logs/cron.log 2>&1
```

### 3. 查看Cron日志

```bash
# 查看执行日志
tail -f logs/cron.log

# 查看系统cron日志（Mac）
tail -f /var/log/system.log | grep cron

# 查看系统cron日志（Linux）
tail -f /var/log/cron
```

### 4. Cron时间表达式

```bash
# 分钟 小时 日期 月份 星期
# *    *   *   *    *

# 每日上午9点
0 9 * * *

# 每12小时执行（上午9点和晚上9点）
0 9,21 * * *

# 每周一上午9点
0 9 * * 1

# 每月1号上午9点
0 9 1 * *
```

---

## 🔧 方案三：Systemd系统服务

### 特点
- ✅ **系统级服务**：最高权限和稳定性
- ✅ **完整的生命周期管理**
- ✅ **系统集成**：与操作系统完全集成
- ✅ **安全配置**：沙盒隔离

### 1. 安装服务

```bash
# 复制服务文件到系统目录
sudo cp scripts/webcrawl-etf.service /etc/systemd/system/

# 修改配置文件中的路径
sudo nano /etc/systemd/system/webcrawl-etf.service
# 将 /path/to/Data_WebcCrawl 替换为实际路径

# 重新加载systemd配置
sudo systemctl daemon-reload
```

### 2. 启动和管理服务

```bash
# 启动服务
sudo systemctl start webcrawl-etf

# 设置开机自启
sudo systemctl enable webcrawl-etf

# 查看服务状态
sudo systemctl status webcrawl-etf

# 重启服务
sudo systemctl restart webcrawl-etf

# 停止服务
sudo systemctl stop webcrawl-etf

# 查看日志
sudo journalctl -u webcrawl-etf -f
```

---

## 📊 监控和维护

### 1. 健康检查脚本

```bash
# 创建健康检查脚本
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

echo "🏥 ETF爬虫系统健康检查"
echo "===================="

# 检查数据文件
if [ -f "data/bitcoin_etf_data/metadata.json" ]; then
    echo "✅ Bitcoin数据文件存在"
    bitcoin_size=$(du -sh data/bitcoin_etf_data | cut -f1)
    echo "   数据大小: $bitcoin_size"
else
    echo "❌ Bitcoin数据文件缺失"
fi

if [ -f "data/ethereum_etf_data/metadata.json" ]; then
    echo "✅ Ethereum数据文件存在" 
    ethereum_size=$(du -sh data/ethereum_etf_data | cut -f1)
    echo "   数据大小: $ethereum_size"
else
    echo "❌ Ethereum数据文件缺失"
fi

# 检查最近的数据更新
today=$(date +%Y-%m-%d)
if [ -f "data/bitcoin_etf_data/daily_$today.json" ]; then
    echo "✅ 今日Bitcoin数据已更新"
else
    echo "⚠️  今日Bitcoin数据未更新"
fi

if [ -f "data/ethereum_etf_data/daily_$today.json" ]; then
    echo "✅ 今日Ethereum数据已更新"
else
    echo "⚠️  今日Ethereum数据未更新"
fi

# 检查日志文件大小
log_size=$(du -sh logs | cut -f1)
echo "📋 日志目录大小: $log_size"
EOF

chmod +x scripts/health-check.sh
```

### 2. 数据备份脚本

```bash
# 创建备份脚本
cat > scripts/backup.sh << 'EOF'
#!/bin/bash

backup_dir="./backups/$(date +%Y-%m-%d)"
mkdir -p "$backup_dir"

echo "💾 开始数据备份..."
cp -r data "$backup_dir/"
cp -r logs "$backup_dir/"

# 压缩备份
tar -czf "$backup_dir.tar.gz" -C backups "$(date +%Y-%m-%d)"
rm -rf "$backup_dir"

echo "✅ 备份完成: $backup_dir.tar.gz"

# 清理7天前的备份
find backups -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x scripts/backup.sh
```

---

## 🔍 故障排除

### 常见问题

1. **PM2进程启动失败**
   ```bash
   # 查看详细错误
   pm2 logs webcrawl-etf --err
   
   # 重置PM2
   pm2 kill
   pm2 start ecosystem.config.js
   ```

2. **Cron任务不执行**
   ```bash
   # 检查cron服务状态
   sudo service cron status
   
   # 检查用户权限
   ls -la scripts/run-once.js
   ```

3. **数据文件损坏**
   ```bash
   # 恢复备份
   ./scripts/backup.sh
   
   # 重新初始化
   rm -rf data
   node app.js
   ```

4. **内存占用过高**
   ```bash
   # 检查内存使用
   pm2 monit
   
   # 调整PM2配置中的max_memory_restart
   ```

---

## 📈 推荐配置

### 生产环境推荐

1. **使用PM2** + **系统Cron备份**
2. **设置监控告警**
3. **定期数据备份**
4. **日志轮转**

### 配置示例

```bash
# 1. 启动PM2服务
./scripts/start.sh

# 2. 设置备份任务（每日凌晨2点）
echo "0 2 * * * cd /Users/easonyang/Data_WebcCrawl && ./scripts/backup.sh" | crontab -

# 3. 设置健康检查（每小时）
echo "0 * * * * cd /Users/easonyang/Data_WebcCrawl && ./scripts/health-check.sh" | crontab -
```

---

## 📞 总结

**推荐使用方案一（PM2）**，因为它提供了：
- 🚀 **最佳用户体验**：简单的启动和管理
- 🔄 **自动故障恢复**：进程崩溃自动重启
- 📊 **完整的监控**：实时查看状态和日志
- 🔧 **灵活配置**：可调整各种参数

这样，你的ETF数据爬虫系统就能**7x24小时稳定运行**，无需手动干预！ 