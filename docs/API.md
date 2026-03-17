# API 接口文档

## 基础信息

- Base URL（开发）：`http://localhost:3000/api`
- 认证方式：`Authorization: Bearer <JWT token>`
- 请求/响应格式：JSON

## 通用响应格式

```typescript
interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code: string; message: string; details?: any };
  timestamp: string;
}
```

## 错误码

| 错误码                | HTTP | 说明             |
| --------------------- | ---- | ---------------- |
| `AUTH_REQUIRED`       | 401  | 未提供 Token     |
| `INVALID_TOKEN`       | 401  | Token 无效或过期 |
| `PERMISSION_DENIED`   | 403  | 权限不足         |
| `NOT_FOUND`           | 404  | 资源不存在       |
| `VALIDATION_ERROR`    | 400  | 参数验证失败     |
| `RATE_LIMIT_EXCEEDED` | 429  | 请求频率超限     |
| `INVALID_CAPTCHA`     | 400  | 验证码错误或过期 |
| `AI_TIMEOUT`          | 503  | 食物识别服务超时 |
| `INVALID_IMAGE`       | 400  | 图片格式不支持   |
| `INTERNAL_ERROR`      | 500  | 服务器内部错误   |

---

## 1. 验证码

### 生成验证码

`GET /captcha/generate`

```json
{
  "data": {
    "captchaId": "uuid",
    "captchaImage": "data:image/svg+xml;base64,..."
  }
}
```

验证码有效期 5 分钟，4 位字符，排除易混淆字符（0oO1iIl）。

### 验证验证码

`POST /captcha/verify`

```json
// 请求
{ "captchaId": "uuid", "captchaCode": "abcd" }

// 成功响应
{ "data": { "valid": true } }
```

---

## 2. 认证

### 注册

`POST /auth/register`

```json
// 请求（email 和 phone 至少提供一个）
{
  "username": "testuser",
  "password": "123456",
  "email": "user@example.com",
  "phone": "13800138000"
}

// 响应
{
  "data": {
    "user": { "id": 1, "username": "testuser", "email": "user@example.com" },
    "token": "eyJ..."
  }
}
```

### 登录

`POST /auth/login`

```json
// 请求（identifier 可以是用户名/邮箱/手机号）
{ "identifier": "testuser", "password": "123456" }

// 响应
{
  "data": {
    "user": { "id": 1, "username": "testuser", "emailVerified": false },
    "token": "eyJ..."
  }
}
```

### 获取当前用户

`GET /auth/me` 🔒

```json
{
  "data": {
    "user": { "id": 1, "username": "testuser", "email": "user@example.com" }
  }
}
```

---

## 3. 食物识别与记录 🔒

### 识别食物

`POST /food/recognize`

请求格式：`multipart/form-data`，字段名 `image`，支持 jpg/png/webp。

```json
// 响应
{
  "data": {
    "foods": [
      {
        "name": "炒饭",
        "calories": 350.0,
        "protein": 8.5,
        "fat": 12.0,
        "carbs": 52.0,
        "servingSize": 200.0
      }
    ],
    "confidence": 0.87
  }
}
```

识别失败（置信度 < 0.3）返回 `{ "foods": [], "confidence": 0 }`，不报错。

### 保存饮食记录

`POST /food/records`

```json
// 请求
{
  "foodName": "炒饭",
  "calories": 350.0,
  "protein": 8.5,
  "fat": 12.0,
  "carbs": 52.0,
  "servingSize": 200.0,
  "mealType": "lunch",
  "imageUrl": "https://..."
}
// mealType: breakfast | lunch | dinner | snack
```

保存成功后自动触发：XP +10、HP 检查、浣熊饱食度更新、打卡标记。

### 获取饮食记录

`GET /food/records?date=2026-03-17`

```json
{
  "data": [
    {
      "mealType": "lunch",
      "totalCalories": 350.0,
      "records": [
        {
          "id": 1,
          "foodName": "炒饭",
          "calories": 350.0,
          "recordedAt": "2026-03-17T12:00:00Z"
        }
      ]
    }
  ]
}
```

### 删除饮食记录

`DELETE /food/records/:id`

### 营养统计

`GET /food/stats?days=7`

```json
{
  "data": {
    "dailyCalories": [{ "date": "2026-03-17", "calories": 1850.0 }],
    "avgProtein": 65.2,
    "avgFat": 58.1,
    "avgCarbs": 220.5
  }
}
```

---

## 4. 游戏化状态 🔒

### 获取游戏化状态

`GET /gamification/status`

```json
{
  "data": {
    "totalXp": 1250,
    "level": 3,
    "weeklyXp": 180,
    "currentHp": 4,
    "streakDays": 7,
    "streakShields": 1,
    "xpToNextLevel": 350,
    "levelProgress": 0.78
  }
}
```

### 获取 XP 历史

`GET /gamification/history`

---

## 5. 浣熊宠物 🔒

### 获取浣熊状态

`GET /pet`

```json
{
  "data": {
    "name": "小R",
    "level": 3,
    "satiety": 65.0,
    "mood": "happy",
    "hatSlot": null,
    "clothSlot": null,
    "accessSlot": null,
    "unlockedOutfits": [],
    "levelHistory": [
      { "level": 2, "unlockedItem": null, "achievedAt": "2026-03-10T00:00:00Z" }
    ]
  }
}
```

mood 枚举：`happy | satisfied | normal | hungry | sad | missing`

### 触发互动

`POST /pet/interact`

每日一次，+XP（幂等）。

### 更换装扮

`PUT /pet/outfit`

```json
// 请求（null 表示清空该槽位）
{ "hatSlot": "hat_001", "clothSlot": null, "accessSlot": null }
```

### 获取已解锁装扮

`GET /pet/outfits`

---

## 6. 每日任务 🔒

### 获取今日任务

`GET /tasks/daily`

```json
{
  "data": [
    {
      "id": 1,
      "taskKey": "record_breakfast",
      "title": "记录早餐",
      "xpReward": 20,
      "completed": false
    },
    {
      "id": 2,
      "taskKey": "record_three_meals",
      "title": "记录三餐",
      "xpReward": 30,
      "completed": false
    },
    {
      "id": 3,
      "taskKey": "interact_pet",
      "title": "与浣熊互动",
      "xpReward": 15,
      "completed": true
    }
  ]
}
```

若当日无任务则自动生成（从任务池随机抽 3 条，不重复）。

### 触发任务完成检查

`POST /tasks/:id/complete`

---

## 7. 成就徽章 🔒

### 获取全部成就

`GET /achievements`

```json
{
  "data": [
    {
      "key": "streak_7",
      "title": "连续打卡 7 天",
      "description": "坚持记录 7 天",
      "xpReward": 50,
      "iconName": "streak_7",
      "unlocked": true,
      "unlockedAt": "2026-03-15T00:00:00Z"
    }
  ]
}
```

---

## 8. 联盟排行榜 🔒

### 获取当前联盟

`GET /league/current`

```json
{
  "data": {
    "tier": "bronze",
    "weeklyXp": 180,
    "rank": 5,
    "topMembers": [
      {
        "nickname": "用户A",
        "petAvatarMood": "happy",
        "weeklyXp": 420,
        "rank": 1
      }
    ]
  }
}
```

tier 枚举：`bronze | silver | gold | platinum | diamond`

### 获取上次结算结果

`GET /league/settlement`

```json
{
  "data": {
    "promoted": true,
    "demoted": false,
    "newTier": "silver",
    "finalRank": 3
  }
}
```

---

## 9. 个人资料 🔒

### 获取个人资料

`GET /profile`

### 更新个人资料

`PUT /profile`

```json
// 请求（所有字段可选）
{
  "nickname": "浣熊爱好者",
  "height": 170,
  "weight": 65.0,
  "goal": "lose_weight",
  "activityLevel": "moderate"
}
// goal: lose_weight | maintain | gain_muscle
// activityLevel: sedentary | light | moderate | active | very_active
```

保存后自动用 Harris-Benedict 公式重算每日卡路里目标。

### 记录体重

`POST /profile/weight`

```json
{ "weight": 64.5 }
```

### 获取体重历史

`GET /profile/weight-history`

---

## 10. 系统

### 健康检查

`GET /health`（无需认证）

```json
{
  "status": "ok",
  "timestamp": "2026-03-17T00:00:00.000Z",
  "uptime": 123.456,
  "database": "connected"
}
```

---

## 注意事项

- 🔒 标记的接口需要 `Authorization: Bearer <token>` 请求头
- 所有时间字段使用 ISO 8601 格式（UTC）
- 分页接口支持 `?page=1&limit=20` 查询参数
- 图片上传大小限制：10MB
