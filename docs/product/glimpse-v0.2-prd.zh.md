# Glimpse V0.2 PRD

## Problem Statement

Glimpse V0.1 已经具备 SQL Editor-first、Database Connection、Query Session、AI 配置、只读 SQL 执行和 Result Set 展示等基础能力，但主界面仍偏“功能表单原型”，连接管理、SQL 工作区、console 切换、AI 对话和结果展示之间的关系不够像一个真实可长期使用的 SQL Workbench。

V0.2 需要把产品体验推进到更接近开发者数据库客户端的形态：左侧以数据库连接为入口，中间专注 SQL 编辑和执行，右侧支持 console 与 AI 对话切换，底部稳定展示当前 console 的查询结果。

## Solution

V0.2 将 Glimpse 主界面重构为更明确的 Workbench：

- 左侧：`Database Connection Tree`，第一层展示 saved Database Connections，可展开到 Default Database/Schema 和 tables。
- 中间：当前 active `SQL Console` 的 SQL Editor，顶部提供 Run 操作。
- 右侧：顶部 `Right-side Content Switcher`，可切换 `SQL Console List` 与 `AI Conversation View`。
- 底部：当前 active SQL Console 的最近一次 `Active Console Result Set`。
- 配置入口通过弹窗收敛：Data Source Management、Model Provider Management、Preferences。
- 页面全局不滚动，各子区域内部滚动。

## User Stories

1. 作为 technical user，我希望在左侧 Database Connection Tree 中看到 saved Database Connections，以便先选择数据库上下文再写 SQL。
2. 作为 technical user，我希望展开连接后看到 Default Database/Schema 和 tables，以便快速确认可用表而不用进入完整数据库 IDE 对象树。
3. 作为 technical user，我希望通过 Data Source Management Dialog 创建和编辑 Database Connections，以便在一个地方管理数据源。
4. 作为 technical user，我希望配置多个 OpenAI-compatible Model Providers，以便在 OpenAI、DeepSeek、Ollama、内部网关等 provider 之间切换。
5. 作为 technical user，我希望设置一个 Default Model Provider，以便 AI SQL 能力使用可预测的模型配置。
6. 作为 technical user，我希望 Model Provider 不绑定 Database Connection，以便数据库访问和模型策略保持独立。
7. 作为 technical user，我希望从当前选中的 Database Connection 创建 SQL Console，以便每个 SQL 工作区都有清晰连接归属。
8. 作为 technical user，我希望双击 Database Connection 可打开最近 SQL Console，没有则创建一个，以便快速开始 SQL 工作。
9. 作为 technical user，我希望右侧可以切换 SQL Console List 和 AI Conversation View，以便 console 切换和 AI 帮助都靠近 SQL 工作区。
10. 作为 technical user，我希望 SQL Console List 可以切换 active SQL Console，以便中间 SQL Editor 和底部 Result Set 跟随当前 console。
11. 作为 technical user，我希望 AI Conversation View 像 Cursor 一样上方展示对话记录、下方提供输入框，以便围绕当前 SQL 任务持续对话。
12. 作为 technical user，我希望 AI Conversation History 绑定 active SQL Console，以便不同连接和 SQL 任务不会混进一个全局聊天。
13. 作为 technical user，我希望无选区时 Run 执行 cursor 所在完整 SQL statement，而不是当前视觉行或整个编辑器，以便多行 SQL 可正确执行。
14. 作为 technical user，我希望选中多条 SQL 时按顺序执行 selected statements，以便批量跑一组只读查询。
15. 作为 technical user，我希望 selected statements 遇到第一条失败就停止，以便失败点清晰，后续 SQL 不会在未知状态下继续执行。
16. 作为 technical user，我希望底部结果区只展示 active SQL Console 的最近一次 Result Set，以便查询闭环简单清楚。
17. 作为 technical user，我希望 Theme Preference 和未来偏好设置进入 Preferences Dialog，以便主界面不被偏好表单占用。
18. 作为 technical user，我希望工具栏只保留已定义行为的关键入口，以便界面稳定、没有装饰性或不可用按钮。
19. 作为 technical user，我希望 V0.2 仍只支持 Direct MySQL/TiDB Connection，以便先把核心 SQL Workbench 体验做扎实。

## Implementation Decisions

- V0.2 左侧主导航采用 `Database Connection Tree`，不再以 Query Session history 作为左侧第一层。
- `Database Connection Tree` 第一层是 saved Database Connections；展开后展示该连接的 Default Database/Schema 和 table list。
- V0.2 不要求在左侧 tree 中展示字段、索引、存储过程或完整 database object explorer。
- `SQL Console` 是 connection-scoped `Query Session` 的 UI 形态。现有 Query Session 概念继续承载 SQL Draft、AI Conversation History、Execution Result Metadata 和错误信息。
- 一个 Database Connection 可以拥有多个 SQL Consoles。
- `New Console Command` 以当前选中的 Database Connection 为上下文。没有选中连接时，不应创建 connectionless console。
- 双击 Database Connection 时，打开该连接最近的 SQL Console；如果不存在 console，则创建一个。
- 右侧区域顶部提供 `Right-side Content Switcher`，初始支持 `SQL Console List` 和 `AI Conversation View` 两个 view。
- `SQL Console List` 负责展示 created SQL Consoles，并切换 active SQL Console。选中 console 后，中间 SQL Editor 和底部 Result Set 同步切换。
- `AI Conversation View` 采用 Cursor-style 布局：上方 conversation history，下方 input box。
- `AI Conversation View` 绑定 active SQL Console；切换 console 时，右侧可见 AI Conversation History 也随之切换。
- V0.2 从 V0.1 单个 Global AI Configuration 演进为 `Model Provider Registry`，支持多个 saved OpenAI-compatible Model Provider records。
- `Default Model Provider` 是 AI SQL 能力默认使用的 provider；Database Connections 不保存 per-connection provider override。
- Data Source Management 和 Model Provider Management 都采用统一管理弹窗：左侧 list，右侧 create/edit form；点击 add 打开空表单；保存后刷新列表并选中 saved item。
- `Preferences Dialog` 承载 Theme Preference 和未来偏好设置；主界面不再常驻偏好设置面板。
- V0.2 固定 toolbar entry points 收敛为 Data Source Management、Model Provider Management、New Console、Preferences 和 SQL Run。
- SQL Run 行为定义为：
  - 没有选区：`Run Current Statement`，执行 cursor 所在完整 statement；
  - 有选区：`Run Selected Statements`，按顺序执行 selection 中的 statements；
  - selected statements 遇到第一条失败即停止。
- 执行按钮不应默认执行整个 SQL Console，除非用户显式选中了整个 console text，或未来新增单独命令。
- 底部结果区展示 `Active Console Result Set`，即 active SQL Console 最近一次执行产生的 Result Set 或错误状态。
- V0.2 不引入 multiple persistent result tabs，不持久化 result rows。
- Execution Result Metadata 仍可保存到 Query Session，用于历史、错误、repair context 等场景。
- V0.2 继续限定 Database Connection 支持范围为 Direct MySQL/TiDB Connection，不扩展 PostgreSQL、SSH Tunnel、SSL 高级配置或堡垒机。
- 主页面全局不出现页面级滚动条；左侧 tree、中间 editor、右侧 view、底部 result table 等子区域根据自身内容滚动。

## Testing Decisions

- 测试应验证用户可观察行为，不绑定内部组件拆分细节。
- App shell 测试应验证 V0.2 workbench landmarks：left Database Connection Tree、center SQL editor、right content switcher、bottom result area。
- Layout 测试应覆盖全局无页面滚动、子区域可滚动的基本结构约束。
- Data Source Management Dialog 测试应覆盖 left list、right form、add opens empty form、edit existing connection、save refreshes list and selects saved item。
- Data Source secret 测试应继续覆盖 database password 不进入 non-secret metadata。
- Model Provider Registry 测试应覆盖 multiple provider records、default provider selection、API key secret handling、no per-connection provider binding。
- Preferences Dialog 测试应覆盖 Theme Preference 的展示、保存和恢复。
- Database Connection Tree 测试应覆盖 connection first-level rendering、expand to Default Database/Schema、render table list、no field-level tree requirement。
- SQL Console 测试应覆盖 selected connection 创建 console、double-click connection opens latest or creates one、console switching updates active SQL Draft and result view。
- Right-side Content Switcher 测试应覆盖 SQL Console List 和 AI Conversation View 切换，且切换右侧 view 不替换 center SQL editor 或 bottom Result Set。
- AI Conversation View 测试应覆盖 conversation history scoped to active SQL Console；切换 console 后展示对应 console 的 conversation history。
- SQL execution 测试应覆盖 current-statement extraction、selected-statement splitting、ordered execution、stop-on-first-failure。
- SQL execution safety 测试应继续复用 Read-only Mode 约束：只读语句允许，写操作和结构变更阻止。
- Result view 测试应覆盖只展示 active console latest Result Set，切换 console 后 result view 跟随 console；旧 Result Set 不作为 persistent tabs 恢复。
- 可通过接口边界 mock database execution、AI provider 和 secret store；statement selection/splitting、execution ordering、state ownership 应尽量走真实代码路径测试。

## Out of Scope

- 不做 DataGrip 替代品。
- 不做完整数据库 IDE object explorer。
- 不做左侧字段级、索引级、procedure 级 browsing。
- 不支持 PostgreSQL、StarRocks、ClickHouse 或其他新 database types。
- 不支持 SSH Tunnel、advanced SSL、bastion-host workflows。
- 不做 per-connection Model Provider configuration。
- 不做 multiple persistent result tabs。
- 不持久化 Result Set rows。
- 不做 CSV Export。
- 不做 SQL autocomplete。
- 不做装饰性 DataGrip-style toolbar buttons。
- 不做 DDL/table-view/sync 等未定义行为入口。
- 不做 write SQL execution。
- 不做 Data Modification Mode 或 Full Access Mode。
- 不做 Glimpse cloud account、cloud sync、remote query history。
- 不做 Team Sharing、Prompt Template Management、Business Glossary。
- 不把 AI Conversation 做成 full-screen chat-first workspace。

## Open Questions

- SQL Console 默认命名规则待确认，例如 `console [connection-name]`、递增序号或用户可重命名。
- 关闭 SQL Console 时是否需要确认未保存 SQL Draft，待技术设计前确认。
- AI Conversation View 的首批 AI 操作范围待确认：自由对话、生成 SQL、修改 SQL、修复 SQL 是否全部进入 V0.2。
- AI Conversation 输入后如何把生成/修改后的 SQL 应用到 SQL Editor，待技术设计确认。
- Statement boundary detection 的具体 SQL parser、CodeMirror integration 或轻量规则策略待技术设计确定。
- selected statements 的执行进度展示方式待确认，例如逐条状态、最终摘要或只展示失败点。
- 表列表的 catalog refresh 入口是否进入 V0.2，待实现计划阶段确认。
- 右侧 SQL Console List 是否允许新建 console 按钮；如果保留，必须依赖当前 selected connection 或 active console 的 connection。
- SQL Console 是否需要 close、rename、pin 等操作，待设计阶段确认。

## Further Notes

- V0.2 的核心不是扩数据库类型或执行权限，而是把现有 Glimpse 能力组织成更稳定、更像真实 SQL Workbench 的工作台体验。
- V0.2 信息架构以“connection -> console -> editor/result/AI conversation”为主线。Database Connection 提供上下文，SQL Console 承载一个具体 SQL 工作任务。
- V0.2 supersedes V0.1 的部分右侧面板假设：右侧不再固定展示 AI Assistant / Candidate Table Set / table details，而是通过 Right-side Content Switcher 在 SQL Console List 和 AI Conversation View 之间切换。
- 进入技术设计前，建议重点拆分数据模型迁移、SQL statement selection/splitting、console lifecycle、right-side view state、model provider registry 和 dialog state management。
