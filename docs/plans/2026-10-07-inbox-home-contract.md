# Inbox 首页实施合同

**Status:** Approved

**Acceptance state:** 关闭策略已通过本地浏览器回归：末批显示 47 / 47、46 / 47；正常关闭及后退关闭后前进保持内容墙；既有 Images 灯箱关闭后前进可重新打开。静态检查与纯逻辑测试通过。部分图片使用浏览器请求模拟，测试库原媒体路径缺失；全量 TypeScript 检查仍有三处既有计时器类型错误。构建 stash:local 成功并通过现有 compose 部署 booster，运行镜像 93be6e284769，启动日志与硬件编码初始化正常。生产浏览器到达登录页，登录后的真实 Inbox 数据尚未验证；生产配置保持原样。
**Date:** 2026-10-07

## Goal

首页展示 Scenes 和 Images 中名为 inbox 的保存筛选结果。默认呈现连续的混合内容墙，支持浏览、打开详情及图片 Lightbox 大图。

## Scope

- 首页固定使用 Inbox 数据，提供全部 / Scenes / Images、刷新、加载更多和分类下的查看全部。
- Scene 悬停预览及详情入口；图片点击直接进入现有 Lightbox，Next / Prev 连续切换图片 Inbox，支持跨批次。
- 保留全站导航、列表、详情及灯箱能力。
- 本轮完成源码验收、构建 stash:local 并使用现有 compose 部署到 booster；保持生产配置和媒体数据。

## Acceptance Checks

- 两类 Inbox 在同一面墙出现，分类切换保留已加载数据；每类每批 24 项，窗口尺寸仅影响布局。
- 每类保持保存筛选排序；全部按 Scene、Image 交替排列，一类耗尽后展示另一类。随机排序一次浏览保持固定种子。
- 刷新重新读取保存筛选及首批内容。
- 图片点击直接打开 Lightbox 大图，Next / Prev 可跨批次浏览图片 Inbox；评分、打标等更新与首页一致。
- 从详情返回恢复分类、已加载内容和滚动位置。分类下查看全部带相应 Inbox 条件进入现有列表。
- 区分缺失筛选、名称歧义、内容为空及加载失败；一类异常时另一类正常展示。分页失败保留已有内容并允许重试。
- 桌面和手机布局无横向溢出，操作可通过键盘访问，减少动画设置生效。
- 新逻辑和测试集中在 FrontPage/inbox/；上游只作最小入口接入。

## Key Decisions

- **筛选解析** — 使用 useFindSavedFilters 按 FilterMode.Scenes / Images 读取；名称忽略大小写及首尾空格匹配 inbox；多个匹配提示歧义。缺失时引导到对应列表创建保存筛选。
- **筛选语义** — 使用 ListFilterModel.configureFromSavedFilter 保留条件、搜索及排序；覆盖首页分页大小和页码，不改保存筛选本身。随机种子在浏览期间保持稳定。
- **混合顺序** — 按各类内部顺序交替排列，Scene 在前；布局选择需保持可预测的 DOM / 键盘顺序。
- **图片浏览** — 在 inbox/ 内直接使用 useLightboxContext 接入，灯箱独立按 24 张分页；首页累计数组用于墙展示，点击图片按其图片序列索引计算灯箱页和 initialIndex。提供 images、pageCallback、totalCount；page / pages / pageSize 明确置 undefined，使现有灯箱以 images 身份变化判定跨页完成。首页页码与灯箱内部页码分离；首尾循环。跨页失败保留原批次，交付原批次的新数组副本解除现有切页 guard，显示错误并允许再次 Next / Prev 重试；失败后落在原批次首张（Next）或末张（Prev）。关闭后保存墙状态，清理灯箱活动归属，避免后续页面灯箱被首页写入。快速连续导航、跨页失败重试及关闭重开需验收。每次打开完整初始化 images、initialIndex、pageCallback、totalCount、page/pages/pageSize=undefined、chapters=[]、showNavigation=false、slideshowEnabled=true、slideshowAutostart=false、isLoading 和本入口 onClose，覆盖其他入口遗留状态。共享灯箱最小修改：context.tsx 的 IContext / Provider value 暴露已有 onHide 为 hideLightbox（签名 reason?: LightboxHideReason）；IState 和 Lightbox IProps 增加可选 indexOffset（默认 0），page 未指定时为显示位置加上批次偏移。Inbox 每批交付准确偏移，关闭后归零；增加可选 discardHistoryOnClose（默认 false），Inbox 打开设 true。Provider 的 onHide 对该入口走历史清理并关闭；closeLightbox 对该入口无条件清 activeHistoryID（浏览器后退时当前记录可能已切换），因此历史前进不能复活旧批次。其他入口默认保留原有后退关闭/前进重开。共享状态 close 后复位该选项，防止其他入口继承。验收第二批/末批关闭及后退/前进、重开及 Next/Prev，既有 Images 入口历史行为。
- **编辑和缓存一致性** — 已加载页使用 Apollo 活动查询订阅，不把累计快照作为权威来源。监听查询结果及失效；评分、打标、删除或详情编辑导致媒体查询失效时，以固定随机种子重新获取该类已加载范围，从第 1 页重建排序及成员、总数和后续分页，保留另一类数据。重建期间禁止该类加载更多，版本标识隔离过期响应。灯箱图片同步权威查询结果；当前图片退出 Inbox 时使用 hideLightbox("navigate") 关闭该首页灯箱并提示内容变化：复用 Provider 的 clearCurrentLightboxHistory 和 closeLightbox，删除当前 history marker、清理 activeHistoryID、调用 onClose；通过本入口活动归属和请求版本检查避免关闭其他入口。回到重建后的墙，避免按旧索引编辑其他图片；普通评分也可以保守执行关闭并重建。成员退出后再导航及浏览器后退/前进，失效图片序列不得复活。详情返回对已加载范围重新校验，恢复分类和滚动位置（内容缩减时浏览器可钳制位置）。验收覆盖至少两个已加载批次、成员退出、排序变化、更新后的计数和继续分页。
- **返回状态** — 首页局部会话状态保留分类、已加载数据及滚动位置；支持详情往返，刷新从首批开始；不将大量媒体数据持久化到 localStorage。
- **视觉** — 页面 #202c34、工具栏/浮层 #2c3d49、分隔 #405461、主文字 #edf3f6、次文字 #a5b8c4、焦点 #76b9df。Inbox 标题使用 Arial Narrow 系统回退；正文沿用现有字体，时长使用等宽数字。
- **画面优先** — 保留画面比例，长图限制预览高度，文件名弱化为单行；Scene 播放标记和时长。桌面随宽度调整列数、手机两列为主。避免额外装饰和非必要动画。

## Change Areas

| File / module / interface | Responsibility and boundary |
|---|---|
| ui/v2.5/src/components/FrontPage/inbox/ | 新组件、数据逻辑、样式、本地测试及局部会话状态 |
| ui/v2.5/src/components/FrontPage/FrontPage.tsx | 最小首页入口接入，保留 PatchComponent 插件包装 |
| src/core/StashService.ts / src/models/list-filter/filter.ts | 复用现有接口和筛选模型，无预期修改 |
| ui/v2.5/src/hooks/Lightbox/context.tsx | 暴露 hideLightbox；增加可选 indexOffset / discardHistoryOnClose 与关闭复位 |
| ui/v2.5/src/hooks/Lightbox/historyModel.ts / historyModel.test.ts | 独立纯函数表达关闭历史策略及新增本地测试 |
| ui/v2.5/src/hooks/Lightbox/Lightbox.tsx | IProps 增加可选 indexOffset（默认 0），page 未指定时显示全局位置偏移；其余逻辑保持原样 |
| ui/v2.5/src/index.scss | 一行导入 inbox/inbox.scss |
| docs/plans/2026-10-07-inbox-home-contract.md | 经确认并评审的实施合同 |

## Constraints

- 遵循 AGENTS.md：上游最小改动、新逻辑独立文件，不修改官方测试文件。
- 保留旧首页及 dense/ 文件；保持现有依赖，不修改 lockfile、GraphQL schema、生产配置或数据。
- 当前分支 v0.31.1-improved，工作树干净；按 my-specs 使用一个实施分支（可在现有非 main/master 分支工作）。不自动提交或发布代码；用户已批准本地镜像部署。
- 各类加载及错误状态独立，避免一类失败阻断另一类。分页去重，避免过期请求覆盖刷新或新筛选的数据。
- 构建请求和查看全部链接前检查 UnsupportedCriterion；对应类别进入不可查询的错误状态，不发出遗漏条件的媒体查询，不生成查看全部链接；另一类正常工作。名称歧义同样禁止对应类别查询。
- 本地开发采用 make server-start 和 ui/v2.5 中 npm run start -- --host --port 3010；端口 9999 为独立后端，3000 为生产。

## Verification

- 在 ui/v2.5 运行 npm run check；对改动的 TS/TSX 运行 npx eslint <files>，SCSS 运行 npx stylelint <files>，改动文件运行 npx prettier --check <files>。
- 无新增依赖的逻辑测试：将名称解析、交错、页合并、随机种子及版本/失效处理抽为 inbox/ 中纯 TypeScript 模块，仅使用相对导入及类型导入，测试文件同目录。执行 `out=$(mktemp -d /tmp/stash-inbox-tests.XXXXXX); npx tsc --module commonjs --target es2020 --skipLibCheck --outDir "$out" src/components/FrontPage/inbox/inboxModel.ts src/components/FrontPage/inbox/inboxModel.test.ts && node "$out/inboxModel.test.js"; result=$?; rm -r "$out"; exit "$result"`；输出位于仓库 ESM package 边界之外，CommonJS 可直接运行，纯模块避免 src/* 运行时别名。覆盖名称歧义、交错顺序、分页/去重、稳定种子、旧响应隔离、编辑失效与分页失败恢复。若模块拆分，命令同步列明所有纯模块。
- 浏览器实际点击类型切换、刷新、加载更多、Scene 详情往返、图片打开大图及 Next / Prev 跨批次、关闭返回和灯箱编辑。
- 浏览器核对 Scenes / Images 查看全部筛选链接、详情、灯箱评分/打标后数据一致性及其他既有灯箱入口；先打开带章节及自动播放的图库灯箱，再打开 Inbox，确认章节清空、播放暂停及正确分页。验证成员退出后导航、后退及前进不复活失效图片序列。
- 浏览器检查保存筛选缺失、歧义、单类为空、全部为空、首批与分页失败，代表性桌面与手机视口；通过隔离测试数据或浏览器请求模拟补齐测试库（现有 5 个 Scene、47 张 Image，无 Inbox 保存筛选）。生产需登录，真实生产筛选验收范围如实报告。
- 主代理审查完整 diff、合同条目和分支/工作树状态；启动的验证进程在验证结束后清理。

## Open Questions

None
