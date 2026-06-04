#!/bin/bash
# ======================================================
# 拍照生成 PDF App — 一键环境配置 & 构建脚本
# ======================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== 拍照生成 PDF App 环境配置 ===${NC}"

# 检测网络环境，自动使用镜像
FLUTTER_MIRROR="https://storage.flutter-io.cn"
PUB_MIRROR="https://pub.flutter-io.cn"
echo -e "${YELLOW}使用 Flutter 中国镜像加速下载${NC}"
export FLUTTER_STORAGE_BASE_URL="$FLUTTER_MIRROR"
export PUB_HOSTED_URL="$PUB_MIRROR"

# 1. 确认 Flutter 可用
if ! command -v flutter &>/dev/null; then
    if [ -d "$HOME/flutter/bin" ]; then
        export PATH="$HOME/flutter/bin:$PATH"
    else
        echo -e "${RED}Flutter 未安装，请先安装 Flutter${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Flutter: $(flutter --version 2>/dev/null | head -1)${NC}"

# 2. 安装 Java（如果缺失）
if ! command -v java &>/dev/null; then
    echo -e "${YELLOW}Java 未安装，正在下载 Adoptium JDK 17...${NC}"
    JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.15%2B6/OpenJDK17U-jdk_x64_mac_hotspot_17.0.15_6.tar.gz"
    curl -L -o /tmp/jdk17.tar.gz "$JDK_URL"
    sudo mkdir -p /Library/Java/JavaVirtualMachines
    cd /tmp && sudo tar xzf jdk17.tar.gz -C /Library/Java/JavaVirtualMachines/
    rm -f /tmp/jdk17.tar.gz
    echo -e "${GREEN}✓ JDK 17 安装完成${NC}"
else
    echo -e "${GREEN}✓ Java: $(java -version 2>&1 | head -1)${NC}"
fi

# 3. 安装 Android SDK（如果缺失）
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo -e "${YELLOW}Android SDK 未安装，正在下载...${NC}"
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    cd "$ANDROID_HOME/cmdline-tools"
    curl -L -o cmdline-tools.zip \
        "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
    unzip -qo cmdline-tools.zip
    rm -f cmdline-tools.zip
    # 组织目录结构
    if [ ! -d "latest" ]; then
        mkdir -p latest
        # 移动所有文件到 latest/
        find . -maxdepth 1 -not -name 'latest' -not -name '.' -exec mv {} latest/ \; 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Android SDK cmdline-tools 安装完成${NC}"
fi

# 安装必需的 SDK 组件
echo -e "${YELLOW}安装 Android SDK 组件...${NC}"
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "platform-tools" 2>&1 | tail -5
echo -e "${GREEN}✓ Android SDK 组件安装完成${NC}"

# 4. 接受 Android 许可
echo -e "${YELLOW}接受 Android SDK 许可...${NC}"
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses 2>&1 | tail -5

# 5. 配置 Flutter Android SDK 路径
flutter config --android-sdk "$ANDROID_HOME"

# 6. 安装 Flutter 依赖
echo -e "${YELLOW}安装 Flutter 项目依赖...${NC}"
cd "$(dirname "$0")"
flutter pub get
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 7. 静态分析
echo -e "${YELLOW}运行静态分析...${NC}"
flutter analyze

# 8. 构建 APK
echo -e "${YELLOW}构建 Debug APK...${NC}"
flutter build apk --debug

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 构建完成!${NC}"
echo -e "${GREEN}  APK 位置: build/app/outputs/flutter-apk/app-debug.apk${NC}"
echo -e "${GREEN}========================================${NC}"
