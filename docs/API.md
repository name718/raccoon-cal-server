# API 接口文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: Bearer Token (JWT)
- **请求格式**: JSON
- **响应格式**: JSON

## 通用响应格式

```typescript
interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

## 错误码说明

| 错误码                | HTTP状态码 | 说明             |
| --------------------- | ---------- | ---------------- |
| `AUTH_REQUIRED`       | 401        | 需要登录认证     |
| `INVALID_TOKEN`       | 401        | Token无效或过期  |
| `PERMISSION_DENIED`   | 403        | 权限不足         |
| `NOT_FOUND`           | 404        | 资源不存在       |
| `VALIDATION_ERROR`    | 400        | 请求参数验证失败 |
| `RATE_LIMIT_EXCEEDED` | 429        | 请求频率超限     |
| `INTERNAL_ERROR`      | 500        | 服务器内部错误   |

## 1. 认证接口

### 1.1 用户注册

**接口地址**: `POST /auth/register`

**请求参数**:

```json
{
  "username": "testuser", // 必填，用户名，3-20个字符，只能包含字母和数字
  "password": "123456", // 必填，密码，6-50个字符
  "email": "user@example.com", // 可选，邮箱地址
  "phone": "13800138000" // 可选，手机号，但email和phone至少提供一个
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "user@example.com",
      "phone": "13800138000",
      "createdAt": "2026-03-13T08:31:49.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-03-13T08:31:49.123Z"
}
```

### 1.2 用户登录

**接口地址**: `POST /auth/login`

**请求参数**:

```json
{
  "identifier": "testuser", // 必填，可以是用户名、邮箱或手机号
  "password": "123456" // 必填，密码
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "user@example.com",
      "phone": "13800138000",
      "emailVerified": false,
      "phoneVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-03-13T08:31:49.123Z"
}
```

### 1.3 检查登录状态 / 获取当前用户信息

**接口地址**: `GET /auth/me`

**请求头**:

```
Authorization: Bearer <token>
```

**成功响应**:

```json
{
  "success": true,
  "message": "获取用户信息成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "user@example.com",
      "phone": "13800138000",
      "emailVerified": false,
      "phoneVerified": false
    }
  },
  "timestamp": "2026-03-13T08:31:49.123Z"
}
```

**未登录响应**:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "需要登录认证"
  },
  "timestamp": "2026-03-13T08:51:38.555Z"
}
```

**Token无效响应**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token无效或已过期"
  },
  "timestamp": "2026-03-13T08:51:38.555Z"
}
```

**说明**:

- 此接口可用于检查用户是否已登录
- 前端可以在应用启动时调用此接口验证本地存储的token是否有效
- 如果token有效，返回用户信息；如果无效或过期，返回相应错误

## 2. 验证码接口

### 2.1 生成图形验证码

**接口地址**: `GET /captcha/generate`

**响应示例**:

```json
{
  "success": true,
  "message": "验证码生成成功",
  "data": {
    "captchaId": "35f4ff8f-d514-400e-8296-fc21afe46b5f",
    "captchaImage": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAsMCwxMjAsNDAiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4="
  },
  "timestamp": "2026-03-13T08:38:08.713Z"
}
```

**说明**:

- `captchaId`: 验证码唯一标识，用于后续验证
- `captchaImage`: Base64编码的SVG图片，可直接在前端显示
- 验证码有效期为5分钟
- 验证码为4位字符，忽略容易混淆的字符（0o1iIl）

### 2.2 验证图形验证码

**接口地址**: `POST /captcha/verify`

**请求参数**:

```json
{
  "captchaId": "35f4ff8f-d514-400e-8296-fc21afe46b5f", // 必填，验证码ID
  "captchaCode": "abcd" // 必填，用户输入的验证码
}
```

**成功响应**:

```json
{
  "success": true,
  "message": "验证码验证成功",
  "data": {
    "valid": true
  },
  "timestamp": "2026-03-13T08:38:16.920Z"
}
```

**失败响应**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CAPTCHA",
    "message": "验证码错误或已过期"
  },
  "timestamp": "2026-03-13T08:38:16.920Z"
}
```

### 2.3 获取验证码统计

**接口地址**: `GET /captcha/stats`

**响应示例**:

```json
{
  "success": true,
  "message": "获取验证码统计成功",
  "data": {
    "activeCaptchas": 0,
    "timestamp": "2026-03-13T08:38:23.667Z"
  },
  "timestamp": "2026-03-13T08:38:23.667Z"
}
```

## 3. 用户接口

待开发...

## 3. 食物识别接口

待开发...

## 4. 浣熊养成接口

待开发...

## 5. 社交功能接口

待开发...

## 6. 数据统计接口

待开发...

## 7. 通知接口

待开发...

## 8. 系统接口

### 8.1 健康检查

**接口地址**: `GET /health`

**响应示例**:

```json
{
  "status": "ok",
  "timestamp": "2026-03-13T08:31:49.123Z",
  "uptime": 123.456,
  "database": "connected"
}
```

## 测试示例

### 使用 curl 测试验证码接口

```bash
# 生成验证码
curl -X GET http://localhost:3000/api/captcha/generate

# 验证验证码
curl -X POST http://localhost:3000/api/captcha/verify \
  -H "Content-Type: application/json" \
  -d '{
    "captchaId": "your-captcha-id",
    "captchaCode": "abcd"
  }'

# 获取验证码统计
curl -X GET http://localhost:3000/api/captcha/stats
```

### 使用 curl 测试注册接口

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "123456",
    "email": "test@example.com"
  }'
```

### 使用 curl 测试登录接口

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "123456"
  }'
```

### 使用 curl 测试获取用户信息 / 检查登录状态

```bash
# 检查登录状态（未登录）
curl -X GET http://localhost:3000/api/auth/me

# 检查登录状态（已登录）
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-token>"

# 检查登录状态（token无效）
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid-token"
```
