import 'annotation.dart';

/// 裁剪矩形（归一化坐标 0-1）
class CropRect {
  final double left;
  final double top;
  final double width;
  final double height;

  const CropRect({
    this.left = 0,
    this.top = 0,
    this.width = 1,
    this.height = 1,
  });

  CropRect copyWith({double? left, double? top, double? width, double? height}) {
    return CropRect(
      left: left ?? this.left,
      top: top ?? this.top,
      width: width ?? this.width,
      height: height ?? this.height,
    );
  }
}

/// 照片数据模型
class PhotoItem {
  final String id;
  final String filePath;
  final List<PhotoAnnotation> annotations;
  final int orderIndex;
  final CropRect? cropRect;
  final bool isEnhanced;

  PhotoItem({
    required this.id,
    required this.filePath,
    List<PhotoAnnotation>? annotations,
    this.orderIndex = 0,
    this.cropRect,
    this.isEnhanced = false,
  }) : annotations = annotations ?? [];

  PhotoItem copyWith({
    String? id,
    String? filePath,
    List<PhotoAnnotation>? annotations,
    int? orderIndex,
    CropRect? cropRect,
    bool? isEnhanced,
    bool clearCrop = false,
  }) {
    return PhotoItem(
      id: id ?? this.id,
      filePath: filePath ?? this.filePath,
      annotations: annotations ?? List.from(this.annotations),
      orderIndex: orderIndex ?? this.orderIndex,
      cropRect: clearCrop ? null : (cropRect ?? this.cropRect),
      isEnhanced: isEnhanced ?? this.isEnhanced,
    );
  }
}
