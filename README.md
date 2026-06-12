# 拍照生成PDF

## 环境要求

- Flutter 3.24.x
- JDK 17
- Android SDK (compileSdk 35, minSdk 24)
- 仅 arm64-v8a 架构

## 快速构建

```bash
# 1. 安装依赖
flutter pub get

# 2. 构建 APK
flutter build apk --release --target-platform android-arm64
```

## 国内网络设置

```bash
export PUB_HOSTED_URL=https://pub.flutter-io.cn
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
export JAVA_HOME=<JDK17路径>
```

## 项目结构

```
lib/
├── main.dart              # 入口 + 路由
├── models/
│   ├── photo_item.dart    # 照片数据模型
│   └── annotation.dart    # 标注数据模型
├── pages/
│   ├── camera_page.dart   # 拍照页
│   ├── edit_page.dart     # 编辑页（排序/标注/裁剪/增强）
│   ├── annotation_page.dart  # 标注页（画笔/箭头/文字）
│   ├── crop_page.dart     # 裁剪页
│   └── generate_page.dart # 生成PDF页
├── providers/
│   └── photo_provider.dart # 全局状态管理
├── services/
│   ├── camera_service.dart  # 相机服务
│   ├── image_service.dart   # 图片处理（裁剪 + OpenCV增强）
│   ├── pdf_service.dart     # PDF生成
│   └── storage_service.dart # 文件存储
└── widgets/                 # UI组件
```

## 增强管线（当前版本）

```
bilateralFilter(5,50,50) → CLAHE(2.0, 8x8)
  → adaptiveThreshold(INV, blockSize=15, C=5)
  → MORPH_OPEN(2x2, 1) → MORPH_CLOSE(2x2, 1)
  → bitwiseNOT → JPEG
```

关键依赖：`opencv_dart: ^1.4.3`
