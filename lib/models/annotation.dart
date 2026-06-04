import 'dart:ui';

/// 标注类型枚举
enum AnnotationType { drawing, arrow, text }

/// 标注基类
class PhotoAnnotation {
  final String id;
  final AnnotationType type;
  final Color color;

  PhotoAnnotation({
    required this.id,
    required this.type,
    this.color = const Color(0xFFFF0000),
  });
}

/// 自由绘制标注（替代之前的圆圈，支持任意手绘路径）
class DrawingAnnotation extends PhotoAnnotation {
  /// 存储多段绘制路径，每段是一系列归一化坐标点 [0,1]
  final List<List<Offset>> strokes;
  final double strokeWidth;

  DrawingAnnotation({
    required super.id,
    required this.strokes,
    this.strokeWidth = 3.0,
    super.color = const Color(0xFFFF0000),
  }) : super(type: AnnotationType.drawing);
}

/// 箭头标注
class ArrowAnnotation extends PhotoAnnotation {
  final Offset start;
  final Offset end;

  ArrowAnnotation({
    required super.id,
    required this.start,
    required this.end,
    super.color = const Color(0xFFFF0000),
  }) : super(type: AnnotationType.arrow);
}

/// 文字标注（支持移动位置）
class TextAnnotation extends PhotoAnnotation {
  final Offset position;
  final String text;
  final double fontSize;

  TextAnnotation({
    required super.id,
    required this.position,
    required this.text,
    this.fontSize = 24.0,
    super.color = const Color(0xFFFF0000),
  }) : super(type: AnnotationType.text);

  TextAnnotation copyWith({Offset? position, String? text, Color? color}) {
    return TextAnnotation(
      id: id,
      position: position ?? this.position,
      text: text ?? this.text,
      fontSize: fontSize,
      color: color ?? this.color,
    );
  }
}
