# Glimpse V0.1 PRD

## Problem Statement

技术人员在日常开发、测试、数据排查和策略分析中，经常知道自己想查什么，却会被 SQL 编写过程里的低效环节打断：需要反复翻表结构、确认字段含义、查看索引、拼写复杂查询、处理 SQL 方言差异、修复执行报错，再在 AI 聊天工具和数据库客户端之间来回复制。

通用 AI 聊天工具可以帮助写 SQL，但缺少数据库上下文；传统数据库 IDE 可以执行 SQL，但不会基于自然语言和当前 schema 自动辅助生成、修改和修复 SQL。Glimpse V0.1 要解决的核心问题是：让懂技术的用户在本地 macOS 工具里，基于真实数据库 catalog 快速完成“描述需求 -> 生成 SQL -> 修改 SQL -> 手动执行只读 SQL -> 查看结果 -> 修复报错”的闭环。

V0.1 不追求替代 DataGrip，也不做 ChatBI、BI 报表或企业语义层。它聚焦小而高频的开发者 SQL 工作流，在“自动”和“可控”之间取得平衡：AI 降低路径成本，开发者保留关键控制权。

## Solution

Glimpse V0.1 是一个本地 macOS AI SQL 客户端，采用 SQL editor-first 布局。用户配置全局 AI provider 和 MySQL/TiDB 数据库连接后，Glimpse 读取单个默认 database/schema 的 catalog 元数据，并允许把该 catalog 发送给用户配置的 OpenAI-compatible 模型，用于自动选表、SQL 生成、SQL 修改和报错修复。

用户可以直接输入自然语言查询需求，Glimpse 自动发现候选表并生成 SQL。候选表必须可见、可调整，但不要求用户阻塞式确认。AI 生成 SQL 后不会自动执行，用户必须手动点击执行。V0.1 只实现 Read-only Mode，允许执行 `SELECT`、`WITH`、`EXPLAIN` 等只读语句，阻止写操作和结构变更语句。

Glimpse 保存 Query Session、SQL 草稿、SQL 历史、AI 对话历史和执行元信息；查询结果只在 UI 展示，不持久化保存结果行。非秘密配置和工作历史存 SQLite，数据库密码和 AI API key 存 macOS Keychain。V0.1 是纯本地应用，不做 Glimpse 账号、云同步或远端历史服务。

## User Stories

1. 作为后端开发，我希望配置 MySQL/TiDB 连接并保存连接信息，以便后续快速打开同一个开发库或测试库。
2. 作为技术用户，我希望配置一份全局 OpenAI-compatible AI provider，以便不同数据库连接共用同一个模型配置。
3. 作为技术用户，我希望数据库密码和 AI API key 不以明文保存在 SQLite 中，以便本地工具不会扩大密钥泄露风险。
4. 作为技术用户，我希望连接数据库后自动读取当前默认 database/schema 的表、字段、注释和索引，以便 AI 生成 SQL 时不需要我手动复制 DDL。
5. 作为技术用户，我希望 catalog 在打开或连接时读取，并能手动刷新，以便我能控制何时更新 schema 上下文。
6. 作为技术用户，我希望直接输入自然语言查询需求后，Glimpse 自动发现候选表，以便我不必先在对象树里手动定位所有相关表。
7. 作为技术用户，我希望候选表可见且可调整，以便 AI 自动选择错误时我可以纠正上下文。
8. 作为技术用户，我希望基于自然语言生成 SQL，以便快速完成条件查询、聚合、排序、时间范围过滤、简单 join 和 top N 等常见查询。
9. 作为技术用户，我希望基于当前 SQL 继续用自然语言修改，以便把一次性生成变成可迭代的 SQL 工作流。
10. 作为技术用户，我希望 AI 生成、修改和修复 SQL 时采用流式输出，以便等待过程有即时反馈。
11. 作为技术用户，我希望 AI 请求失败后看到清晰错误并手动重试，以便避免工具自动重复请求或切换模型造成不可预期行为。
12. 作为技术用户，我希望 AI 生成 SQL 后必须由我手动点击执行，以便在执行前看到并确认 SQL。
13. 作为技术用户，我希望 V0.1 只执行只读 SQL，并阻止写操作或结构变更语句，以便降低误操作风险。
14. 作为技术用户，我希望缺少 `LIMIT` 或可能返回大结果时只看到警告，而不是被强制改写 SQL，以便保留开发者控制权。
15. 作为技术用户，我希望执行只读 SQL 后看到基础结果表格，以便检查查询结果。
16. 作为技术用户，我希望可以复制 SQL、单元格、行或可见结果，以便把结果带到其他工具或沟通场景。
17. 作为技术用户，我希望执行报错后可让 AI 基于 SQL、错误信息和 schema 修复，以便减少在数据库客户端和 AI 工具之间来回复制。
18. 作为技术用户，我希望 Query Session 保存 SQL 草稿、AI 对话和执行元信息，以便之后继续同一个查询任务。
19. 作为技术用户，我希望查询结果行默认不持久化，以便避免本地历史保存真实业务数据。
20. 作为技术用户，我希望主界面以 SQL 编辑器和结果表格为中心，以便 Glimpse 感觉像开发者 SQL 工具，而不是聊天应用。
21. 作为技术用户，我希望支持 Light、Dark、System 主题，以便融入我的日常开发环境。
22. 作为技术用户，我希望首次打开直接进入主界面，通过空状态完成 AI 和数据库配置，以便减少阻塞式 onboarding。

## Implementation Decisions

- 产品形态：V0.1 是本地 macOS App，不包含 Glimpse 账号、云同步、远端历史服务或团队空间。
- 技术栈：Tauri 2、Rust、React、TypeScript、shadcn/ui、Tailwind CSS、CodeMirror 6、SQLite、macOS Keychain。
- 数据库支持：V0.1 只支持 MySQL/TiDB 直连，不支持 SSH Tunnel、SSL 高级配置、堡垒机、StarRocks、PostgreSQL 或 ClickHouse。
- 连接模型：支持多个 saved Database Connection；每个 Query Session 绑定一个 Database Connection 和一个 Default Database/Schema。
- catalog 范围：只读取连接配置指定的单个 Default Database/Schema，不自动读取账号可见的所有库。
- catalog 刷新：连接或打开时读取一次并缓存；提供手动刷新；不做后台轮询，也不在每次生成 SQL 前强制刷新。
- 元数据内容：读取 database/schema、table、column name、column type、nullable、default value、column comment、primary key、unique index、normal index、index column order、create table DDL 等上下文。
- AI 配置：V0.1 使用一份 Global AI Configuration，包括 `base_url`、`api_key`、`model`、`temperature`、`max_tokens`；不支持 per-connection AI override。
- 模型上下文：允许发送 Database Catalog Context、Selected Table Context、SQL 文本、数据库方言、数据库错误信息；禁止发送数据库连接配置、密码、API key、SSH key、样例数据和查询结果行。
- 自动选表：V0.1 支持 Auto Table Discovery，可把 Default Database/Schema 的完整 catalog 发给模型；Candidate Table Set 必须展示给用户并允许调整，但不要求先确认再生成 SQL。
- SQL 生成与迭代：支持自然语言生成 SQL，也支持基于当前 SQL 的 SQL Iteration；不要求每次重新生成。
- AI 响应：SQL 生成、SQL Iteration、SQL repair 使用 Streaming AI Response；数据库查询结果不流式。
- AI 错误：AI Request Failure 只展示错误并支持用户手动重试；V0.1 不做自动重试或模型 fallback。
- 执行模式：V0.1 只实现 Read-only Mode，但执行模型需按 Execution Safety Mode 设计，为未来 Data Modification Mode 和 Full Access Mode 保留扩展点。
- 执行触发：AI 生成 SQL 后必须经过 Manual Execution Gate，由用户手动点击执行；不允许自动执行。
- SQL 校验：Read-only Mode 允许 `SELECT`、`WITH`、`EXPLAIN` 等只读语句，阻止 `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、`CREATE` 等写操作或结构变更语句。
- 查询规模控制：缺少 `LIMIT`、可能长时间运行或大结果集只做 warning；V0.1 不自动注入 `LIMIT`，不静默改写用户 SQL。
- 报错修复：允许把 SQL、错误信息、数据库方言和相关 schema 发送给模型修复；仍不发送连接密钥和结果行。
- 本地存储：SQLite 保存非秘密配置和工作历史，包括连接名称、host、port、Default Database/Schema、Query Session、SQL Draft、AI Conversation History、Execution Result Metadata、用户偏好。
- 密钥存储：macOS Keychain 保存数据库密码、AI API key，以及未来可能支持的 SSH key；SQLite 中不保存明文密钥。
- Query Session：作为 SQL 工作的一级概念，包含查询需求、绑定连接、Default Database/Schema、Candidate Table Set、SQL Draft、生成 SQL、AI Conversation History、执行尝试、Execution Result Metadata 和错误。
- 结果保存：Result Set 只在 UI 展示，不持久化；历史只保存执行 SQL、时间戳、耗时、行数、成功/失败状态、错误信息等元数据。
- 结果表格：V0.1 提供 Basic Result Table，包括列头、行号、横向滚动、复制单元格/行/可见结果；不做高级 data grid。
- 编辑器：CodeMirror 6 提供 Basic SQL Editor，包含 SQL 高亮和基础编辑体验；支持 Manual SQL Formatting；不做 SQL-aware autocomplete。
- UI 信息架构：采用 SQL Editor-first Layout，SQL 编辑器和查询结果是主工作区，AI Assistant Panel 承载自然语言请求、自动选表、SQL 生成、SQL 修改和修复。
- onboarding：不做独立首次设置向导；直接进入主界面，用 Empty State Setup 引导用户配置全局 AI 和第一个数据库连接。
- 主题：支持 Light、Dark、System Theme Preference。

## Testing Decisions

- 测试应优先验证外部可观察行为，不绑定内部实现细节。
- SQL 安全校验必须测试：允许只读语句，阻止写操作和结构变更语句，且 query scale 风险只产生 warning。
- Manual Execution Gate 必须测试：AI 生成 SQL 后不会自动执行，只有用户显式触发后才执行。
- Execution Safety Mode 建模必须测试：V0.1 默认/唯一可用模式为 Read-only Mode，同时代码结构应允许未来新增 Data Modification Mode 和 Full Access Mode。
- Database Connection 行为必须测试：支持多个连接配置，每个 Query Session 只能绑定一个连接和一个 Default Database/Schema。
- Catalog Refresh 必须测试：打开/连接时读取，手动刷新可更新；不应在每次生成前隐式刷新。
- Auto Table Discovery 必须测试：候选表来源于 Default Database/Schema catalog，Candidate Table Set 可见、可调整，且不需要阻塞式确认。
- 模型上下文构造必须测试：允许发送 catalog、SQL、错误信息；不得包含密码、API key、SSH key、结果行、样例数据。
- SQL Repair Context 必须测试：执行错误可进入修复请求，且保留敏感信息边界。
- 本地存储必须测试：SQLite 保存非秘密数据，Keychain 保存秘密；SQLite 记录不得包含明文数据库密码或 AI API key。
- Query Session 持久化必须测试：SQL 草稿、AI 对话、执行元信息可以恢复；Result Set 行数据不应被持久化。
- Basic Result Table 行为必须测试：展示列头、行号、横向滚动，并支持复制可见结果。
- AI Request Failure 必须测试：失败状态展示清晰，可手动重试，不自动重试或 fallback。
- Theme Preference 可做 UI 状态测试：Light、Dark、System 偏好能保存和恢复。
- 数据库访问、Keychain、AI provider 可通过接口边界 mock；SQL 校验、Query Session 状态和 prompt/context 构造应尽量走真实代码路径测试。
- 由于当前 repo 尚未有代码和测试框架，具体测试工具与层级需在技术设计阶段结合 Tauri/Rust/React 项目结构确定。

## Out of Scope

- 不做 DataGrip 替代品。
- 不做复杂数据库 IDE。
- 不做 ChatBI 或面向纯业务人员的自然语言查数平台。
- 不做 BI 报表系统。
- 不做企业指标平台。
- 不做复杂业务语义层或 Business Glossary。
- 不做 ER 图建模。
- 不做表结构设计和数据库迁移。
- 不做数据编辑能力。
- 不做 Data Modification Mode。
- 不做 Full Access Mode。
- 不执行写操作或结构变更 SQL。
- 不自动执行 AI 生成的 SQL。
- 不支持 SSH Tunnel、SSL 高级配置或堡垒机连接。
- 不支持跨连接查询。
- 不支持多个 database/schema 的 catalog 范围。
- 不支持 StarRocks、PostgreSQL、ClickHouse。
- 不做 SQL Explanation。
- 不做 SQL-aware 自动补全。
- 不做 CSV Export。
- 不持久化 Result Set 行数据。
- 不做 Prompt Template Management。
- 不做 Team Sharing。
- 不做 Glimpse 账号。
- 不做云同步。
- 不做远端历史服务。
- 不做模型自动重试或 fallback。
- 不做用户可管理的 Prompt 模板。

## Open Questions

- Read-only SQL 校验使用 Rust SQL parser、sqlglot 绑定、还是先用保守 parser/规则组合，需技术设计确认。
- MySQL/TiDB `WITH`、`EXPLAIN`、多语句、注释、存储过程调用等边界如何分类，需要在 SQL validator 设计中细化。
- 查询执行是否需要 V0.1 明确 timeout 和取消能力：当前已确认不强制查询规模限制，但执行状态和长查询交互仍需技术设计明确。
- Basic Result Table 对大结果集的前端渲染上限、内存上限和复制上限需技术设计确认。
- Query Session 的历史保留策略、清理入口、最大存储大小尚未确认。
- AI Conversation History 是否允许用户一键清空、按 session 删除、或进入 private session，尚未确认。
- Database Catalog Context 在 prompt 中的压缩方式、token 上限处理、超大 schema 行为尚未确认。
- Candidate Table Set 调整后是否自动重新生成 SQL，还是由用户手动触发重新生成，尚未确认。
- AI provider 的连接测试、模型列表获取、流式协议兼容策略尚未确认。
- MySQL/TiDB metadata 读取需要的最小权限、权限不足错误文案和恢复建议尚未细化。
- V0.1 打包、签名、公证、自动更新是否纳入首版交付范围，尚未确认。

## Further Notes

- V0.1 的核心产品原则是“程序员控制，AI 辅助”：AI 可以自动发现候选表、生成 SQL、修改 SQL、修复 SQL，但执行必须可见、可审阅、由用户触发。
- V0.1 相比原始 PDF 有几处明确范围变化：加入 Auto Table Discovery、加入内置 Read-only SQL Execution、移除 V0.1 SQL Explanation、保留 SQL Iteration 和 SQL Repair。
- 早期 ADR 中部分描述反映当时决策阶段，最终 PRD 以 `CONTEXT.md` 和 `docs/product/v0.1-boundaries.zh.md` 的最新边界为准。
- 未来能力包括 Data Modification Mode、Full Access Mode、SSH Tunnel/SSL/堡垒机连接增强、SQL Explanation、SQL-aware autocomplete、CSV Export、Prompt Template Management、Team Sharing、Business Glossary、多 database/schema catalog 支持。

## 建议拆分的 Epic / Feature

- App shell 与基础工程：Tauri 2、React、TypeScript、shadcn/ui、Tailwind、主题偏好。
- 本地存储与密钥：SQLite schema、Keychain 集成、配置/历史持久化。
- 全局 AI 配置：OpenAI-compatible provider 设置、流式请求、失败展示、手动重试。
- 数据库连接管理：MySQL/TiDB 直连、多连接配置、默认 database/schema、连接测试。
- Catalog 读取与刷新：metadata reader、catalog cache、手动刷新、权限失败处理。
- Query Session：session 数据模型、SQL Draft、AI Conversation History、Execution Result Metadata。
- Auto Table Discovery：catalog prompt 构造、Candidate Table Set 展示与调整。
- SQL 生成与 SQL Iteration：自然语言生成、基于当前 SQL 修改、流式 UI。
- SQL 安全校验与 Execution Safety Mode：Read-only Mode、hard block、warning-only scale risks、未来模式扩展点。
- 手动执行与结果展示：Manual Execution Gate、执行状态、Basic Result Table、复制结果。
- SQL Repair：错误捕获、SQL Repair Context、修复流式响应。
- SQL 编辑器：CodeMirror 6、高亮、基础编辑、手动格式化。
- Empty State Setup 与主界面：SQL editor-first layout、AI Assistant Panel、空状态配置引导。
