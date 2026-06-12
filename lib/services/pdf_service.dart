import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:image/image.dart' as img;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/annotation.dart';
import '../models/photo_item.dart';

/// PDF 生成服务 — 压缩图片 → 渲染标注 → 排版 → 生成 PDF
class PdfService {
  /// 生成 PDF
  Future<String> generatePdf({
    required List<PhotoItem> photos,
    required String fileName,
    required String outputDir,
  }) async {
    final pdf = pw.Document();

    for (final photo in photos) {
      final page = await _buildPage(photo);
      pdf.addPage(page);
    }

    final safeFileName = _sanitizePdfFileName(fileName);

    final dir = Directory(outputDir);
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }

    final filePath = '${dir.path}/$safeFileName';
    final file = File(filePath);

    await file.writeAsBytes(await pdf.save());

    return filePath;
  }

  /// 构建 A4 页面：将照片和标注合成为一张图，放入 PDF
  Future<pw.Page> _buildPage(PhotoItem photo) async {
    final rawBytes = await File(photo.filePath).readAsBytes();

    // 一次完成：解码 → 缩放 → 标注 → JPEG 编码，避免多次有损压缩
    final finalBytes = await _prepareImageForPdf(
      rawBytes,
      photo.annotations,
    );

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: pw.EdgeInsets.zero,
      build: (pw.Context context) {
        return pw.Center(
          child: pw.Image(
            pw.MemoryImage(finalBytes),
            fit: pw.BoxFit.contain,
          ),
        );
      },
    );
  }

  /// 一步完成：解码 → 缩放 → 标注 → JPEG 编码，避免多次有损压缩
  Future<Uint8List> _prepareImageForPdf(
    Uint8List rawBytes,
    List<PhotoAnnotation> annotations,
  ) async {
    final decoded = img.decodeImage(rawBytes);
    if (decoded == null) return rawBytes;

    // 缩放
    const maxWidth = 1240;
    img.Image image = decoded;
    if (image.width > maxWidth) {
      image = img.copyResize(
        image,
        width: maxWidth,
        interpolation: img.Interpolation.average,
      );
    }

    // 无标注：直接编码返回
    if (annotations.isEmpty) {
      return Uint8List.fromList(img.encodeJpg(image, quality: 85));
    }

    // 有标注：在 ui.Canvas 上绘制，用 rawRgba 避免 PNG 中间步骤
    return await _renderAnnotationsToImage(image, annotations);
  }

  /// 在图片上绘制标注，使用 rawRgba 避免 PNG 中间有损步骤
  Future<Uint8List> _renderAnnotationsToImage(
    img.Image sourceImage,
    List<PhotoAnnotation> annotations,
  ) async {
    final width = sourceImage.width.toDouble();
    final height = sourceImage.height.toDouble();
    final jpgBytes = Uint8List.fromList(img.encodeJpg(sourceImage, quality: 95));

    ui.FrameInfo? frame;
    ui.Codec? codec;
    ui.Picture? picture;
    ui.Image? renderedImage;

    try {
      codec = await ui.instantiateImageCodec(jpgBytes);
      frame = await codec.getNextFrame();

      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);

      canvas.drawImage(frame.image, ui.Offset.zero, ui.Paint());

      final scale = _annotationScale(width, height);

      for (final annotation in annotations) {
        _drawAnnotationOnCanvas(
          canvas: canvas,
          annotation: annotation,
          width: width,
          height: height,
          scale: scale,
        );
      }

      picture = recorder.endRecording();

      renderedImage = await picture.toImage(
        width.toInt(),
        height.toInt(),
      );

      // 使用 rawRgba 代替 PNG 作为中间格式，避免额外编解码
      final byteData = await renderedImage.toByteData(
        format: ui.ImageByteFormat.rawRgba,
      );

      if (byteData == null) return jpgBytes;

      final rgba = byteData.buffer.asUint8List();
      final resultImage = img.Image.fromBytes(
        width: width.toInt(),
        height: height.toInt(),
        bytes: rgba.buffer,
        numChannels: 4,
        order: img.ChannelOrder.rgba,
      );

      return Uint8List.fromList(img.encodeJpg(resultImage, quality: 90));
    } catch (_) {
      return jpgBytes;
    } finally {
      frame?.image.dispose();
      codec?.dispose();
      renderedImage?.dispose();
      picture?.dispose();
    }
  }

  void _drawAnnotationOnCanvas({
    required ui.Canvas canvas,
    required PhotoAnnotation annotation,
    required double width,
    required double height,
    required double scale,
  }) {
    switch (annotation.type) {
      case AnnotationType.drawing:
        _drawStrokes(
          canvas: canvas,
          annotation: annotation as DrawingAnnotation,
          width: width,
          height: height,
          scale: scale,
        );
        break;

      case AnnotationType.arrow:
        _drawArrow(
          canvas: canvas,
          annotation: annotation as ArrowAnnotation,
          width: width,
          height: height,
          scale: scale,
        );
        break;

      case AnnotationType.text:
        _drawText(
          canvas: canvas,
          annotation: annotation as TextAnnotation,
          width: width,
          height: height,
          scale: scale,
        );
        break;
    }
  }

  void _drawStrokes({
    required ui.Canvas canvas,
    required DrawingAnnotation annotation,
    required double width,
    required double height,
    required double scale,
  }) {
    final paint = ui.Paint()
      ..color = annotation.color
      ..style = ui.PaintingStyle.stroke
      ..strokeWidth = max(2.0, annotation.strokeWidth * scale)
      ..strokeCap = ui.StrokeCap.round
      ..strokeJoin = ui.StrokeJoin.round;

    for (final stroke in annotation.strokes) {
      if (stroke.length < 2) continue;

      final path = ui.Path();

      path.moveTo(
        stroke.first.dx * width,
        stroke.first.dy * height,
      );

      for (int i = 1; i < stroke.length; i++) {
        path.lineTo(
          stroke[i].dx * width,
          stroke[i].dy * height,
        );
      }

      canvas.drawPath(path, paint);
    }
  }

  void _drawArrow({
    required ui.Canvas canvas,
    required ArrowAnnotation annotation,
    required double width,
    required double height,
    required double scale,
  }) {
    final paint = ui.Paint()
      ..color = annotation.color
      ..style = ui.PaintingStyle.stroke
      ..strokeWidth = max(2.0, 3.0 * scale)
      ..strokeCap = ui.StrokeCap.round;

    final start = ui.Offset(
      annotation.start.dx * width,
      annotation.start.dy * height,
    );

    final end = ui.Offset(
      annotation.end.dx * width,
      annotation.end.dy * height,
    );

    canvas.drawLine(start, end, paint);

    final angle = atan2(
      end.dy - start.dy,
      end.dx - start.dx,
    );

    final arrowLength = 20.0 * scale;
    const arrowAngle = 0.5;

    final arrowPath = ui.Path();

    arrowPath.moveTo(end.dx, end.dy);
    arrowPath.lineTo(
      end.dx - arrowLength * cos(angle - arrowAngle),
      end.dy - arrowLength * sin(angle - arrowAngle),
    );
    arrowPath.lineTo(
      end.dx - arrowLength * cos(angle + arrowAngle),
      end.dy - arrowLength * sin(angle + arrowAngle),
    );
    arrowPath.close();

    canvas.drawPath(
      arrowPath,
      ui.Paint()
        ..color = annotation.color
        ..style = ui.PaintingStyle.fill,
    );
  }

  /// 绘制文字 — 与 AnnotationPainter 保持接近：白字 + 深色半透明背景 + 彩色边框
  void _drawText({
    required ui.Canvas canvas,
    required TextAnnotation annotation,
    required double width,
    required double height,
    required double scale,
  }) {
    final position = ui.Offset(
      annotation.position.dx * width,
      annotation.position.dy * height,
    );

    final fontSize = max(18.0, annotation.fontSize * scale);
    final horizontalPadding = 8.0 * scale;
    final verticalPadding = 4.0 * scale;
    final radius = 6.0 * scale;

    final maxTextWidth = max(
      80.0,
      width - position.dx - horizontalPadding * 2 - 16.0,
    );

    final builder = ui.ParagraphBuilder(
      ui.ParagraphStyle(
        fontSize: fontSize,
        maxLines: 6,
        ellipsis: '…',
      ),
    )
      ..pushStyle(
        ui.TextStyle(
          color: const ui.Color(0xFFFFFFFF),
          fontSize: fontSize,
          fontWeight: ui.FontWeight.w600,
        ),
      )
      ..addText(annotation.text);

    final paragraph = builder.build()
      ..layout(
        ui.ParagraphConstraints(width: maxTextWidth),
      );

    final bgRect = ui.RRect.fromRectAndRadius(
      ui.Rect.fromLTWH(
        position.dx - horizontalPadding,
        position.dy - verticalPadding,
        paragraph.width + horizontalPadding * 2,
        paragraph.height + verticalPadding * 2,
      ),
      ui.Radius.circular(radius),
    );

    canvas.drawRRect(
      bgRect,
      ui.Paint()..color = const ui.Color(0xBB000000),
    );

    canvas.drawRRect(
      bgRect,
      ui.Paint()
        ..color = annotation.color.withOpacity(0.6)
        ..style = ui.PaintingStyle.stroke
        ..strokeWidth = max(1.0, 1.5 * scale),
    );

    canvas.drawParagraph(paragraph, position);
  }

  /// 根据图片尺寸估算标注缩放比例
  double _annotationScale(double width, double height) {
    final shortSide = min(width, height);

    if (shortSide <= 0) return 1.0;

    final scale = shortSide / 390.0;

    return scale.clamp(1.0, 3.2).toDouble();
  }

  String _sanitizePdfFileName(String fileName) {
    var name = fileName.trim();

    if (name.isEmpty) {
      name = '未命名PDF';
    }

    name = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');

    if (!name.toLowerCase().endsWith('.pdf')) {
      name = '$name.pdf';
    }

    return name;
  }
}