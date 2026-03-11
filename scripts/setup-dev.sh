#!/bin/bash

# 浣熊卡路里开发环境设置脚本

echo "🦝 浣熊卡路里 - 开发环境设置"
echo "================================"

# 检查 Node.js 版本
echo ""
echo "📦 检查 Node.js 版本..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ 错误: 需要 Node.js 18 或更高版本"
  echo "   当前版本: $(node -v)"
  echo "   请访问 https://nodejs.org/ 下载最新版本"
  exit 1
fi
echo "✅ Node.js 版本: $(node -v)"

# 检查 pnpm
echo ""
echo "📦 检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
  echo "❌ 未找到 pnpm"
  echo "   正在安装 pnpm..."
  npm install -g pnpm
  if [ $? -ne 0 ]; then
    echo "❌ pnpm 安装失败"
    exit 1
  fi
fi
echo "✅ pnpm 版本: $(pnpm -v)"

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
pnpm install
if [ $? -ne 0 ]; then
  echo "❌ 依赖安装失败"
  exit 1
fi
echo "✅ 依赖安装完成"

# 设置 Git Hooks
echo ""
echo "🔧 设置 Git Hooks..."
pnpm prepare
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
echo "✅ Git Hooks 设置完成"

# 创建环境变量文件
echo ""
echo "🔧 创建环境变量文件..."

# 服务端环境变量
if [ ! -f "packages/server/.env" ]; then
  cat > packages/server/.env << 'EOF'
# 服务配置
NODE_ENV=development
PORT=3000
API_VERSION=v1

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/raccooncal
REDIS_URL=redis://localhost:6379

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 外部API配置
LOGMEAL_API_KEY=your-logmeal-api-key
LOGMEAL_API_URL=https://api.logmeal.es

# 文件上传配置
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=raccoon-cal-images
AWS_REGION=us-east-1

# 推送通知
FCM_SERVER_KEY=your-fcm-server-key

# 日志配置
LOG_LEVEL=debug
EOF
  echo "✅ 创建 packages/server/.env"
else
  echo "⏭️  packages/server/.env 已存在，跳过"
fi

# 移动端环境变量
if [ ! -f "packages/mobile/.env" ]; then
  cat > packages/mobile/.env << 'EOF'
# API配置
API_BASE_URL=http://localhost:3000/api/v1
WS_BASE_URL=ws://localhost:3000/v1/ws

# 第三方服务
SENTRY_DSN=your-sentry-dsn
ANALYTICS_KEY=your-analytics-key

# 构建配置
BUNDLE_ID=com.raccooncal.app
APP_NAME=RaccoonCal
EOF
  echo "✅ 创建 packages/mobile/.env"
else
  echo "⏭️  packages/mobile/.env 已存在，跳过"
fi

# 检查数据库
echo ""
echo "🗄️  检查数据库..."

# 检查 MongoDB
if command -v mongod &> /dev/null; then
  echo "✅ MongoDB 已安装"
else
  echo "⚠️  未找到 MongoDB"
  echo "   请访问 https://www.mongodb.com/try/download/community 下载安装"
fi

# 检查 Redis
if command -v redis-server &> /dev/null; then
  echo "✅ Redis 已安装"
else
  echo "⚠️  未找到 Redis"
  echo "   macOS: brew install redis"
  echo "   Linux: sudo apt-get install redis-server"
fi

# 完成
echo ""
echo "================================"
echo "✅ 开发环境设置完成！"
echo ""
echo "📝 下一步："
echo "   1. 配置环境变量文件（packages/server/.env 和 packages/mobile/.env）"
echo "   2. 启动 MongoDB: mongod"
echo "   3. 启动 Redis: redis-server"
echo "   4. 启动开发服务器: pnpm dev"
echo ""
echo "📚 更多信息请查看："
echo "   - docs/DEVELOPMENT.md - 开发指南"
echo "   - docs/EDITOR_SETUP.md - 编辑器配置"
echo ""
echo "🦝 祝你开发愉快！"
