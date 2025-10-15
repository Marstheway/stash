# 个人自用版

感谢Stash项目，神器。

## 修改点
### 通用改动

- 增加对现代gpu的硬件编码支持：新增 hevc, av1 等
- 对图片链接放开鉴权，方便直接设置 stash 库中的图片作为封面；（如果暴露在公网有安全问题）
- 打开具体的scence, gallery, performer时，用newtab；（个人操作习惯）
- 只对超过1MB的文件生成thumbnail，格式由640改为1920,并改为webp q=85，提升清晰度；


### gallery

- gallery的wall瀑布流视图改动：
  - 如果图片小于1MB使用原图，否则使用thumbnail；
  - 支持设置每列图片宽度（原来硬编码300)，默认450，现在可配置；
  - 去掉移动视图下左右两边大约2%的黑边，使图片能充分利用手机屏幕空间；

### lightbox
- 图片全屏沉浸式显示，header和footer悬浮在图片之上。
- 提前加载pre和next图片，提升响应；
- 图片切换动画支持硬件加速，动画效果改为淡入淡出；（原为平移，很晃眼）
- 移除o-counter，仅保留星标评分控件（个人不常用o-counter，还容易误触）；
- 修复点击更新评分后，主图片需要重新加载的问题（超大图影响体验）；
- 完全重构lightbox屏幕点击行为：
  - 屏幕左边1/3: 上一张图
  - 屏幕右边1/3：下一张图
  - 中间区域： 切换显示/隐藏header,footer，全部隐藏后将显示完整大图。

### 视频播放器
- scence player删除mp4实时转码选项，默认webm转码；
- 修复手机上点击进度条视频被意外暂停的问题；
- 视频步进按钮按2%跳转（原来为固定10s）；



容器镜像：ghcr.io/marstheway/stash:v0.28.1-develop。

容器内没有硬件驱动，如需硬件加速，需要自行安装驱动（docker build)

<br><br>

# Stash

[![Build](https://github.com/stashapp/stash/actions/workflows/build.yml/badge.svg?branch=develop&event=push)](https://github.com/stashapp/stash/actions/workflows/build.yml)
[![Docker pulls](https://img.shields.io/docker/pulls/stashapp/stash.svg)](https://hub.docker.com/r/stashapp/stash 'DockerHub')
[![GitHub Sponsors](https://img.shields.io/github/sponsors/stashapp?logo=github)](https://github.com/sponsors/stashapp)
[![Open Collective backers](https://img.shields.io/opencollective/backers/stashapp?logo=opencollective)](https://opencollective.com/stashapp)
[![Go Report Card](https://goreportcard.com/badge/github.com/stashapp/stash)](https://goreportcard.com/report/github.com/stashapp/stash)
[![Matrix](https://img.shields.io/matrix/stashapp:unredacted.org?logo=matrix&server_fqdn=matrix.org)](https://matrix.to/#/#stashapp:unredacted.org)
[![Discord](https://img.shields.io/discord/559159668438728723.svg?logo=discord)](https://discord.gg/2TsNFKt)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/stashapp/stash?logo=github)](https://github.com/stashapp/stash/releases/latest)
[![GitHub issues by-label](https://img.shields.io/github/issues-raw/stashapp/stash/bounty)](https://github.com/stashapp/stash/labels/bounty)

### **Stash is a self-hosted webapp written in Go which organizes and serves your porn.**
![demo image](docs/readme_assets/demo_image.png)

* Stash gathers information about videos in your collection from the internet, and is extensible through the use of community-built plugins for a large number of content producers and sites.
* Stash supports a wide variety of both video and image formats.
* You can tag videos and find them later.
* Stash provides statistics about performers, tags, studios and more.

You can [watch a SFW demo video](https://vimeo.com/545323354) to see it in action.

For further information you can consult the [documentation](https://docs.stashapp.cc) or [read the in-app manual](ui/v2.5/src/docs/en).

# Installing Stash

#### Windows Users:

As of version 0.27.0, Stash doesn't support anymore _Windows 7, 8, Server 2008 and Server 2012._  
Windows 10 or Server 2016 are at least required.

<img src="docs/readme_assets/windows_logo.svg" width="100%" height="75"> Windows | <img src="docs/readme_assets/mac_logo.svg" width="100%" height="75"> macOS | <img src="docs/readme_assets/linux_logo.svg" width="100%" height="75"> Linux | <img src="docs/readme_assets/docker_logo.svg" width="100%" height="75"> Docker
:---:|:---:|:---:|:---:
[Latest Release](https://github.com/stashapp/stash/releases/latest/download/stash-win.exe) <br /> <sup><sub>[Development Preview](https://github.com/stashapp/stash/releases/download/latest_develop/stash-win.exe)</sub></sup> | [Latest Release](https://github.com/stashapp/stash/releases/latest/download/Stash.app.zip) <br /> <sup><sub>[Development Preview](https://github.com/stashapp/stash/releases/download/latest_develop/Stash.app.zip)</sub></sup> | [Latest Release (amd64)](https://github.com/stashapp/stash/releases/latest/download/stash-linux) <br /> <sup><sub>[Development Preview (amd64)](https://github.com/stashapp/stash/releases/download/latest_develop/stash-linux)</sub></sup> <br /> [More Architectures...](https://github.com/stashapp/stash/releases/latest) | [Instructions](docker/production/README.md) <br /> <sup><sub>[Sample docker-compose.yml](docker/production/docker-compose.yml)</sub></sup>

Download links for other platforms and architectures are available on the [Releases page](https://github.com/stashapp/stash/releases).

## First Run

#### Windows/macOS Users: Security Prompt

On Windows or macOS, running the app might present a security prompt since the binary isn't yet signed. 

On Windows, bypass this by clicking "more info" and then the "run anyway" button. On macOS, Control+Click the app, click "Open", and then "Open" again.

#### FFmpeg
Stash requires FFmpeg. If you don't have it installed, Stash will download a copy for you. It is recommended that Linux users install `ffmpeg` from their distro's package manager.

# Usage

## Quickstart Guide
Stash is a web-based application. Once the application is running, the interface is available (by default) from http://localhost:9999.

On first run, Stash will prompt you for some configuration options and media directories to index, called "Scanning" in Stash. After scanning, your media will be available for browsing, curating, editing, and tagging.

Stash can pull metadata (performers, tags, descriptions, studios, and more) directly from many sites through the use of [scrapers](https://github.com/stashapp/stash/blob/develop/ui/v2.5/src/docs/en/Manual/Scraping.md), which integrate directly into Stash. Identifying an entire collection will typically require a mix of multiple sources:
- The project maintains [StashDB](https://stashdb.org/), a crowd-sourced repository of scene, studio, and performer information. Connecting it to Stash will allow you to automatically identify much of a typical media collection. It runs on our stash-box software and is primarily focused on mainstream digital scenes and studios. Instructions, invite codes, and more can be found in this guide to [Accessing StashDB](https://guidelines.stashdb.org/docs/faq_getting-started/stashdb/accessing-stashdb/).
- Several community-managed stash-box databases can also be connected to Stash in a similar manner. Each one serves a slightly different niche and follows their own methodology. A rundown of each stash-box, their differences, and the information you need to sign up can be found in this guide to [Accessing Stash-Boxes](https://guidelines.stashdb.org/docs/faq_getting-started/stashdb/accessing-stash-boxes/).
- Many community-maintained scrapers can also be downloaded, installed, and updated from within Stash, allowing you to pull data from a wide range of other websites and databases. They can be found by navigating to Settings -> Metadata Providers -> Available Scrapers -> Community (stable). These can be trickier to use than a stash-box because every scraper works a little differently. For more information, please visit the [CommunityScrapers repository](https://github.com/stashapp/CommunityScrapers).
- All of the above methods of scraping data into Stash are also covered in more detail in our [Guide to Scraping](https://docs.stashapp.cc/beginner-guides/guide-to-scraping/).

<sub>[StashDB](http://stashdb.org) is the canonical instance of our open source metadata API, [stash-box](https://github.com/stashapp/stash-box).</sub>

# Translation
[![Translate](https://translate.codeberg.org/widget/stash/stash/svg-badge.svg)](https://translate.codeberg.org/engage/stash/)

Stash is available in 32 languages (so far!) and it could be in your language too. We use Weblate to coordinate community translations. If you want to help us translate Stash into your language, you can make an account at [Codeberg's Weblate](https://translate.codeberg.org/projects/stash/stash/) to get started contributing new languages or improving existing ones. Thanks!

[![Translation status](https://translate.codeberg.org/widget/stash/stash/multi-auto.svg)](https://translate.codeberg.org/engage/stash/)

# Support (FAQ)

Check out our documentation on [Stash-Docs](https://docs.stashapp.cc) for information about the software, questions, guides, add-ons and more. 

For more help you can:
* Check the in-app documentation, in the top right corner of the app (it's also mirrored on [Stash-Docs](https://docs.stashapp.cc/in-app-manual))
* Join the [Matrix space](https://matrix.to/#/#stashapp:unredacted.org)
* Join the [Discord server](https://discord.gg/2TsNFKt), where the community can offer support.
* Start a [discussion on GitHub](https://github.com/stashapp/stash/discussions)

# Customization

## Themes and CSS Customization
There is a [directory of community-created themes](https://docs.stashapp.cc/themes/list) on Stash-Docs.

You can also change the Stash interface to fit your desired style with various snippets from [Custom CSS snippets](https://docs.stashapp.cc/themes/custom-css-snippets).

# For Developers

Pull requests are welcome! 

See [Development](docs/DEVELOPMENT.md) and [Contributing](docs/CONTRIBUTING.md) for information on working with the codebase, getting a local development setup, and contributing changes.
