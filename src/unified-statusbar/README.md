# unified-statusbar（统一状态栏）

主扩展入口：`index.ts` + `index.html`。

## 目录

- `core/`：数据层、AI 请求管线、存储、世界演化、地图、立绘、衣柜、成就、周期等引擎
- `renderers/`：状态栏与各弹窗/面板的 DOM 渲染
- `styles/`：多套主题 CSS
- `panels/`：设置面板与表格/存储管理面板
- `chrome/`：悬浮壳与拖拽
- `achievements/achievements.json`：成就定义
- `data/`：卡池与通用技能数据
- `docs/`：仅保留运行期会 import 的正则与数据库标准模板

## 运行期依赖

- 酒馆助手 / SillyTavern 宿主 API
- 数据库插件公开接口（表格读写、聊天表单指南、检查点）
- 可选生图通道插件（直连、事件总线式通道、结构化 API 通道）

## 说明

应用户要求，源码阅读副本未包含测试、内部设计文档与历史打包产物。部分注释仍引用内部 `docs/` 路径，仅作历史线索，不影响阅读。
