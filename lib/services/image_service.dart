import 'dart:typed_data';
import 'package:image/image.dart' as img;
import '../models/photo_item.dart';

/// 图片处理服务 — 裁剪
class ImageService {
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
