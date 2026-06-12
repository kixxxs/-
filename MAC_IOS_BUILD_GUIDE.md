# 艺人管理系统 — macOS 桌面端 + iOS 手机端 更新/构建教程

---

## 情况 A：Mac 上已有旧项目，只需要更新代码

（适用于之前已经装过 Node.js、Xcode、`npm install` 过的情况）

### 1. 把最新代码包拷到 Mac 桌面上

新的 [artist-manager-mac-ios.tar.gz] 放到 Mac 桌面。

### 2. 覆盖更新

打开终端，执行：

```
cd ~/Desktop
tar -xzf artist-manager-mac-ios.tar.gz -C ~/Desktop/artist-manager
```

这会把最新的前端代码、配置文件覆盖到已有项目里。

### 3. 构建 macOS 桌面安装包

```
cd ~/Desktop/artist-manager
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npx electron-builder --mac
```

（如果是老款 Intel Mac，末尾加 `--x64`：`npx electron-builder --mac --x64`）

输出：`dist/艺人管理系统-1.0.1-arm64.dmg`

### 4. 更新 iOS 项目并导出 IPA

```
cd ~/Desktop/artist-manager
npm run copy:www
npx cap sync ios
npx cap open ios
```

Xcode 打开后：

1. 选 **Product → Archive**
2. 等待打包完成 → **Distribute App → Enterprise**
3. 导出 `App.ipa`

### 5. 上传 IPA 到服务器

```
scp ~/Desktop/App*.ipa ubuntu@106.53.6.92:/tmp/App.ipa
ssh ubuntu@106.53.6.92 "sudo cp /tmp/App.ipa /app/updates/artist-manager.ipa && sudo systemctl restart artist-manager"
```

---

## 情况 B：Mac 上什么都没有，全新从零开始

### 开始之前：认识"终端"

Mac 上有一个软件叫 **"终端"**（Terminal）。点击桌面右上角的放大镜 🔍 → 输入"终端" → 回车，就打开了可以输入命令的黑窗口。

> 下面所有代码块里的内容，直接复制粘贴到终端，然后按回车执行。

---

### 第一步：安装必要软件

**安装 Node.js**：浏览器打开 https://nodejs.org → 下载 LTS 版本 → 双击 `.pkg` 安装。

验证：
```
node -v
```
显示 `v20.x.x` 即成功。

**安装 Xcode**：App Store 搜索 Xcode → 获取 → 等待安装（约 12GB，半小时）。

---

### 第二步：解压项目

把 `artist-manager-mac-ios.tar.gz` 放到 Mac 桌面，终端执行：

```
cd ~/Desktop
tar -xzf artist-manager-mac-ios.tar.gz
```

桌面多出 `artist-manager` 文件夹。

---

### 第三步：安装依赖

```
cd ~/Desktop/artist-manager
npm install
npx cap add ios
```

---

### 第四步：生成 Mac 图标

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

---

### 第五步：构建 macOS 桌面安装包

```
cd ~/Desktop/artist-manager
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npx electron-builder --mac
```

（Intel Mac 加 `--x64`：`npx electron-builder --mac --x64`）

输出在 `dist/` 文件夹。

---

### 第六步：构建 iOS App

**6.1 同步代码**
```
cd ~/Desktop/artist-manager
npm run copy:www
npx cap sync ios
```

**6.2 打开 Xcode**
```
npx cap open ios
```

**6.3 配置签名**：Xcode → 左侧点 App → Signing & Capabilities → 勾选 Automatically manage signing → Team 选你的 Apple ID。

**6.4 设置 App 图标**：Xcode → Assets → AppIcon → 从 Finder 把 `应用图标.png` 拖到 1024pt 框。

**6.5 导出 IPA**：Xcode → Product → Archive → Distribute App → Enterprise → 导出 `App.ipa`。

**6.6 上传到服务器**：
```
scp ~/Desktop/App*.ipa ubuntu@106.53.6.92:/tmp/App.ipa
ssh ubuntu@106.53.6.92 "sudo cp /tmp/App.ipa /app/updates/artist-manager.ipa && sudo systemctl restart artist-manager"
```

---

## 输出文件汇总

| 平台 | 文件名 | 在哪 |
|------|--------|------|
| macOS 桌面 | `artist-manager-setup.dmg` | `dist/` 文件夹 |
| macOS 桌面 | `artist-manager-setup-mac.zip` | `dist/` 文件夹 |
| iOS 手机 | `artist-manager.ipa` | Xcode Archive 导出 → 上传到服务器 |

---

## 常见报错

| 报错 | 解决 |
|------|------|
| `command not found: npm` | Node.js 没装好 https://nodejs.org |
| `electron-builder 下载超时` | 先执行 `export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` |
| `Xcode 签名报错` | 检查 Signing → Team 是否选中 |
| `iOS 安装后打不开` | 手机：设置 → 通用 → VPN与设备管理 → 信任 |
| `HTTP 被拦截` | `capacitor.config.ts` 已配置 ATS 白名单，`npx cap sync ios` 同步即可 |
