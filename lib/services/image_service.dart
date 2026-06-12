import 'dart:typed_data';
import 'package:opencv_dart/opencv_dart.dart' as cv;
import '../models/photo_item.dart';

/// 图片处理服务 — 稳定防黑屏全 OpenCV 驱动版
class ImageService {
  
  /// 极速裁剪 — 内存级安全切割
  Future<Uint8List> crop(Uint8List rawBytes, CropRect cropRect) async {
    final src = cv.imdecode(rawBytes, cv.IMREAD_COLOR);
    if (src.isEmpty) throw Exception('图片解码失败');

    final imgWidth = src.cols;
    final imgHeight = src.rows;

    final x = (cropRect.left * imgWidth).round().clamp(0, imgWidth - 1);
    final y = (cropRect.top * imgHeight).round().clamp(0, imgHeight - 1);
    final w = (cropRect.width * imgWidth).round().clamp(1, imgWidth - x);
    final h = (cropRect.height * imgHeight).round().clamp(1, imgHeight - y);

    final rect = cv.Rect(x, y, w, h);
    final cropped = src.region(rect);

    final (success, jpgBytes) = cv.imencode('.jpg', cropped);
    src.dispose();
    if (!success) throw Exception('裁剪编码失败');
    return jpgBytes;
  }

  /// 稳定版画质增强 — 精准处理防黑块
  Future<Uint8List> enhance(Uint8List rawBytes) async {
    final src = cv.imdecode(rawBytes, cv.IMREAD_COLOR);
    if (src.isEmpty) throw Exception('图片解码失败');

    try {
      // 1. 灰度化
      final gray = cv.cvtColor(src, cv.COLOR_BGR2GRAY);

      // 2. 双边滤波 — 温和去噪
      final filtered = cv.bilateralFilter(gray, 5, 30, 30);

      // 3. CLAHE 光照均衡
      final clahe = cv.CLAHE.create(1.5, (8, 8));
      final enhanced = clahe.apply(filtered);

      // 4. 自适应阈值二值化 — 回归之前测试最好的文字清晰参数
      final binary = cv.adaptiveThreshold(
        enhanced,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        21,
        9,
      );

      // 5. 形态学开运算 — 轻量去噪
      final openKernel = cv.getStructuringElement(cv.MORPH_RECT, (2, 2));
      final opened = cv.morphologyEx(binary, cv.MORPH_OPEN, openKernel, iterations: 1);

      // 6. 取反 — 翻转回黑字白底
      final inverted = cv.bitwiseNOT(opened);

      // 7. 关键防错：将单通道灰度图转回 3 通道 BGR 确保各种格式下的 PDF 和 Image 组件能正常渲染
      final result = cv.cvtColor(inverted, cv.COLOR_GRAY2BGR);

      // 8. 编码压缩输出
      final (success, jpgBytes) = cv.imencode('.jpg', result);
      if (!success) throw Exception('图片编码失败');
      return jpgBytes;
    } finally {
      src.dispose();
    }
  }
}
