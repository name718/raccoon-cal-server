# 技术设计文档：浣熊卡路里服务端

## 1. 系统架构概览

### 1.1 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │   Express API   │    │   External APIs │
│  (iOS/Android)  │◄──►│     Server      │◄──►│  (LogMeal/etc)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   MongoDB +     │
                       │     Redis       │
                       └─────────────────┘
```

### 1.2 技术栈选择

| 层级         | 技术选型             | 理由                                       |
| ------------ | -------------------- | ------------------------------------------ |
| **后端**     | Express.js + Node.js | 轻量级，成熟稳定，开发效率高               |
| **数据库**   | MongoDB              | 文档型数据库，适合用户数据和游戏化数据存储 |
| **缓存**     | Redis                | 高性能缓存，用于积分排行榜等实时数据       |
| **认证**     | JWT + Passport       | 无状态认证，支持多端登录                   |
| **文件存储** | AWS S3 / 阿里云OSS   | 云存储服务，用于用户头像和食物图片         |
| **包管理**   | pnpm                 | 高效的包管理工具，支持monorepo             |
| **部署**     | Docker + PM2         | 容器化部署，进程管理，易于扩展和维护       |

## 2. 项目结构设计

### 2.1 服务端项目结构

```
raccoon-cal-server/
├── packages/
│   ├── server/                 # Express 服务端
│   │   ├── src/
│   │   │   ├── controllers/    # 控制器层
│   │   │   ├── services/       # 业务逻辑层
│   │   │   ├── models/         # 数据模型
│   │   │   ├── routes/         # 路由定义
│   │   │   ├── middleware/     # 中间件
│   │   │   ├── utils/          # 工具函数
│   │   │   ├── config/         # 配置文件
│   │   │   └── app.ts          # 应用入口
│   │   ├── tests/              # 测试文件
│   │   ├── Dockerfile          # Docker配置
│   │   └── package.json        # 依赖配置
│   └── shared/                 # 共享类型和工具
│       ├── src/
│       │   ├── types/          # TypeScript类型定义
│       │   ├── constants/      # 常量定义
│       │   └── utils/          # 共享工具函数
│       └── package.json
├── docs/                       # 项目文档
├── scripts/                    # 构建和部署脚本
├── docker-compose.yml          # Docker编排
└── package.json                # 根目录配置
```

│ │ └── Pet.swift # 宠物模型 │ ├── Services/ # 网络和业务服务 │ │ ├──
APIService.swift # API服务 │ │ ├── CameraService.swift # 相机服务 │ │ └──
CoreDataService.swift # 本地数据服务 │ ├── Utils/ # 工具类 │ │ ├── Extensions/ #
Swift扩展 │ │ ├── Constants.swift # 常量定义 │ │ └── Helpers.swift # 辅助函数 │
└── Assets.xcassets/ # 图片和颜色资源 ├── server/ # Express服务端 │ ├── src/ │ │
├── controllers/ # 控制器 │ │ ├── models/ # 数据模型 │ │ ├──
routes/ # 路由定义 │ │ ├── services/ # 业务逻辑 │ │ ├── middleware/ # 中间件 │ │
└── utils/ # 工具函数 │ ├── tests/ # 测试文件 │ └── package.json ├──
docs/ # 项目文档 ├── scripts/ # 构建和部署脚本 └──
docker-compose.yml # 本地开发环境

````

## 3. 核心功能技术实现

### 3.1 拍照识别卡路里系统

待开发...

### 3.2 虚拟宠物养成系统

待开发...

### 3.3 社交功能实现

待开发...

## 4. 数据库设计

### 4.1 MongoDB 集合设计

待设计...

### 4.2 Redis 缓存设计

待设计...

## 5. API 设计规范

### 5.1 RESTful API 设计

待设计...

### 5.2 响应格式标准

```swift
// Swift 数据模型
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: APIError?
    let timestamp: String
}

struct APIError: Codable {
    let code: String
    let message: String
}
````

## 6. 性能优化策略

### 6.1 前端优化

- **图片压缩**：使用iOS原生ImageIO框架压缩拍照图片，减少上传时间
- **懒加载**：历史记录和排行榜使用SwiftUI LazyVStack实现分页加载
- **缓存策略**：使用Core Data本地缓存用户数据和浣熊状态
- **动画优化**：使用SwiftUI原生动画和Core Animation实现流畅动效

### 6.2 后端优化

- **API缓存**：Redis缓存频繁查询的数据
- **数据库索引**：为查询字段建立合适索引
- **图片CDN**：使用CDN加速图片访问
- **负载均衡**：支持水平扩展

## 7. 安全性设计

### 7.1 数据安全

- **图片处理**：上传的食物图片不保存原图，仅保存识别结果
- **数据加密**：敏感数据加密存储
- **访问控制**：JWT token认证，API访问权限控制

### 7.2 隐私保护

- **数据最小化**：只收集必要的用户数据
- **匿名化**：分析数据时去除个人标识
- **用户控制**：提供数据导出和删除功能

## 8. 监控与日志

### 8.1 应用监控

- **性能监控**：API响应时间、错误率
- **用户行为**：关键操作的埋点统计
- **系统资源**：CPU、内存、磁盘使用情况

### 8.2 日志管理

```swift
// Swift 日志格式标准
struct LogEntry: Codable {
    let timestamp: String
    let level: LogLevel
    let service: String
    let userId: String?
    let action: String
    let details: [String: Any]
    let requestId: String

    enum LogLevel: String, Codable {
        case info, warn, error
    }
}
```

## 9. 部署架构

### 9.1 容器化部署

```dockerfile
# Dockerfile for Express server
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 9.2 CI/CD 流程

```yaml
# GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      - name: Build iOS App
        run: |
          xcodebuild -project RaccoonCal.xcodeproj \
                     -scheme RaccoonCal \
                     -configuration Release \
                     -archivePath RaccoonCal.xcarchive \
                     archive
  deploy-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and Deploy Server
        run: |
          cd server
          npm install
          npm run build
          docker build -t raccoon-cal-server .
          # Deploy to cloud
```

## 10. 扩展性考虑

### 10.1 微服务架构演进

当用户量增长时，可以将单体应用拆分为：

- 用户服务 (User Service)
- 食物识别服务 (Food Recognition Service)
- 游戏化服务 (Gamification Service)
- 社交服务 (Social Service)

### 10.2 数据库分片

- 按用户ID进行水平分片
- 读写分离提升性能
- 使用分布式缓存

这个技术设计为浣熊卡路里提供了完整的技术实现方案，确保系统的可扩展性、性能和安全性。
