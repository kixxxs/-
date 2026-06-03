# 艺人管理系统 — macOS 桌面端 + iOS 手机端 构建教程（零基础版）

---

## 开始之前：认识"终端"

Mac 上有一个黑色图标的软件叫 **"终端"**（英文名 Terminal），图标长这样：🖥️💻 一个黑色窗口带白色 `>_` 符号。

**怎么打开**：点击 Mac 桌面右上角的放大镜 🔍 → 输入"终端" → 回车。

打开后是一个可以输入文字命令的窗口，本教程所有带 `$` 前缀的代码，都是**在这里面粘贴然后回车执行**。

> 提示：`$` 不用输入，只输入 `$` 后面的内容。比如 `$ cd ~/Desktop` 表示你只需要输入 `cd ~/Desktop` 然后回车。

---

## 第一步：安装必要软件

### 1. 安装 Node.js（必须）

1. 打开浏览器，访问 https://nodejs.org
2. 下载 **LTS 版本**（左边绿色按钮，版本号大概是 20.x）
3. 下载完成后双击 `.pkg` 文件，一路点"继续"安装
4. 装完后，在终端输入以下命令验证：

```
node -v
```

如果显示 `v20.x.x` 就表示装好了。

### 2. 安装 Xcode（iOS 构建需要）

1. 打开 Mac 上的 **App Store**
2. 搜索 **Xcode**
3. 点击"获取"→ 等待下载安装（很大，约 12GB，需要半小时左右）
4. 装完后，在终端输入以下命令验证：

```
xcode-select --version
```

---

## 第二步：把项目文件放到 Mac 桌面

1. 把 `artist-manager-mac-ios.tar.gz`（4MB）通过 U盘 / AirDrop / 微信 等方式传到 Mac 上
2. 把文件拖到 Mac **桌面**
3. 在终端执行以下命令解压：

```
cd ~/Desktop
tar -xzf artist-manager-mac-ios.tar.gz
```

执行完后桌面上会多一个 `artist-manager` 文件夹。

---

## 第三步：安装项目依赖

在终端执行（一行一行来，每行输完按回车，等执行完再输下一行）：

```
cd ~/Desktop/artist-manager
```

（这行的意思是"进入桌面的 artist-manager 文件夹"）

```
npm install
```

（这行的意思是"安装项目需要的所有依赖包"，需要 2-5 分钟，耐心等）

```
npx cap add ios
```

（这行的意思是"创建 iOS 项目文件夹"，很快完成）

---

## 第四步：生成 Mac 图标

先把 `应用图标.png` 放到桌面（它已经在 `artist-manager` 文件夹里了），然后在终端执行：

```
cd ~/Desktop/artist-manager
mkdir -p tmp/icon.iconset
sips -z 16 16 应用图标.png --out tmp/icon.iconset/icon_16x16.png
sips -z 32 32 应用图标.png --out tmp/icon.iconset/icon_16x16@2x.png
sips -z 32 32 应用图标.png --out tmp/icon.iconset/icon_32x32.png
sips -z 64 64 应用图标.png --out tmp/icon.iconset/icon_32x32@2x.png
sips -z 128 128 应用图标.png --out tmp/icon.iconset/icon_128x128.png
sips -z 256 256 应用图标.png --out tmp/icon.iconset/icon_128x128@2x.png
sips -z 256 256 应用图标.png --out tmp/icon.iconset/icon_256x256.png
sips -z 512 512 应用图标.png --out tmp/icon.iconset/icon_256x256@2x.png
sips -z 512 512 应用图标.png --out tmp/icon.iconset/icon_512x512.png
sips -z 1024 1024 应用图标.png --out tmp/icon.iconset/icon_512x512@2x.png
iconutil -c icns tmp/icon.iconset -o build/icon.icns
rm -rf tmp/icon.iconset
```

（可以直接一次性全部复制粘贴到终端，然后回车）

---

## 第五步：构建 macOS 桌面安装包

在终端执行：

```
cd ~/Desktop/artist-manager
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npx electron-builder --mac
```

（最后一个命令需要 5-15 分钟，因为要从网上下载 Electron 框架）

构建完成后，安装包在 `dist` 文件夹里：
- `dist/artist-manager-setup.dmg` — **双击安装**
- `dist/artist-manager-setup-mac.zip` — 解压直接用

---

## 第六步：构建 iOS App

### 6.1 同步前端代码

```
cd ~/Desktop/artist-manager
npm run copy:www
npx cap sync ios
```

> ⚠️ **重要：如果登录后连不上云端（HTTP 被拦截）**
> 
> iOS 默认禁止 HTTP 连接。`capacitor.config.ts` 里已经配置了允许 `42.194.230.53` 的 HTTP 访问，但需要同步到 iOS 项目。
> 执行：`npx cap sync ios`，然后在 Xcode 中重新点 ▶ 运行。
> 
> 如果还是不行，手动检查：Xcode 左侧找到 `Info.plist`，确认里面包含 `NSAppTransportSecurity` → `NSExceptionDomains` → `42.194.230.53`。

### 6.2 打开 Xcode

```
npx cap open ios
```

这会自动打开 Xcode。

### 6.3 在 Xcode 中配置签名

1. Xcode 左侧文件列表中，点击最顶部的蓝色 **App** 图标
2. 中间区域选择 **Signing & Capabilities**
3. 勾选 ✅ **Automatically manage signing**
4. Team 下拉框选择你的 **Apple ID**
   - 如果没有，点 Add Account → 输入 Apple ID 和密码
   - 免费 Apple ID 就可以，只是每 7 天要重新签名一次

### 6.4 设置 iOS App 图标

macOS 桌面端的图标是第四步生成的 `build/icon.icns`，它跟 iOS 用的是不同格式，需要单独设置。

1. 在 Xcode 左侧文件列表中，找到并点击 **Assets**（蓝色文件夹图标）
2. 在 Assets 里面，找到 **AppIcon**（应用图标集）
3. 你会看到一堆空白的图标占位框（20pt、29pt、40pt、60pt、1024pt 等）
4. 把项目里的 **`应用图标.png`**（1024x1024）从 Finder 拖到 Xcode 的 AppIcon 里
5. 拖到 **1024pt 那个框**（标记为 "App Store iOS 1024pt"），Xcode 会**自动**裁剪生成其他所有尺寸
6. 如果还有其他空白框没自动填充，把同一个 1024 图再拖到对应框里即可

> 注意：`应用图标.png` 本身必须是 1024x1024 像素且**不能有透明通道**（Alpha channel），否则 Xcode 会报错。

### 6.5 连手机运行测试

1. 用数据线把 iPhone 插到 Mac 上
2. iPhone 弹出"要信任此电脑吗"→ 点"信任"
3. Xcode 顶部工具栏，设备选择器选择你的 iPhone
4. 点 ▶ 运行按钮
5. 第一次运行会提示"不受信任的开发者"
   - 手机上：设置 → 通用 → VPN与设备管理 → 点你的 Apple ID → 信任

> ⚠️ **重要：首次启动需要登录云端**
> 
> App 装到手机上后，首次打开会显示**登录页面**。iOS 不会自动连接云端，需要手动输入：
> - **服务器地址**：`http://42.194.230.53:8080`
> - **账号**：`admin`
> - **密码**：`hezong123`
> 
> 登录成功后就自动切换到云端模式了。macOS 桌面端也是同样的流程，只是因为你之前可能已经登录过一次，所以记住了。

### 6.6 导出 IPA 安装包（发给别人装）

1. Xcode 菜单栏 → **Product** → **Archive**
2. 等待打包完成（弹出新窗口）
3. 点击 **Distribute App**
4. 选择分发方式：
   - **Enterprise**（需要企业账号 $299/年）→ 导出 IPA，上传服务器，任意设备 OTA 安装
   - **Ad Hoc**（普通开发者 $99/年）→ 限 100 台已注册设备
   - **Development**（免费账号）→ 仅自己设备，7 天有效

导出后把 `artist-manager.ipa` 上传到服务器即可实现在线升级。

---

## 输出文件汇总

| 平台 | 文件名 | 在哪 |
|------|--------|------|
| macOS 桌面 | `artist-manager-setup.dmg` | `dist/` 文件夹 |
| macOS 桌面 | `artist-manager-setup-mac.zip` | `dist/` 文件夹 |
| iOS 手机 | `artist-manager.ipa` | Xcode Archive 导出 |

---

## 常见报错

| 报错 | 解决 |
|------|------|
| `command not found: npm` | Node.js 没装好，重新安装 https://nodejs.org |
| `electron-builder 下载超时` | 执行 `export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` 后重试 |
| `Xcode 签名报错` | 检查 Xcode → Signing 里 Team 是否选中，Apple ID 是否已添加 |
| `iOS 安装后打不开` | 手机设置 → 通用 → VPN与设备管理 → 信任开发者 |
