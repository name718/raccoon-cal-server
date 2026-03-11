# 浣熊卡路里（RaccoonCal）

一款AI驱动的游戏化饮食管理应用

## 项目概述

浣熊卡路里是一款面向年轻用户（18-35岁）的轻量级饮食记录应用，以AI拍照识别为核心，通过养成系游戏化体验降低用户记录负担，让健康管理变得有趣。

## 核心特性

- 🤳 **极简记录**：拍照即得卡路里，无需手动输入
- 🦝 **情感陪伴**：虚拟宠物（浣熊）以幽默方式反馈饮食
- 🎮 **正向激励**：游戏化任务鼓励健康行为
- 👥 **轻量社交**：好友PK和分享功能

## 技术栈

- **前端**: React Native
- **后端**: Express.js + Node.js
- **包管理**: pnpm (多包管理)
- **数据库**: MongoDB + Redis
- **云服务**: AWS/阿里云
- **AI识别**: LogMeal API / CalorieNinja API

## 项目结构

```
raccoon-cal/
├── packages/
│   ├── mobile/          # React Native 移动端
│   ├── server/          # Express 服务端
│   └── shared/          # 共享类型和工具
├── docs/               # 项目文档
├── scripts/            # 构建和部署脚本
└── package.json        # 根目录配置
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发环境
pnpm dev

# 构建项目
pnpm build
```

## 文档

- [产品需求文档](./docs/PRD.md)
- [技术设计文档](./docs/TECH_DESIGN.md)
- [API文档](./docs/API.md)
- [开发指南](./docs/DEVELOPMENT.md)

## 开发路线图

- [x] 项目初始化和架构设计
- [ ] 核心功能开发（第1个月）
- [ ] 游戏化系统（第2个月）
- [ ] 社交与优化（第3个月）

## 许可证

MIT License