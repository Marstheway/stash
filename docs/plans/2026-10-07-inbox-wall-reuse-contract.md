# Inbox 内容墙组件复用契约

**Status:** Approved
**Date:** 2026-10-07

## Goal

Inbox 首页复用 Stash 现有内容墙布局库及 Scene/Image Wall Item，独立目录内保留必要的混合数据适配。用户已确认按推荐复用方案实施，并指定 coding 模型。

## Scope

- 使用已有 `react-photo-gallery` 排列混合 Scene/Image，以媒体自然比例展示。
- 优先直接使用已导出的 `SceneWallItem`、`ImageWallItem`，继承既有预览、标题和配置行为。
- 保留 All/Scenes/Images、保存筛选解析、刷新、加载更多、列表链接、滚动恢复及跨批次 Lightbox 和关闭历史策略。
- 清理本次替换后失去用途的 Inbox 自定义布局、卡片样式、辅助函数及本地测试。
- 本轮交付源码及验收结果；部署、提交和发布属于后续授权范围。

## Acceptance Checks

- All 中两类数据仍按既有交错顺序展示；Scenes、Images 各自显示正确结果。
- 实际渲染使用 Gallery 与现有两类 Wall Item；原有单媒体列表继续正常运行。
- Scene 主图和标题可进入对应详情；Image 主图每次激活仅打开一次灯箱，索引按 Images 顺序计算。
- 保留图片卡片键盘 Enter/Space 激活；通过最薄适配补齐现有组件必要的键盘入口，避免嵌套按钮或重复激活。
- 图片 Next/Prev 跨批次、关闭、后退和前进保持上一契约行为。
- 文件名不作为墙内展示信息；Scene 仅展示真实 title 及现有 performer/date，空 title 不使用文件名兜底。Image 不显示文件名浮层。
- `prefers-reduced-motion` 时使用静态 screenshot/thumbnail，保留此前可访问性行为。
- 空集合、单项、缺失或非正尺寸、预览失败均有稳定布局；Scene 预览失败可回退 screenshot。
- 桌面和手机无横向溢出、遮挡或固定比例裁切。

## Key Decisions

- **混合适配** — 以带类别标记的 Gallery photo 统一布局，通过 renderImage 分发已有组件，使用稳定的类别加 ID 键。
- **单列布局规则** — 选用 Gallery column 方向形成自然比例瀑布流，列数按容器宽度计算且下限为 1；手机尽量保持两列。现有 Item 的 maxHeight 与 Gallery 计算后的尺寸一致，避免位置和媒体宽高不一致。
- **既有组件行为** — 接受原生自动预览、声音及 Scene 标题配置；保留 Inbox 工具栏。复用 `.scene-wall` 样式作用域提供现有 Scene footer 样式。墙内标题使用真实 title，可通过最小可选 title 钩子跳过 `objectTitle` 的文件名兜底；其它入口保持默认行为。原自定义播放/时长徽标随卡片替换清理。
- **最小接入** — 优先在 Inbox 内处理激活去重和键盘入口。确需修改共享 Item 时仅添加兼容、默认行为保持的可选钩子，并回归原有调用方。
- **尺寸与失败** — Scene 使用首个文件尺寸及 1280×720 正值兜底，Image 使用首个 visual_file 尺寸及正值兜底；选择当前可用 preview/thumbnail/screenshot。

## Change Areas

| File / module | Responsibility and boundary |
|---|---|
| `ui/v2.5/src/components/FrontPage/inbox/InboxWall.tsx` | 混合 Gallery photo 适配、已有 Item 分发、激活、Scene 失败回退 |
| `ui/v2.5/src/components/FrontPage/inbox/inbox.scss` | 清理替换掉的局部布局和卡片样式，保留工具栏及必要容器样式 |
| `ui/v2.5/src/components/FrontPage/inbox/inboxModel.ts`、`inboxModel.test.ts` 或新建本地测试文件 | 清理失效布局辅助函数并验证适配所需纯逻辑 |
| `ui/v2.5/src/components/Scenes/SceneWallPanel.tsx`、`ui/v2.5/src/components/Images/ImageWallItem.tsx` | 仅在必要时添加最小兼容钩子；优先保持文件原样 |

## Constraints

- 改动集中 `FrontPage/inbox/`，沿用当前 `v0.31.1-improved` 工作树，保留此前已实现的功能和无关工作。
- 依赖及 lockfile 保持原样；官方测试文件保持原样。
- 保存筛选、请求范围、会话和 Lightbox 数据流保持原样。

## Verification

- 在 `ui/v2.5` 执行改动文件的 `npx eslint`、`npx stylelint`、`npx prettier --check`，执行 `npm run check`，区分既有三处计时器类型错误。
- 使用项目已有 TypeScript/Node 工具运行本地纯逻辑测试，记录命令和结果。
- 按 AGENTS.md 启动独立后端 `make server-start` 及前端 `npm run start -- --host --port 3010`。
- 浏览器桌面和 390px 手机分别操作混合墙、两类 tab、刷新、加载更多、Scene 详情、图片键盘/鼠标打开及跨批次切换与关闭历史；查看原有 Scenes/Images 墙调用方。
- 用浏览器请求模拟覆盖单项、空、无效尺寸、预览失败及测试库缺失原媒体时的图片路径，明确模拟与真实验证边界。

## Acceptance Record

- coding 模型完成实现及一轮返工；主代理审查共享 Item 钩子及混合适配，修改集中于本地目录和两个共享 Item 的可选接入点。
- ESLint、Stylelint、Prettier、`git diff --check` 通过；23 项 Inbox 纯逻辑测试及 4 项灯箱历史测试通过。全量 TypeScript 检查报告既有三处计时器类型错误，未发现新增类型错误。
- 浏览器验证桌面 1440px、手机 390px：混合顺序、两类 tab、刷新、加载更多（24 到 47）、Scene 主图及真实标题详情入口、Scene Space 和 Image Enter 激活、图片 1/47 到 47/47、46/47 的跨批次导航、关闭后前进保持墙。原 Images 墙打开及关闭后前进恢复、原 Scenes 墙标题与详情导航回归通过。
- 墙内空 Scene title 显示为空，Image 无文件名浮层。模拟真实 Scene title 正常展示并进入详情；模拟两类各一项和无效尺寸有稳定槽位；模拟空集合显示类别空状态。
- reduced-motion 页面初始化时 29 项全部使用静态源、视频数为 0。模拟 Scene preview error 事件后回退 screenshot。
- 测试库缺失原媒体：灯箱显示验证使用浏览器请求模拟，将 image 路径和尺寸改为可用缩略图；真实原媒体播放及生产登录后 Inbox 本轮未验证。灯箱及原有列表的文件名显示保持既有行为，本次隐藏范围为首页内容墙。
- 本轮保留未提交源码；生产镜像及配置保持此前部署状态。

## Open Questions

None
