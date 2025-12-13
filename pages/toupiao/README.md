# Strawpoll 在线投票系统

这是一个基于Cloudflare Workers和D1数据库的在线投票系统，提供了完整的投票创建、参与和管理功能。

## 功能特点

### 投票创建与管理
- ✅ 创建单选或多选投票
- ✅ 设置投票描述
- ✅ 添加自定义选项（至少2个）
- ✅ 支持IP限制和每日限制
- ✅ 允许匿名投票
- ✅ 查看、编辑和删除投票
- ✅ 分享投票链接

### 投票参与
- ✅ 浏览所有可用投票
- ✅ 参与投票（单选/多选）
- ✅ 查看实时投票结果
- ✅ 结果可视化展示

## 文件结构

```
E:\git-main\game-guide-\pages\toupiao\
├── index.html          # 投票系统主页面
├── manage-votes.html   # 投票管理页面
├── view-vote.html      # 查看和参与投票页面
└── README.md           # 说明文档
```

## 后端API说明

### 初始化投票表
- **端点**: GET /init-votes
- **功能**: 创建votes和vote_records表

### 创建投票
- **端点**: POST /votes
- **参数**:
  - title: 投票标题（必填）
  - description: 投票描述
  - options: 选项数组（必填，至少2个）
  - is_multiple: 是否允许多选（默认false）
  - allow_anonymous: 是否允许匿名（默认false）
  - ip_limit: 是否启用IP限制（默认false）
  - daily_limit: 是否启用每日限制（默认false）

### 获取所有投票
- **端点**: GET /votes
- **功能**: 获取所有投票列表

### 获取单个投票
- **端点**: GET /votes/:id
- **功能**: 获取指定投票的详细信息

### 更新投票
- **端点**: PUT /votes/:id
- **参数**: 同创建投票

### 删除投票
- **端点**: DELETE /votes/:id
- **功能**: 删除指定投票及其所有记录

### 提交投票
- **端点**: POST /votes/:id/submit
- **参数**:
  - option_ids: 选项ID数组（必填）

### 获取投票结果
- **端点**: GET /votes/:id/results
- **功能**: 获取指定投票的结果统计

## 使用说明

### 1. 部署后端

将`index.js`部署到Cloudflare Workers，并配置D1数据库。

### 2. 配置API地址

在前端页面（`manage-votes.html`, `view-vote.html`）中修改API_BASE_URL：

```javascript
const API_BASE_URL = 'https://your-worker-url.workers.dev';
```

### 3. 访问投票系统

- 主页面: `http://localhost:3000/pages/toupiao/index.html`
- 管理投票: `http://localhost:3000/pages/toupiao/manage-votes.html`
- 参与投票: `http://localhost:3000/pages/toupiao/view-vote.html`

## 注意事项

1. 确保已正确配置Cloudflare Workers和D1数据库
2. 首次使用时，需要访问任意投票页面触发数据库表的创建
3. 投票链接格式: `http://localhost:3000/pages/toupiao/view-vote.html?id=VOTE_ID`
4. 所有API返回统一格式: `{ errno: 0, data: ... }` 或 `{ errno: 1, errmsg: '错误信息' }`

## 技术栈

- **前端**: HTML5, CSS3, JavaScript
- **后端**: Cloudflare Workers
- **数据库**: Cloudflare D1

## 浏览器兼容性

支持所有现代浏览器（Chrome, Firefox, Safari, Edge）。
