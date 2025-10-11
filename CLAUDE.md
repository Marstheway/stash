# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Stash是一个自托管的Go语言Web应用，用于组织和提供成人内容。项目采用前后端分离架构：
- 后端：Go语言，使用GraphQL API
- 前端：React + TypeScript，使用Vite构建工具

## 开发环境设置

### 前置要求
- Go 1.24.3+
- GolangCI-Lint
- Yarn包管理器
- FFmpeg

### 本地开发快速开始
```bash
# 安装UI依赖
make pre-ui

# 生成代码文件
make generate

# 启动开发服务器（终端1）
make server-start

# 启动UI开发模式（终端2）
make ui-start
```

访问UI：http://localhost:3000/

## 构建命令

### 基础构建
```bash
# 构建stash和phasher二进制文件
make build

# 构建发布版本（移除调试信息）
make build-release

# 构建完整的发布包
make release
```

### 构建标志
可选的构建标志组合：
- `flags-release` - 移除调试信息
- `flags-pie` - 构建位置无关可执行文件
- `flags-static` - 静态链接
- `flags-static-pie` - 静态PIE构建

示例：`make flags-release flags-pie stash`

## 代码生成

### GraphQL代码生成
```bash
# 生成后端和前端GraphQL代码
make generate

# 仅生成前端GraphQL代码
make generate-ui

# 仅生成后端GraphQL代码
make generate-backend

# 生成stash-box客户端代码
make generate-stash-box-client
```

## 代码质量

### 格式化
```bash
# 格式化Go代码
make fmt

# 格式化UI代码
make fmt-ui

# 快速格式化（仅修改的文件）
make fmt-ui-quick
```

### 代码检查
```bash
# 运行所有验证检查
make validate

# 仅后端验证
make validate-backend

# 仅前端验证
make validate-ui

# 快速验证（仅修改的文件）
make validate-ui-quick
```

### 测试
```bash
# 运行单元测试
make test

# 运行所有测试（包括集成测试）
make it
```

## 项目架构

### 后端结构
- `cmd/` - 应用程序入口点
  - `stash/` - 主应用程序
  - `phasher/` - 图像哈希工具
- `internal/` - 内部包（不对外暴露）
  - `api/` - GraphQL API实现
  - `manager/` - 核心业务逻辑
  - `build/` - 构建信息
- `pkg/` - 可复用包
  - `logger/` - 日志系统
- `graphql/` - GraphQL schema定义

### 前端结构
- `ui/v2.5/` - React前端应用
  - `src/` - 源代码
  - `build/` - 构建输出

### 数据库
- 使用SQLite数据库
- 通过sqlx进行数据库操作
- 支持数据库迁移

## 开发工作流

### 修改后端代码
1. 修改Go代码
2. 重启服务器：`make server-start`

### 修改前端代码
1. 修改React/TypeScript代码
2. 浏览器自动热重载

### 添加新功能
1. 在`graphql/schema.graphql`中定义GraphQL类型
2. 运行`make generate`生成代码
3. 在`internal/api/`中实现解析器
4. 在前端中添加相应的查询和组件

## 交叉编译

项目使用Docker容器进行跨平台编译：

```bash
# 拉取编译器镜像
docker pull stashapp/compiler

# 启动编译容器
docker run --rm --mount type=bind,source="$(pwd)",target=/stash -w /stash -it stashapp/compiler /bin/bash

# 在容器内构建
make build-cc-all  # 所有平台
make build-cc-windows  # 仅Windows
make build-cc-linux  # 仅Linux
```

## 调试和分析

### CPU性能分析
```bash
# 启动带性能分析的服务器
./stash --cpuprofile profile.out

# 分析profile
go tool pprof stash profile.out
```

### 清理开发环境
```bash
# 清理本地配置和数据库
make server-clean
```

## 注意事项

- 项目使用AGPL许可证
- 遵循Go模块管理
- 前端使用Yarn进行依赖管理
- 代码提交前必须通过`make validate`检查
- 所有GraphQL变更都需要重新生成代码