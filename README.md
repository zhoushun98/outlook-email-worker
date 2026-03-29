# Outlook Email Worker

基于 Cloudflare Worker + D1 + Microsoft Graph 的 Outlook 邮件管理后台。

支持：
- 分组管理
- 账号管理（单个新增 / 批量导入 / 启停 / 编辑 / 删除）
- 收件箱邮件列表与详情读取
- 账号 Token 定时健康巡检

---

## 1. 技术栈

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Language**: TypeScript
- **Frontend**: 单文件 HTML/CSS/JS（内嵌在 Worker 中返回）
- **Mail API**: Microsoft Graph API（Refresh Token 换 Access Token）

---

## 2. 项目结构

```text
.
├── migrations/
│   └── 0001_init.sql          # D1 初始化表结构与索引
├── src/
│   ├── index.ts               # Worker 入口、路由分发、定时任务
│   ├── auth.ts                # 鉴权、CORS、统一 JSON 响应
│   ├── graph.ts               # Microsoft Graph 请求封装
│   ├── frontend.html          # 后台前端页面
│   └── routes/
│       ├── groups.ts          # 分组接口
│       ├── accounts.ts        # 账号接口
│       └── emails.ts          # 邮件接口
├── wrangler.toml              # Worker / D1 / Cron 配置
└── package.json
```

---

## 3. 快速开始（本地）

### 3.1 安装依赖

```bash
npm install
```

### 3.2 配置 API Token（必填）

所有 `/api/*` 接口（除 `/api/health`）都要求：

`Authorization: Bearer <API_TOKEN>`

本地配置：

```bash
wrangler secret put API_TOKEN
```

### 3.3 初始化本地 D1 数据库

```bash
npm run db:migrate:local
```

### 3.4 启动本地开发

```bash
npm run dev
```

默认访问本地 Worker 地址（wrangler dev 输出地址），打开根路径 `/` 即可进入后台页面。

---

## 4. 首次创建 / 更换 D1 数据库（可选）

如果你不是直接使用仓库中已有 `wrangler.toml` 里的 D1 配置：

1. 创建数据库
```bash
npm run db:create
```
2. 将返回的 `database_id` 填入 `wrangler.toml` 的 `[[d1_databases]]`
3. 远端执行迁移
```bash
npm run db:migrate:remote
```

---

## 5. 部署

```bash
npm run deploy
```

部署后会输出 Worker 线上地址。

---

## 6. 接口说明

统一响应格式：
- 成功：`{ success: true, ... }`
- 失败：`{ success: false, message }`

### 6.1 健康检查（免鉴权）

- `GET /api/health`

### 6.2 分组接口（需鉴权）

- `GET /api/groups`：分组列表（含每组账号数）
- `POST /api/groups`：新增分组
- `PUT /api/groups/:id`：更新分组
- `DELETE /api/groups/:id`：删除分组（`id=1` 默认分组不可删，删除时账号自动迁移到默认分组）

### 6.3 账号接口（需鉴权）

- `GET /api/accounts?group_id=<id>`：账号列表（列表会脱敏 `refresh_token`）
- `GET /api/accounts/:id`：账号详情（含完整 `refresh_token`）
- `POST /api/accounts`：新增账号
  - 单个新增：`email/client_id/refresh_token` 必填
  - 批量导入：`account_string`，格式为每行：
    - `邮箱----密码----client_id----refresh_token`
- `PUT /api/accounts/:id`：更新账号
- `DELETE /api/accounts/:id`：删除账号

### 6.4 邮件接口（需鉴权）

- `GET /api/emails/:email?top=20`：读取该账号收件箱列表
- `GET /api/emails/:email/:messageId`：读取邮件详情

---

## 7. 定时任务（Cron）

`wrangler.toml` 中配置：

```toml
[triggers]
crons = ["0 */6 * * *"]
```

含义：**每 6 小时执行一次**账号健康巡检。

逻辑：
- 扫描 `status='active'` 的账号
- 尝试使用 `refresh_token` 刷新 Access Token
- 刷新失败：账号状态更新为 `error`
- 刷新成功且返回新 `refresh_token`：自动写回数据库

注意：定时任务只做账号健康检查，不会自动拉取邮件到本地存储。

---

## 8. 安全与注意事项

- `API_TOKEN` 必须使用 `wrangler secret` 管理，不要写入代码库。
- 账号表包含敏感字段（如 `refresh_token`），注意 D1 访问权限控制。
- 当前 CORS 为 `*`，如果需要限制来源，可在 `src/auth.ts` 调整。
- 后台导出“完整格式”会包含 `refresh_token`，请谨慎使用与分发。

