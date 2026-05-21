# 艺人管理系统 — 项目地图

## 项目概览

这是一个**艺人管理系统**，用来管理 ~10 个音乐酒吧/场地店面的艺人、合约、考核和薪资。

支持三种运行方式：

| 模式 | 入口 | 数据库 | 适用场景 |
|------|------|--------|----------|
| Electron 桌面程序 | `npm start` (`main.js`) | sql.js (WASM) | Windows 单机使用 |
| Web 服务器 | `node server.js` 或双击 `start-server.bat` | better-sqlite3 | 局域网/公网多人访问 |
| Android APK | Capacitor 打包 (`android/`) | sql.js (WASM) + 云端同步 | 手机端移动办公 |

---

## 目录结构（按功能分类）

### `src/` — 前端界面

所有 UI 和交互逻辑的源头，是整个系统的"脸"。

| 文件/目录 | 作用 |
|-----------|------|
| `index.html` | **整个前端应用（单文件，~350KB）**。包含所有页面、弹窗、表单、图表（Chart.js）、Bootstrap 组件、CSS 主题系统。这是修改 UI 的唯一入口 |
| `cap-db.js` | 移动端本地数据库适配器。用 sql.js 在手机 WebView 里跑 SQLite，提供离线存储能力。检测到网络可达时自动同步云端数据 |
| `lib/pdfjs/` | PDF.js 渲染库（`pdf.min.mjs` + `pdf.worker.min.mjs`）。手机端 Android WebView 没有原生 PDF 查看器，全靠这个库在 `<canvas>` 上渲染 PDF |

**什么时候改这里：** 调整界面布局、加新功能按钮、修改弹窗样式、修 UI 交互 bug。

---

### `server/` — 后端服务器

Express 服务器，提供 REST API 和多客户端实时同步。

| 文件/目录 | 作用 |
|-----------|------|
| `database.js` | 服务器端数据库层，用 better-sqlite3（C++ 原生绑定，WAL 模式）。和 Electron 端的 db/db/database.js 是**同一套逻辑、不同 SQLite 绑定** |
| `src/assets/` | 上传文件存储目录 |
| `src/assets/announcements/` | 音乐部公告 PDF 文件存储 |
| `src/assets/contracts/` | 艺人合约 PDF 文件存储 |

**什么时候改这里：** 改数据库表结构、加新 API 接口、修数据读写 bug。

---

### `server.js` — 服务器入口（根目录）

Express 服务器的主入口文件。包含：
- REST API 路由（`/api/login`, `/api/artists`, `/api/contracts`, `/api/stores` 等）
- Token 认证（`/api/login` 获取 token）
- SSE 实时推送（`/api/events`），数据库有变更时自动通知所有在线客户端
- 静态文件服务

---

### `db/db/` — 本地数据库（Electron 用）

| 文件/目录 | 作用 |
|-----------|------|
| `database.js` | Electron 桌面端的数据库层，用 sql.js（WASM 编译的 SQLite）。核心逻辑：初始化建表、种子数据、CRUD 操作。数据库通过 `db.export()` 持久化到磁盘 |
| `artist_data.db` | 本地 SQLite 数据库文件 |

**什么时候改这里：** 改本地数据库逻辑、加数据校验。

---

### `main.js` — Electron 主进程（根目录）

Electron 桌面程序的大脑：
- 创建 BrowserWindow
- 注册所有 IPC 通道（`ipcMain.handle`）
- 调用 db/db/database.js 执行数据库操作
- 处理 PDF 文件读写（给合约预览用）
- 管理应用生命周期

---

### `preload.js` — Electron 预加载脚本（根目录）

安全桥接层，通过 `contextBridge` 暴露 `window.electronAPI` 给渲染进程：
- `electronAPI.query(sql, params)` — 执行 SQL 查询
- `electronAPI.readContractFile(path)` — 读取本地合约 PDF
- `electronAPI.getFilePath(relativePath)` — 获取文件绝对路径

前端通过 `window.electronAPI` 调用这些能力，无法直接访问 Node.js API。

---

### `scripts/` — 构建工具

| 文件 | 作用 |
|------|------|
| `copy-www.js` | 把 `src/` 编译成 `www/`。流程：处理 `index.html` 路径替换 → 复制 CSS/JS/字体/PDF.js 到 www/lib/ → 插入 Capacitor 专用脚本标签 |
| `generate-icon.js` | 用纯代码生成 `icon.ico`（不需要图片处理库） |

---

### `www/` — 移动端 Web 资源（构建产物）

从 `src/` 通过 `scripts/copy-www.js` 生成的 Capacitor web 目录。**不要直接改这里**，改完 `src/` 跑 `node scripts/copy-www.js` 就会自动更新。

子目录结构：
- `www/index.html` — 处理后的前端页面
- `www/lib/css/` — Bootstrap + Font Awesome 样式
- `www/lib/js/` — 所有 JS 库：Chart.js、Bootstrap、sql.js、Capacitor、PDF.js
- `www/lib/webfonts/` — Font Awesome 字体
- `www/lib/fonts/` — Bootstrap Icons 字体
- `www/assets/` — sql-wasm.wasm

---

### `android/` — Android 打包项目

Capacitor 生成的 Android 原生项目。

| 关键位置 | 作用 |
|----------|------|
| `app/build/outputs/apk/debug/app-debug.apk` | 构建产出的 APK 文件 |
| `app/src/main/assets/public/` | Capacitor 同步的 web 资源（从 www/ 复制） |
| `capacitor-cordova-android-plugins/` | Capacitor 插件（Filesystem、SplashScreen、StatusBar） |
| `artist-manager.keystore` | APK 签名密钥，**不要弄丢** |

---

### `deploy/` — 部署配置

| 文件/目录 | 作用 |
|-----------|------|
| `Dockerfile` | Docker 镜像构建配置 |
| `railway.toml` | Railway 云平台部署配置 |
| `deploy-now.bat` | 快速部署到服务器的批处理脚本 |
| `web-deploy.sh` | Linux/Mac 环境 Web 部署脚本 |
| `scp-payload/` | 腾讯云轻量服务器 SCP 部署包（package.json + server.js + server/ + src/） |

---

### `build/` — Electron 构建资源

| 文件 | 作用 |
|------|------|
| `icon.ico` | 桌面程序图标（NSIS 安装包和 EXE 都用它） |
| `license.txt` | Electron 打包用的许可证文件 |

---

### 根目录配置文件

| 文件 | 作用 |
|------|------|
| `package.json` | NPM 依赖 + electron-builder 打包配置 + npm scripts |
| `capacitor.config.ts` | Capacitor 移动端配置（App ID、启动画面、状态栏） |
| `CLAUDE.md` | Claude Code 的项目说明书（给 AI 看的开发指南） |
| `PROJECT_MAP.md` | 本文件 — 项目地图（给人看的） |
| `.gitignore` | Git 忽略规则 |
| `start-server.bat` | 双击启动 Express 服务器的快捷脚本 |

---

## 数据库

### 五张核心表

| 表名 | 存放内容 |
|------|----------|
| `stores` | 店面（11 家固定店面，种子数据自动创建） |
| `artists` | 艺人信息（支持软删除，status='-1' 表示已删除） |
| `contracts` | 合约（关联艺人和店面，支持 PDF 上传） |
| `evaluations` | 考核记录 |
| `salaries` | 薪资记录 |

### 两套数据库实现

| 实现 | 绑定 | 文件 | 适用场景 |
|------|------|------|----------|
| sql.js (WASM) | JavaScript | `db/db/database.js` + `src/cap-db.js` | Electron 桌面 + Android APK |
| better-sqlite3 (C++) | 原生 | `server/database.js` | Express 服务器 |

两套实现的**表结构、种子数据、CRUD 操作**完全一致。改数据库结构时要两边同步改。

---

## 常用命令

```bash
# 开发
npm start                          # 启动 Electron 桌面程序
node server.js                     # 启动 Web 服务器（端口 3000）

# 构建 APK
npm run copy:www                   # 生成 www/
npm run cap:sync                   # 同步到 Android 项目
npm run cap:build                  # 一条龙：生成 www → 同步 → 打包 APK

# 构建 Windows 安装包
npm run build                      # 生成 NSIS 安装包到 dist/

# 部署
node scripts/copy-www.js           # 手动生成 www/
npx cap sync android               # 手动同步 Android
cd android && ./gradlew assembleDebug  # 手动打包 APK
```

---

## 数据流

### Electron 桌面端
```
src/index.html (渲染进程)
  → window.electronAPI.* (preload.js contextBridge)
    → ipcMain.handle (main.js)
      → db/db/database.js (sql.js WASM SQLite)
```

### Web 服务器端
```
浏览器 → REST API (server.js Express)
  → server/database.js (better-sqlite3)
  → SSE 广播变更给所有客户端
```

### Android APK
```
src/index.html (WebView)
  → src/cap-db.js (sql.js WASM)
  → 网络可达时 → server.js (云端同步)
  → 网络不可达时 → 本地存储
```

---

## 修改指南（按需求找文件）

| 需求 | 去哪改 |
|------|--------|
| 改页面布局、弹窗、按钮 | `src/index.html` |
| 加新数据库字段 | `server/database.js` + `db/db/database.js` + `src/cap-db.js`（三处） |
| 改 PDF 预览功能 | `src/index.html`（搜 `renderPdfToCanvas`） |
| 改 APK 打包配置 | `capacitor.config.ts` + `android/app/build.gradle` |
| 改服务器 API | `server.js` |
| 改服务器数据库 | `server/database.js` |
| 改 Electron 窗口 | `main.js` |
| 改 Electron 数据库 | `db/db/database.js` |
| 改构建流程 | `scripts/copy-www.js` |
| 改部署流程 | `deploy/` 里的脚本 |
| 更新移动端 web 资源 | 跑 `npm run copy:www` |
