import 'dart:typed_data';
import 'package:image/image.dart' as img;
import '../models/photo_item.dart';

/// 图片处理服务 — 增强、裁剪
class ImageService {
  /// 画质增强：轻度提亮 + 锐化（仿布丁扫描风格）
  Future<Uint8List> enhance(Uint8List rawBytes) async {
    final image = img.decodeImage(rawBytes);
    if (image == null) return rawBytes;

    // 1. 轻度提亮
    var result = img.adjustColor(image, brightness: 1.08);

    // 2. 饱和度微调
    result = img.adjustColor(result, saturation: 1.05);

    // 3. 温和锐化 — 让文字边缘更清晰
    const sharpenKernel = <num>[
      0, -0.3, 0,
      -0.3, 2.2, -0.3,
      0, -0.3, 0,
    ];
    result = img.convolution(result, filter: sharpenKernel, div: 1.0, offset: 0);

    // 4. 高画质编码
    return Uint8List.fromList(img.encodeJpg(result, quality: 95));
  }

  /// 裁剪
  Future<Uint8List> crop(Uint8List rawBytes, CropRect cropRect) async {
    final image = img.decodeImage(rawBytes);
    if (image == null) return rawBytes;

    final x = (cropRect.left * image.width).round().clamp(0, image.width - 1);
    final y = (cropRect.top * image.height).round().clamp(0, image.height - 1);
    final w = (cropRect.width * image.width).round().clamp(1, image.width - x);
    final h = (cropRect.height * image.height).round().clamp(1, image.height - y);

    final cropped = img.copyCrop(image, x: x, y: y, width: w, height: h);
    return Uint8List.fromList(img.encodeJpg(cropped, quality: 90));
  }
}
