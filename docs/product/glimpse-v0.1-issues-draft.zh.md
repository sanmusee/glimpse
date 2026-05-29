# Glimpse V0.1 Issues 草案

来源：

- `docs/product/glimpse-v0.1-prd.zh.md`
- `CONTEXT.md`
- `docs/adr/`

说明：

- 这是本地草案，尚未创建 GitHub Issues。
- 拆分原则是 tracer-bullet vertical slice：每个 issue 尽量形成一个可独立演示或验证的端到端闭环。
- 建议 label 使用当前仓库约定：`needs-triage`、`ready-for-agent`、`ready-for-human`。

## 总览

| # | Title | Type | 建议 label | Blocked by | 覆盖 User Stories |
|---|---|---|---|---|---|
| 0 | 搭建 SQL editor-first 应用骨架与空状态 | AFK | `ready-for-agent` | None | 20, 21, 22 |
| 1 | 配置全局 AI Provider 并支持流式测试请求 | AFK | `ready-for-agent` | 0 | 2, 3, 10, 11, 22 |
| 2 | 创建并保存 MySQL/TiDB 直连数据库连接 | AFK | `ready-for-agent` | 0 | 1, 3 |
| 3 | 打开连接后读取并刷新默认 schema catalog | AFK | `ready-for-agent` | 2 | 4, 5 |
| 4 | 建立 Query Session、SQL 草稿与会话恢复 | AFK | `ready-for-agent` | 0, 2 | 18, 19, 20 |
| 5 | 基于 catalog 自动发现候选表并展示可调整集合 | AFK | `ready-for-agent` | 1, 3, 4 | 6, 7 |
| 6 | 从自然语言生成 SQL 并流式写入编辑器 | AFK | `ready-for-agent` | 1, 4, 5 | 8, 10, 12, 20 |
| 7 | 基于当前 SQL 进行自然语言迭代修改 | AFK | `ready-for-agent` | 6 | 9, 10, 18 |
| 8 | 实现 Read-only Mode 手动执行门与 SQL 安全校验 | AFK | `ready-for-agent` | 2, 4, 6 | 12, 13, 14 |
| 9 | 展示基础结果表格并支持复制可见结果 | AFK | `ready-for-agent` | 8 | 15, 16, 19 |
| 10 | SQL 执行报错后使用 AI 修复当前 SQL | AFK | `ready-for-agent` | 1, 4, 8 | 10, 17, 18 |
| 11 | 管理 Query Session 历史列表与继续工作流 | AFK | `ready-for-agent` | 4, 6, 8, 10 | 18, 19, 20 |
| 12 | 补齐 V0.1 隐私、安全与范围防回归测试 | AFK | `ready-for-agent` | 1, 2, 3, 8, 10 | 3, 12, 13, 19 |

## Issue 0: 搭建 SQL editor-first 应用骨架与空状态

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: None  
**覆盖 User Stories**: 20, 21, 22

### 背景

V0.1 的主界面必须是 SQL editor-first，而不是 chat-first。用户首次打开时应直接进入主界面，并通过空状态配置 AI Provider 和第一个 Database Connection。应用也需要支持 Light、Dark、System 主题偏好。

### 范围

- 搭建 Tauri 2 + React + TypeScript + shadcn/ui + Tailwind 的最小应用骨架。
- 建立 SQL editor-first 主布局：主工作区预留 SQL editor 和结果区域，辅助区域预留 AI Assistant Panel。
- 实现 Empty State Setup：AI 未配置、数据库连接未配置时在主界面内提示。
- 实现 Light、Dark、System 主题偏好，并持久化到本地 SQLite。
- 不实现真实 AI 调用、数据库连接、SQL 执行或结果表格。

### 验收标准

- [ ] 用户启动应用后直接进入主界面，而不是 first-run wizard。
- [ ] 主界面以 SQL 编辑和结果区域为视觉中心，AI 辅助在支持区域。
- [ ] 未配置 AI 或数据库时，用户能看到对应空状态入口。
- [ ] 用户可以切换 Light、Dark、System 主题。
- [ ] 主题偏好重启后可以恢复。

### 测试建议

- UI 状态测试：首次启动空状态、主题切换、主题恢复。
- 前端组件测试：布局在无 AI 配置、无数据库连接、有配置占位状态下不崩溃。
- 本地存储测试：Theme Preference 写入和读取行为。

### 依赖关系

None - can start immediately.

## Issue 1: 配置全局 AI Provider 并支持流式测试请求

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 0  
**覆盖 User Stories**: 2, 3, 10, 11, 22

### 背景

V0.1 使用一份 Global AI Configuration，所有连接共用。AI Provider 需要兼容 OpenAI-compatible API，并支持流式响应。API key 属于 secret，必须存入 macOS Keychain。

### 范围

- 在设置/空状态中提供 Global AI Configuration 表单：`base_url`、`api_key`、`model`、`temperature`、`max_tokens`。
- 将非 secret 配置保存到 SQLite，将 `api_key` 保存到 Keychain。
- 提供一次手动“测试连接/测试模型”的流式请求。
- 展示 AI Request Failure，并允许用户手动重试。
- 不实现 SQL 生成 prompt，不实现模型 fallback，不实现自动重试。

### 验收标准

- [ ] 用户可以保存全局 AI 配置。
- [ ] SQLite 不保存明文 `api_key`。
- [ ] Keychain 中可以写入、读取和更新 AI API key。
- [ ] 测试请求可以以 Streaming AI Response 的方式显示。
- [ ] AI 请求失败时显示清晰错误，用户可以手动重试。
- [ ] 失败时不会自动重试，也不会 fallback 到其他模型。

### 测试建议

- Keychain 边界测试：保存后 SQLite 记录不含明文 key。
- AI client 测试：成功流式响应、失败响应、超时/网络错误。
- UI 测试：保存、加载、错误展示、手动重试。

### 依赖关系

- Issue 0

## Issue 2: 创建并保存 MySQL/TiDB 直连数据库连接

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 0  
**覆盖 User Stories**: 1, 3

### 背景

V0.1 支持多个 Direct Database Connection，但每个 Query Session 只绑定一个连接和一个 Default Database/Schema。数据库密码必须保存在 Keychain，SQLite 只保存非 secret 配置。

### 范围

- 提供创建、编辑、删除 Database Connection 的最小 UI。
- 支持 MySQL/TiDB 直连字段：连接名称、host、port、username、password、Default Database/Schema。
- 将连接名称、host、port、username、Default Database/Schema 保存到 SQLite。
- 将数据库密码保存到 macOS Keychain。
- 提供手动连接测试，并展示连接成功/失败。
- 不支持 SSH Tunnel、SSL 高级配置、堡垒机、跨连接查询。

### 验收标准

- [ ] 用户可以创建多个数据库连接配置。
- [ ] 用户可以选择或编辑 Default Database/Schema。
- [ ] 数据库密码不以明文保存在 SQLite。
- [ ] 连接测试成功时展示成功状态。
- [ ] 连接测试失败时展示数据库错误或网络错误。
- [ ] UI 不出现 SSH Tunnel、SSL 高级配置、堡垒机等 V0.1 范围外入口。

### 测试建议

- SQLite/Keychain 存储边界测试。
- 数据库连接测试：成功、认证失败、host 不可达、database/schema 不存在。
- UI 测试：多连接列表、创建、编辑、删除。

### 依赖关系

- Issue 0

## Issue 3: 打开连接后读取并刷新默认 schema catalog

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 2  
**覆盖 User Stories**: 4, 5

### 背景

Glimpse 的核心差异来自 Database Catalog Context。V0.1 只读取连接配置指定的单个 Default Database/Schema，打开/连接时读取一次并缓存，用户可以手动刷新。

### 范围

- 连接打开后读取 MySQL/TiDB metadata：database/schema、table、column、type、nullable、default、comment、primary key、unique index、normal index、index column order、create table DDL。
- 在对象/上下文区域展示 catalog 的表、字段和索引基础信息。
- 实现 catalog cache。
- 提供手动刷新按钮。
- 权限不足时展示 Metadata Permission Failure。
- 不读取账号可见的所有 database/schema。
- 不做后台轮询，不在每次 SQL 生成前强制刷新。

### 验收标准

- [ ] 打开连接后能读取 Default Database/Schema 的表列表。
- [ ] 用户可以查看某张表的字段和索引信息。
- [ ] 手动刷新会重新读取 catalog 并更新 UI。
- [ ] 权限不足时展示清晰错误，而不是把连接模型判定为无效。
- [ ] 不会读取非默认 database/schema 的 catalog。
- [ ] SQL 生成前不会隐式刷新 catalog。

### 测试建议

- metadata reader 测试：表、字段、索引、DDL 的解析。
- catalog scope 测试：只读取 Default Database/Schema。
- 权限失败测试。
- UI 测试：展示表/字段/索引、手动刷新状态。

### 依赖关系

- Issue 2

## Issue 4: 建立 Query Session、SQL 草稿与会话恢复

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 0, Issue 2  
**覆盖 User Stories**: 18, 19, 20

### 背景

V0.1 的工作单元是 Query Session，而不是全局聊天流。Query Session 应绑定一个 Database Connection 和 Default Database/Schema，并保存 SQL Draft、AI Conversation History、Execution Result Metadata 等工作上下文。

### 范围

- 创建 Query Session 数据模型和最小 UI 入口。
- 新建 session 时绑定一个 Database Connection 和 Default Database/Schema。
- 在 SQL 编辑区维护 SQL Draft，并持久化。
- 支持关闭/重启应用后恢复当前或最近 Query Session。
- 建立 AI Conversation History 和 Execution Result Metadata 的存储位置。
- 不持久化 Result Set 行数据。

### 验收标准

- [ ] 用户可以基于某个数据库连接创建 Query Session。
- [ ] Query Session 明确绑定一个连接和一个 Default Database/Schema。
- [ ] SQL Draft 编辑后可以自动或显式保存，并在重启后恢复。
- [ ] Query Session 可以保存 AI 对话历史占位结构和执行元信息结构。
- [ ] SQLite 中不保存 Result Set 行数据。

### 测试建议

- Query Session 创建、读取、更新、删除测试。
- SQL Draft 持久化和恢复测试。
- 单 session 单连接约束测试。
- Result Set 不持久化的回归测试。

### 依赖关系

- Issue 0
- Issue 2

## Issue 5: 基于 catalog 自动发现候选表并展示可调整集合

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 3, Issue 4  
**覆盖 User Stories**: 6, 7

### 背景

V0.1 支持 Auto Table Discovery：用户可以不手动选表，直接描述查询需求。Glimpse 可把 Default Database/Schema 的 Database Catalog Context 发给模型，得到 Candidate Table Set。候选表必须可见、可调整，但不要求阻塞式确认。

### 范围

- 基于当前 Query Session 和 catalog 构造 Auto Table Discovery 请求。
- 将 Default Database/Schema 的 catalog 作为允许的模型上下文发送。
- 解析模型返回的候选表集合。
- 在 UI 中展示 Candidate Table Set。
- 支持用户添加、移除候选表。
- 调整候选表后更新 Query Session 上下文。
- 不做业务术语库，不做多 schema 自动发现。

### 验收标准

- [ ] 用户输入自然语言查询需求后，可以触发候选表发现。
- [ ] 模型请求不包含数据库密码、AI API key、SSH key、样例数据或结果行。
- [ ] Candidate Table Set 在 UI 中可见。
- [ ] 用户可以添加或移除候选表。
- [ ] 候选表调整后 Query Session 上下文同步更新。
- [ ] 生成 SQL 前不要求用户阻塞式确认候选表。

### 测试建议

- prompt/context 构造测试：允许 catalog，排除 secrets 和结果行。
- candidate table parser 测试：正常返回、空返回、未知表返回。
- UI 测试：展示、添加、移除候选表。
- Query Session 更新测试。

### 依赖关系

- Issue 1
- Issue 3
- Issue 4

## Issue 6: 从自然语言生成 SQL 并流式写入编辑器

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 4, Issue 5  
**覆盖 User Stories**: 8, 10, 12, 20

### 背景

自然语言生成 SQL 是 V0.1 的核心能力。生成时应使用 Query Session、Candidate Table Set、Database Catalog Context 和用户输入，流式返回 SQL，并写入 SQL editor。生成后不能自动执行。

### 范围

- 在 AI Assistant Panel 中提供自然语言输入。
- 基于 Query Session 上下文和 Candidate Table Set 构造 SQL generation 请求。
- 流式展示生成过程。
- 将生成 SQL 写入 CodeMirror SQL editor。
- 保存 AI Conversation History 和 SQL Draft。
- 生成完成后显示手动执行入口，但不自动执行。
- 不生成 SQL Explanation。

### 验收标准

- [ ] 用户输入查询需求后可以生成 SQL。
- [ ] SQL 生成过程以流式形式展示。
- [ ] 生成结果进入 SQL editor。
- [ ] Query Session 保存用户请求、AI 响应和 SQL Draft。
- [ ] 生成 SQL 后不会自动执行。
- [ ] UI 不要求展示 SQL Explanation。

### 测试建议

- AI generation request 构造测试。
- streaming reducer/state 测试。
- SQL editor 写入测试。
- Manual Execution Gate 回归测试。
- AI Conversation History 持久化测试。

### 依赖关系

- Issue 1
- Issue 4
- Issue 5

## Issue 7: 基于当前 SQL 进行自然语言迭代修改

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 6  
**覆盖 User Stories**: 9, 10, 18

### 背景

真实 SQL 工作通常不是一次生成结束。V0.1 需要支持 SQL Iteration：用户基于当前 SQL 继续提出修改意图，例如加条件、改聚合、换排序、切换时间字段。

### 范围

- 在 AI Assistant Panel 中支持“修改当前 SQL”的自然语言输入。
- 请求上下文包含当前 SQL、Query Session、Candidate Table Set 和相关 catalog。
- 流式返回修改后的 SQL。
- 将修改后的 SQL 更新到 SQL editor。
- 保存本轮 AI Conversation History 和 SQL Draft。
- 不要求每次从零重新生成。

### 验收标准

- [ ] 用户可以基于当前 SQL 输入修改意图。
- [ ] 修改请求包含当前 SQL 和相关 schema 上下文。
- [ ] 修改结果以流式形式展示。
- [ ] 修改后的 SQL 更新到 editor。
- [ ] 修改历史保存在 Query Session 中。

### 测试建议

- SQL Iteration prompt/context 测试。
- streaming 状态测试。
- editor 更新测试。
- Query Session 历史追加测试。

### 依赖关系

- Issue 6

## Issue 8: 实现 Read-only Mode 手动执行门与 SQL 安全校验

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 2, Issue 4, Issue 6  
**覆盖 User Stories**: 12, 13, 14

### 背景

V0.1 只实现 Read-only Mode。SQL 执行必须由用户手动触发。写操作和结构变更必须 hard block；缺少 `LIMIT`、可能长时间运行或大结果集只作为 warning，不自动改写 SQL。

### 范围

- 建立 Execution Safety Mode 概念，V0.1 仅暴露 Read-only Mode。
- 在 SQL editor 中提供手动执行动作。
- 执行前校验 SQL：允许 `SELECT`、`WITH`、`EXPLAIN` 等只读语句；阻止写操作和结构变更语句。
- 对 query scale 风险展示 warning，不阻止只读执行。
- 执行只读 SQL 并返回执行状态、错误或结果元信息。
- 保存 Execution Result Metadata。
- 不自动执行 AI 生成 SQL。
- 不实现 Data Modification Mode 或 Full Access Mode。

### 验收标准

- [ ] AI 生成 SQL 后必须用户点击才会执行。
- [ ] `SELECT`、`WITH`、`EXPLAIN` 可以执行。
- [ ] `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、`CREATE` 被阻止。
- [ ] 缺少 `LIMIT` 时显示 warning，但不自动追加 `LIMIT`。
- [ ] 执行成功或失败都会保存 Execution Result Metadata。
- [ ] 执行模型保留未来新增安全模式的扩展点。

### 测试建议

- SQL validator 测试：允许、阻止、warning-only 场景。
- Manual Execution Gate 测试。
- 执行状态测试：running、success、error。
- Execution Result Metadata 持久化测试。

### 依赖关系

- Issue 2
- Issue 4
- Issue 6

## Issue 9: 展示基础结果表格并支持复制可见结果

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 8  
**覆盖 User Stories**: 15, 16, 19

### 背景

V0.1 需要展示只读查询结果，但不做高级 data grid，也不持久化 Result Set 行数据。用户应能复制 SQL、单元格、行或可见结果。

### 范围

- 实现 Basic Result Table：列头、行号、横向滚动。
- 展示当前执行返回的 Result Set。
- 支持复制单元格、行、可见结果，以及当前 SQL。
- 结果只保存在当前 UI 状态，不写入 Query Session 历史。
- 历史仅保存 Execution Result Metadata。
- 不做排序、筛选、固定列、CSV Export、结果快照。

### 验收标准

- [ ] 执行成功后能展示列头和行数据。
- [ ] 表格支持行号和横向滚动。
- [ ] 用户可以复制单元格、行、可见结果和 SQL。
- [ ] Query Session 历史不持久化 Result Set 行数据。
- [ ] 不出现 CSV 导出入口。

### 测试建议

- Result Table 渲染测试：空结果、普通结果、多列宽结果。
- 复制行为测试。
- Result Set 不持久化回归测试。
- Execution Result Metadata 保存测试。

### 依赖关系

- Issue 8

## Issue 10: SQL 执行报错后使用 AI 修复当前 SQL

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 4, Issue 8  
**覆盖 User Stories**: 10, 17, 18

### 背景

SQL Repair 是 V0.1 核心闭环的一部分。执行失败后，Glimpse 可以将 SQL、错误信息、数据库方言和相关 schema 发给模型修复，但不得发送连接密钥或结果行。

### 范围

- 在 SQL 执行失败状态下提供“修复 SQL”动作。
- 构造 SQL Repair Context：当前 SQL、错误信息、数据库方言、Candidate Table Set/相关 catalog。
- 流式展示修复过程。
- 将修复后的 SQL 写入 editor。
- 保存修复过程到 AI Conversation History。
- 不要求用户手动复制错误信息。

### 验收标准

- [ ] SQL 执行失败后用户可以触发 AI repair。
- [ ] repair 请求包含 SQL、错误信息、方言和相关 schema。
- [ ] repair 请求不包含数据库密码、API key、SSH key 或结果行。
- [ ] 修复结果流式展示并写入 SQL editor。
- [ ] Query Session 保存 repair 对话历史。

### 测试建议

- SQL Repair Context 构造测试。
- sensitive data exclusion 测试。
- streaming repair 状态测试。
- editor 更新和 Query Session 追加测试。

### 依赖关系

- Issue 1
- Issue 4
- Issue 8

## Issue 11: 管理 Query Session 历史列表与继续工作流

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 4, Issue 6, Issue 8, Issue 10  
**覆盖 User Stories**: 18, 19, 20

### 背景

用户需要回到之前的查询任务继续工作。Query Session 历史应展示 SQL 草稿、AI 对话摘要和执行元信息，但不展示或恢复已持久化的结果行，因为结果行不应持久化。

### 范围

- 提供 Query Session 历史列表。
- 支持打开历史 session 并恢复 SQL Draft、Candidate Table Set、AI Conversation History、Execution Result Metadata。
- 明确展示历史执行的成功/失败、时间、行数、错误信息等元数据。
- 支持删除单个 Query Session。
- 不实现全文搜索、标签、团队共享、云同步、private session。

### 验收标准

- [ ] 用户可以查看 Query Session 历史列表。
- [ ] 打开历史 session 后能恢复 SQL Draft 和 AI 对话。
- [ ] 历史中能看到执行元信息。
- [ ] 历史 session 不包含 Result Set 行数据。
- [ ] 用户可以删除单个 session。

### 测试建议

- Query Session 列表和恢复测试。
- 删除 session 测试。
- Result Set 不持久化回归测试。
- UI 状态测试：空历史、有历史、删除后刷新。

### 依赖关系

- Issue 4
- Issue 6
- Issue 8
- Issue 10

## Issue 12: 补齐 V0.1 隐私、安全与范围防回归测试

**Type**: AFK  
**建议 label**: `ready-for-agent`  
**Blocked by**: Issue 1, Issue 2, Issue 3, Issue 8, Issue 10  
**覆盖 User Stories**: 3, 12, 13, 19

### 背景

V0.1 的信任边界来自几条硬规则：不发送密钥到模型、不在 SQLite 保存明文 secret、不持久化 Result Set 行数据、不自动执行 AI 生成 SQL、不执行写操作或结构变更 SQL。这些规则需要集中防回归测试。

### 范围

- 增加模型上下文快照/结构测试，确保 secrets、样例数据、结果行不会进入 AI 请求。
- 增加 SQLite 存储检查，确保数据库密码和 AI API key 不以明文保存。
- 增加 Result Set 持久化回归测试。
- 增加 Manual Execution Gate 回归测试。
- 增加 Read-only Mode hard block 回归测试。
- 增加 V0.1 out-of-scope UI 入口检查：不出现 SSH Tunnel、CSV Export、SQL Explanation、SQL autocomplete、Team Sharing、Prompt Template Management 等入口。

### 验收标准

- [ ] 测试能证明 AI 请求不包含数据库密码、AI API key、SSH key、样例数据或结果行。
- [ ] 测试能证明 SQLite 不保存明文 secret。
- [ ] 测试能证明 Result Set 行数据不进入 Query Session 历史。
- [ ] 测试能证明 AI 生成 SQL 后不会自动执行。
- [ ] 测试能证明写操作和结构变更 SQL 被阻止。
- [ ] 测试能证明 V0.1 scope 外入口没有出现在 UI 中。

### 测试建议

- 使用单元测试覆盖 context builder、storage adapter、SQL validator。
- 使用 UI/integration 测试覆盖关键用户路径和范围外入口。
- 对 prompt/context payload 做结构断言，而不是依赖字符串片段。

### 依赖关系

- Issue 1
- Issue 2
- Issue 3
- Issue 8
- Issue 10

## 建议评审点

- 粒度：当前拆分偏 13 个中等大小 vertical slices，适合后续逐张转 GitHub Issues。
- 依赖：Issue 0 是 UI/app 基础；Issue 1/2/3 建立 AI 和 DB 上下文；Issue 4 建立 Query Session；后续围绕 SQL 工作流逐步闭环。
- HITL/AFK：当前全部标为 AFK，因为 PRD/CONTEXT/ADR 已经给出足够边界。Open Questions 中的 parser、timeout、token 压缩等问题建议在后续 `my-implementation-planner` 中解决，而不是在 issue 草案阶段阻塞拆分。
