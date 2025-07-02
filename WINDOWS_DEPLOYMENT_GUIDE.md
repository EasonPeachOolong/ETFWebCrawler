# ETF爬虫系统Windows完整部署指南

> 🚀 Windows系统从零开始部署Node.js ETF数据爬虫系统到生产环境

## 📋 部署环境要求

### 推荐系统配置
- **操作系统**: Windows 10 / Windows 11 / Windows Server 2016+
- **CPU**: 2核心或更多
- **内存**: 4GB或更多（Windows基础占用较多）
- **硬盘**: 30GB或更多（包含Windows和Chrome）
- **网络**: 稳定的互联网连接
- **权限**: 管理员权限（用于安装软件和配置服务）

---

## 🔧 第一步：系统环境准备

### 1. 启用必要的Windows功能

```powershell
# 以管理员身份运行PowerShell
# 启用Windows Subsystem for Linux (可选)
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# 启用Hyper-V (如果需要Docker)
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart
```

### 2. 安装包管理器 Chocolatey

```powershell
# 以管理员身份运行PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 验证安装
choco --version
```

### 3. 安装基础工具

```powershell
# 安装Git
choco install git -y

# 安装7-Zip (用于解压)
choco install 7zip -y

# 安装Chrome浏览器 (Puppeteer需要)
choco install googlechrome -y

# 安装Visual Studio构建工具 (一些npm包需要)
choco install visualstudio2022buildtools -y

# 安装Python (一些npm包需要)
choco install python -y

# 重新加载环境变量
refreshenv
```

---

## 📦 第二步：安装Node.js LTS

### 方法1：使用官方安装包（推荐）

```powershell
# 1. 访问Node.js官网下载LTS版本
# https://nodejs.org/

# 2. 下载Windows Installer (.msi)
# 选择LTS版本（如v18.19.0）

# 3. 运行安装包，选择以下选项：
#    - Add to PATH: 勾选
#    - npm package manager: 勾选
#    - Online documentation shortcuts: 可选
#    - Add to PATH environment variable: 勾选

# 4. 验证安装
node --version  # 应显示 v18.x.x 或更高
npm --version   # 应显示 9.x.x 或更高
```

### 方法2：使用Chocolatey

```powershell
# 安装Node.js LTS
choco install nodejs-lts -y

# 重新加载环境变量
refreshenv

# 验证安装
node --version
npm --version
```

### 方法3：使用NVM for Windows

```powershell
# 1. 下载nvm-windows
# https://github.com/coreybutler/nvm-windows/releases

# 2. 下载 nvm-setup.zip 并解压安装

# 3. 重新打开PowerShell
nvm install lts
nvm use lts

# 验证安装
node --version
npm --version
```

---

## 🏗️ 第三步：创建项目目录和配置

### 1. 创建项目目录

```powershell
# 创建项目根目录
mkdir C:\WebCrawl
cd C:\WebCrawl

# 创建应用目录
mkdir Data_WebcCrawl
cd Data_WebcCrawl
```

### 2. 上传项目文件

```powershell
# 方式1：使用Git克隆（如果有仓库）
git clone <your-git-repo-url> .

# 方式2：手动上传文件
# 将项目文件复制到 C:\WebCrawl\Data_WebcCrawl\

# 方式3：使用SCP或其他工具上传
# scp -r ./Data_WebcCrawl user@windows-server:C:\WebCrawl\
```

### 3. 安装项目依赖

```powershell
# 确保在项目目录
cd C:\WebCrawl\Data_WebcCrawl

# 安装依赖
npm install

# 如果遇到权限问题
npm install --unsafe-perm=true --allow-root

# 验证依赖安装
npm list --depth=0
```

### 4. 创建必要的目录

```powershell
# 创建数据和日志目录
mkdir data
mkdir logs
mkdir data\bitcoin_etf_data
mkdir data\ethereum_etf_data

# 设置目录权限（可选）
icacls data /grant Users:F
icacls logs /grant Users:F
```

---

## ⚙️ 第四步：配置环境变量

### 1. 创建环境配置文件

```powershell
# 创建 .env 文件
@"
# 环境设置
NODE_ENV=production

# 数据存储配置
DATA_PATH=./data
ENABLE_DATABASE=false

# 日志配置
LOG_LEVEL=info

# 请求配置
MIN_DELAY=2000
MAX_DELAY=5000
CONCURRENT_LIMIT=2
REQUEST_TIMEOUT=45000
REQUEST_RETRIES=3

# 定时任务配置（每日上午9点）
DAILY_CRON=0 0 9 * * *

# 反爬虫配置
ROTATE_USER_AGENT=true

# Windows特定配置
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# 代理配置（如果需要）
# PROXY_HOST=
# PROXY_PORT=
# PROXY_USERNAME=
# PROXY_PASSWORD=
"@ | Out-File -FilePath .env -Encoding UTF8
```

### 2. 设置系统环境变量

```powershell
# 设置Node.js环境变量
[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Machine")
[Environment]::SetEnvironmentVariable("PUPPETEER_SKIP_CHROMIUM_DOWNLOAD", "true", "Machine")

# 重新加载环境变量
$env:NODE_ENV = "production"
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
```

---

## 🔄 第五步：安装和配置PM2

### 1. 安装PM2

```powershell
# 全局安装PM2
npm install -g pm2

# 安装PM2的Windows服务支持
npm install -g pm2-windows-service

# 验证安装
pm2 --version
```

### 2. 配置PM2启动文件

创建Windows专用的PM2配置：

```powershell
# 创建 ecosystem.windows.config.js
@"
module.exports = {
  apps: [{
    name: 'webcrawl-etf',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Windows环境配置
    cwd: 'C:\\WebCrawl\\Data_WebcCrawl',
    
    // 自动重启配置
    autorestart: true,
    watch: false,
    max_memory_restart: '800M',  // Windows需要更多内存
    
    // 错误处理
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // 日志配置 - Windows路径
    log_file: 'C:\\WebCrawl\\Data_WebcCrawl\\logs\\pm2-combined.log',
    out_file: 'C:\\WebCrawl\\Data_WebcCrawl\\logs\\pm2-out.log',
    error_file: 'C:\\WebCrawl\\Data_WebcCrawl\\logs\\pm2-error.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    
    // Windows环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      PUPPETEER_EXECUTABLE_PATH: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    },
    
    // 开发环境
    env_development: {
      NODE_ENV: 'development',
      DEBUG: 'true'
    },
    
    // Windows特定配置
    windowsHide: true,
    
    // 定时重启 (每天凌晨4点)
    cron_restart: '0 4 * * *'
  }]
};
"@ | Out-File -FilePath ecosystem.windows.config.js -Encoding UTF8
```

### 3. 启动应用

```powershell
# 启动应用
pm2 start ecosystem.windows.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs webcrawl-etf

# 实时监控
pm2 monit
```

---

## 🛡️ 第六步：配置Windows服务

### 1. 安装PM2作为Windows服务

```powershell
# 以管理员身份运行PowerShell
pm2-service-install

# 或者手动创建服务
pm2 startup
pm2 save

# 验证服务安装
Get-Service | Where-Object {$_.Name -like "*PM2*"}
```

### 2. 配置服务自动启动

```powershell
# 设置服务为自动启动
Set-Service -Name "PM2" -StartupType Automatic

# 启动服务
Start-Service -Name "PM2"

# 检查服务状态
Get-Service -Name "PM2"
```

---

## 🔥 第七步：配置Windows防火墙和安全

### 1. 配置Windows防火墙

```powershell
# 允许Node.js应用通过防火墙
New-NetFirewallRule -DisplayName "Node.js ETF Crawler" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow

# 如果应用有Web界面，开放端口
New-NetFirewallRule -DisplayName "ETF Crawler Web" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow

# 查看防火墙规则
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*ETF*"}
```

### 2. 配置用户权限

```powershell
# 创建专用服务用户（可选）
$password = ConvertTo-SecureString "YourSecurePassword123!" -AsPlainText -Force
New-LocalUser -Name "webcrawl" -Password $password -Description "ETF爬虫服务用户"

# 添加到日志服务用户组
Add-LocalGroupMember -Group "Log on as a service" -Member "webcrawl"

# 设置目录权限
icacls "C:\WebCrawl" /grant "webcrawl:F" /T
```

---

## 📊 第八步：测试和验证

### 1. 功能测试脚本

```powershell
# 创建测试脚本 test-crawler.ps1
@"
# ETF爬虫功能测试脚本
Write-Host "🧪 开始ETF爬虫功能测试..." -ForegroundColor Green

# 切换到项目目录
Set-Location "C:\WebCrawl\Data_WebcCrawl"

# 测试Node.js和依赖
Write-Host "📦 检查Node.js版本..." -ForegroundColor Yellow
node --version
npm --version

Write-Host "📦 检查项目依赖..." -ForegroundColor Yellow
npm list --depth=0

# 手动执行一次爬取
Write-Host "🕷️ 执行测试爬取..." -ForegroundColor Yellow
node scripts/run-once.js

# 检查生成的数据
Write-Host "📁 检查生成的数据文件..." -ForegroundColor Yellow
Get-ChildItem -Path "data" -Recurse -File | Select-Object Name, Length, LastWriteTime

# 检查日志文件
Write-Host "📋 检查日志文件..." -ForegroundColor Yellow
Get-ChildItem -Path "logs" -File | Select-Object Name, Length, LastWriteTime

Write-Host "✅ 测试完成！" -ForegroundColor Green
"@ | Out-File -FilePath test-crawler.ps1 -Encoding UTF8

# 运行测试
powershell -ExecutionPolicy Bypass -File test-crawler.ps1
```

---

## 🔧 第九步：创建维护工具

### 1. PowerShell维护脚本

```powershell
# 创建维护脚本目录
mkdir C:\WebCrawl\Scripts

# 重启服务脚本 restart-crawler.ps1
@"
# ETF爬虫重启脚本
Write-Host "🔄 重启ETF爬虫服务..." -ForegroundColor Green
pm2 restart webcrawl-etf
pm2 status
Write-Host "✅ 服务重启完成" -ForegroundColor Green
"@ | Out-File -FilePath C:\WebCrawl\Scripts\restart-crawler.ps1 -Encoding UTF8

# 日志清理脚本 clean-logs.ps1
@"
# 日志清理脚本
Write-Host "🧹 清理旧日志文件..." -ForegroundColor Green
`$logPath = "C:\WebCrawl\Data_WebcCrawl\logs"
`$dataPath = "C:\WebCrawl\Data_WebcCrawl\data"

# 删除30天前的日志文件
Get-ChildItem -Path `$logPath -Filter "*.log" | Where-Object {`$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | Remove-Item -Force
Write-Host "已清理30天前的日志文件" -ForegroundColor Yellow

# 删除180天前的数据文件
Get-ChildItem -Path `$dataPath -Filter "*.json" -Recurse | Where-Object {`$_.LastWriteTime -lt (Get-Date).AddDays(-180)} | Remove-Item -Force
Write-Host "已清理180天前的数据文件" -ForegroundColor Yellow

Write-Host "✅ 日志清理完成" -ForegroundColor Green
"@ | Out-File -FilePath C:\WebCrawl\Scripts\clean-logs.ps1 -Encoding UTF8

# 状态检查脚本 check-status.ps1
@"
# 系统状态检查脚本
Write-Host "📊 ETF爬虫系统状态检查" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

Write-Host "PM2状态:" -ForegroundColor Yellow
pm2 status

Write-Host "`n最新数据文件:" -ForegroundColor Yellow
Get-ChildItem -Path "C:\WebCrawl\Data_WebcCrawl\data\*\daily_*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | Format-Table Name, LastWriteTime, Length

Write-Host "`n磁盘使用情况:" -ForegroundColor Yellow
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Used(GB)";Expression={[math]::Round((`$_.Size-`$_.FreeSpace)/1GB,2)}}, @{Name="Free(GB)";Expression={[math]::Round(`$_.FreeSpace/1GB,2)}}, @{Name="Total(GB)";Expression={[math]::Round(`$_.Size/1GB,2)}} | Format-Table

Write-Host "`n内存使用情况:" -ForegroundColor Yellow
Get-CimInstance -ClassName Win32_ComputerSystem | Select-Object @{Name="Total RAM (GB)";Expression={[math]::Round(`$_.TotalPhysicalMemory/1GB,2)}}
Get-Process -Name "node" -ErrorAction SilentlyContinue | Select-Object Name, @{Name="Memory(MB)";Expression={[math]::Round(`$_.WorkingSet/1MB,2)}} | Format-Table
"@ | Out-File -FilePath C:\WebCrawl\Scripts\check-status.ps1 -Encoding UTF8

# 设置脚本执行权限
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. 创建Windows计划任务

```powershell
# 创建定时清理任务
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\WebCrawl\Scripts\clean-logs.ps1"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -TaskName "ETF爬虫日志清理" -Description "每周清理ETF爬虫的旧日志文件"
```

---

## ✅ Windows部署完成检查清单

### 🔍 验证步骤

```powershell
# 1. 检查Node.js版本
node --version  # >= 16.0.0

# 2. 检查PM2状态
pm2 status      # webcrawl-etf 应该显示 online

# 3. 检查Windows服务
Get-Service | Where-Object {$_.Name -like "*PM2*"}

# 4. 检查日志输出
pm2 logs webcrawl-etf --lines 20

# 5. 检查数据生成
Get-ChildItem -Path "C:\WebCrawl\Data_WebcCrawl\data" -Recurse

# 6. 检查计划任务
Get-ScheduledTask | Where-Object {$_.TaskName -like "*ETF*"}

# 7. 手动执行测试
Set-Location "C:\WebCrawl\Data_WebcCrawl"
node scripts/run-once.js
```

### 📋 Windows特定配置确认

- ✅ Node.js LTS安装完成
- ✅ Chrome浏览器安装完成
- ✅ 项目依赖安装完成
- ✅ PM2进程管理配置完成
- ✅ Windows服务配置完成
- ✅ 防火墙规则配置完成
- ✅ 计划任务配置完成
- ✅ 维护脚本配置完成

---

## 🚨 Windows常见问题排查

### Q1: Node.js安装后找不到命令
```powershell
# 检查环境变量
$env:PATH -split ';' | Where-Object {$_ -like "*node*"}

# 手动添加Node.js到PATH
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Program Files\nodejs", "Machine")

# 重启PowerShell
```

### Q2: PM2在Windows服务模式下启动失败
```powershell
# 检查PM2服务日志
Get-EventLog -LogName Application -Source "PM2" -Newest 10

# 重新安装PM2服务
pm2 kill
npm uninstall -g pm2-windows-service
npm install -g pm2-windows-service
pm2-service-install
```

### Q3: Puppeteer无法找到Chrome
```powershell
# 手动指定Chrome路径
$env:PUPPETEER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# 验证Chrome路径
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Q4: 权限问题
```powershell
# 以管理员身份运行PowerShell
Start-Process PowerShell -Verb RunAs

# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

---

## 📞 Windows维护命令速查

```powershell
# 查看服务状态
pm2 status
Get-Service | Where-Object {$_.Name -like "*PM2*"}

# 重启服务
pm2 restart webcrawl-etf
Restart-Service -Name "PM2"

# 查看日志
pm2 logs webcrawl-etf
Get-EventLog -LogName Application -Source "PM2" -Newest 20

# 系统监控
Get-Process -Name "node"
C:\WebCrawl\Scripts\check-status.ps1

# 手动执行爬取
Set-Location "C:\WebCrawl\Data_WebcCrawl"
node scripts/run-once.js

# 清理日志
C:\WebCrawl\Scripts\clean-logs.ps1
```

---

## 🎯 Windows部署总结

### 💾 内存使用估算（Windows环境）
- **基础内存消耗**: ~150-250MB（Windows下Node.js占用更多）
- **Chrome实例**: ~200-400MB（Windows版Chrome占用更多）
- **系统开销**: ~100-200MB
- **总计**: 450-850MB

### 🔧 推荐配置
- **开发测试**: 4GB内存，PM2设置重启阈值800MB
- **生产环境**: 8GB内存，充足余量确保稳定运行

### 🚀 部署优势
- 完整的Windows服务集成
- 图形化管理界面支持
- 完善的日志和监控
- 自动重启和故障恢复
- 企业级安全配置

🎉 **Windows部署完成！您的ETF数据爬虫系统现在可以在Windows环境中稳定运行了！** 