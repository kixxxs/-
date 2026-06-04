import 'dart:math';
import 'package:flutter/material.dart';
import '../models/annotation.dart';

/// CustomPainter 用于在屏幕上绘制标注
class AnnotationPainter extends CustomPainter {
  final List<PhotoAnnotation> annotations;
  final PhotoAnnotation? drawingAnnotation;

  AnnotationPainter({
    required this.annotations,
    this.drawingAnnotation,
  });

  @override
  void paint(Canvas canvas, Size size) {
    for (final a in annotations) {
      _drawAnnotation(canvas, size, a);
    }
    if (drawingAnnotation != null) {
      _drawAnnotation(canvas, size, drawingAnnotation!);
    }
  }

  void _drawAnnotation(Canvas canvas, Size size, PhotoAnnotation a) {
    switch (a.type) {
      case AnnotationType.drawing:
        _drawStrokes(canvas, size, a as DrawingAnnotation);
        break;
      case AnnotationType.arrow:
        _drawArrow(canvas, size, a as ArrowAnnotation);
        break;
      case AnnotationType.text:
        _drawText(canvas, size, a as TextAnnotation);
        break;
    }
  }

  /// 绘制自由绘制路径
  void _drawStrokes(Canvas canvas, Size size, DrawingAnnotation a) {
    final paint = Paint()
      ..color = a.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = a.strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (final stroke in a.strokes) {
      if (stroke.length < 2) continue;
      final path = Path();
      final first = Offset(
        stroke.first.dx * size.width,
        stroke.first.dy * size.height,
      );
      path.moveTo(first.dx, first.dy);
      for (int i = 1; i < stroke.length; i++) {
        final point = Offset(
          stroke[i].dx * size.width,
          stroke[i].dy * size.height,
        );
        path.lineTo(point.dx, point.dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  /// 绘制箭头
  void _drawArrow(Canvas canvas, Size size, ArrowAnnotation a) {
    final paint = Paint()
      ..color = a.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;

    final start = Offset(a.start.dx * size.width, a.start.dy * size.height);
    final end = Offset(a.end.dx * size.width, a.end.dy * size.height);

    canvas.drawLine(start, end, paint);

    final angle = atan2(end.dy - start.dy, end.dx - start.dx);
    const arrowLength = 20.0;
    const arrowAngle = 0.5;

    final path = Path();
    path.moveTo(end.dx, end.dy);
    path.lineTo(
      end.dx - arrowLength * cos(angle - arrowAngle),
      end.dy - arrowLength * sin(angle - arrowAngle),
    );
    path.lineTo(
      end.dx - arrowLength * cos(angle + arrowAngle),
      end.dy - arrowLength * sin(angle + arrowAngle),
    );
    path.close();

    canvas.drawPath(
      path,
      Paint()..color = a.color..style = PaintingStyle.fill,
    );
  }

  /// 绘制文字 — WeChat 截图风格（白字 + 深色半透明圆角背景）
  void _drawText(Canvas canvas, Size size, TextAnnotation a) {
    final position = Offset(a.position.dx * size.width, a.position.dy * size.height);

    final textPainter = TextPainter(
      text: TextSpan(
        text: a.text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w600,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout(maxWidth: size.width - position.dx - 30);

    // 深色半透明圆角背景
    final bgRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        position.dx - 8,
        position.dy - 4,
        textPainter.width + 16,
        textPainter.height + 8,
      ),
      const Radius.circular(6),
    );
    canvas.drawRRect(bgRect, Paint()..color = const Color(0xBB000000));

    // 细边框
    canvas.drawRRect(
      bgRect,
      Paint()
        ..color = a.color.withOpacity(0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    textPainter.paint(canvas, position);
  }

  @override
  bool shouldRepaint(covariant AnnotationPainter oldDelegate) {
    return annotations != oldDelegate.annotations ||
        drawingAnnotation != oldDelegate.drawingAnnotation;
  }
}
