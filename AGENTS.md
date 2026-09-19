# Stash 本地镜像编译与部署

## 编译本地镜像

```bash
cd /data/workspace/stash
docker build --build-arg GITHASH=$(git rev-parse --short HEAD) --build-arg STASH_VERSION=local -t stash:local -f docker/build/x86_64/Dockerfile .
```

只改 UI 时，pnpm / `go mod download` 应走缓存；只有 lockfile 或 `go.mod` 变了才会重新下载。

## 部署到本机 (booster)

```bash
cd /data/nas/area1/Pandora/booster
docker compose build stash
docker compose up -d stash
```

compose 的 Python/GPU 依赖装在独立层，不跟 `stash:local` 绑定；每次只拷贝新二进制，不应再 `pip install`。

部署现状：booster 已配置 `pull: false` 使用本地镜像；SQLite 数据库在本机 SSD（`/data/service/stash/db/`），`~/bin/backup.sh` 每周自动同步到 NFS。

## 本地测试开发服务器

不要用 Docker 再拉一套 stash-test。源码改 UI / 后端，用官方 `make` 在仓库 `.local/` 里跑独立实例，和生产（booster `:3000`）互不影响。

数据与配置都在 `.local/`（已 gitignore）：`config.yml`、`stash-go.sqlite`、`generated/`、`cache/`、`blobs/`。库目录指到 `~/temp/test-media`。

首次或 GraphQL 生成文件过期时：

```bash
cd /data/workspace/stash
make pre-ui
make generate
```

两个终端：

```bash
# 后端，默认 http://localhost:9999/
make server-start

# 前端热更新。生产 stash 已占 :3000，必须换端口
cd ui/v2.5 && npm run start -- --host --port 3010
```

浏览器开 `http://localhost:3010/`，Vite 默认连 `localhost:9999`。改后端后需 Ctrl-C 再 `make server-start`。

`.local/config.yml` 里关键项：`port: 9999`，`stash[].path: /home/guoweiwei/temp/test-media`。清空测试数据：`make server-clean`（会删整个 `.local/`，下次启动走 Setup Wizard，库路径要重新指到 `~/temp/test-media`）。

## 开发准则

我们是 stash 的使用者而非上游维护者，本地代码最终需跟随上游 develop 演进。因此添加代码时：

- 尽量少改动官方代码，改动范围以最小必要为限。
- 新增逻辑优先放入新文件（新 Go 文件 / 新组件 / 新模块），而不是修改官方现有文件。
- 确需在官方代码中接入时，只加最小的钩子（如函数调用、配置项挂载点），将实现细节留在新文件里。
- 不修改官方的测试文件；需要测试本地逻辑时，在新建的测试文件（如 `xxx_test.go`、对应组件目录下的新测试）中编写。
- 目的：减少未来 merge 上游时的冲突范围，保持本地特色改动可快速识别、可撤销。

## 本地改动与上游对比

分支 `v0.31.1-improved`（基于 stash v0.31.1）的本地特色改动，对比上游 develop（截至 `48b1409c4`）：

### 上游已修复、可跟随上游的

- 暂停保护规避代码（`f4c9fc165`）已撤销：上游 v0.31.0 #6336 用 `pausedBeforeScrubber` 修复了移动端点击进度条导致暂停的问题。

### 上游未实现、保持本地特色的

- GPU 硬件编码 HEVC/AV1（上游仅 H264/VP9/VP8）
- 缩略图 1920 尺寸 webp（上游仍 640 jpg）
- 移动端只显示转码源（上游仅 Safari 过滤）
- 删除 mp4 转码选项，默认 webm
- big button 仅手机使用，平板不用
- image wall / gallery wall 去左右黑边、gallery 列宽 450
- 浏览器滚动条位置保存与恢复
- lightbox 移除 o-counter 显示
- rating 更新不刷新主图（仅更新 rating 时不更新 UpdatedAt）
- image url 免鉴权

### 注意

- merge 上游 develop 时，`pkg/ffmpeg/codec_hardware.go`、`ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx`、`ui/v2.5/src/hooks/Lightbox/Lightbox.tsx` 冲突风险最高。
- 上游 UI 更新后浏览器需硬刷新（Ctrl+Shift+R）才能生效（service worker 缓存）。