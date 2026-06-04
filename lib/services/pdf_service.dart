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

    final filePath = '$outputDir/$fileName';
    final file = File(filePath);
    await file.writeAsBytes(await pdf.save());

    return filePath;
  }

  /// 构建 A4 页面：将照片和标注合成为一张图，放入 PDF
  Future<pw.Page> _buildPage(PhotoItem photo) async {
    final rawBytes = await File(photo.filePath).readAsBytes();
    final compressedBytes = await _compressImage(rawBytes);

    // 如果有标注，渲染标注到图片上
    Uint8List finalBytes;
    if (photo.annotations.isNotEmpty) {
      finalBytes = await _renderAnnotationsToImage(compressedBytes, photo.annotations);
    } else {
      finalBytes = compressedBytes;
    }

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (pw.Context context) {
        return pw.Image(
          pw.MemoryImage(finalBytes),
          fit: pw.BoxFit.contain,
        );
      },
    );
  }

  /// 将标注渲染到图片上
  Future<Uint8List> _renderAnnotationsToImage(
    Uint8List imageBytes,
    List<PhotoAnnotation> annotations,
  ) async {
    final decoded = img.decodeImage(imageBytes);
    if (decoded == null) return imageBytes;

    final width = decoded.width.toDouble();
    final height = decoded.height.toDouble();

    // 用 dart:ui 的 PictureRecorder 绘制标注
    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);

    // 绘制原图
    final codec = await ui.instantiateImageCodec(imageBytes);
    final frame = await codec.getNextFrame();
    canvas.drawImage(frame.image, ui.Offset.zero, ui.Paint());

    // 绘制每个标注
    for (final a in annotations) {
      _drawAnnotationOnCanvas(canvas, a, width, height);
    }

    final picture = recorder.endRecording();
    final renderedImage = await picture.toImage(width.toInt(), height.toInt());
    final pngBytes = await renderedImage.toByteData(format: ui.ImageByteFormat.png);
    final pngData = pngBytes!.buffer.asUint8List();

    // 转回 JPEG
    final resultImage = img.decodePng(pngData);
    if (resultImage != null) {
      return Uint8List.fromList(img.encodeJpg(resultImage, quality: 90));
    }

    return imageBytes;
  }

  void _drawAnnotationOnCanvas(
    ui.Canvas canvas,
    PhotoAnnotation a,
    double width,
    double height,
  ) {
    switch (a.type) {
      case AnnotationType.drawing:
        final d = a as DrawingAnnotation;
        final paint = ui.Paint()
          ..color = d.color
          ..style = ui.PaintingStyle.stroke
          ..strokeWidth = d.strokeWidth
          ..strokeCap = ui.StrokeCap.round;
        for (final stroke in d.strokes) {
          if (stroke.length < 2) continue;
          final path = ui.Path();
          path.moveTo(stroke.first.dx * width, stroke.first.dy * height);
          for (int i = 1; i < stroke.length; i++) {
            path.lineTo(stroke[i].dx * width, stroke[i].dy * height);
          }
          canvas.drawPath(path, paint);
        }
        break;

      case AnnotationType.arrow:
        final arr = a as ArrowAnnotation;
        final paint = ui.Paint()
          ..color = arr.color
          ..style = ui.PaintingStyle.stroke
          ..strokeWidth = 3.0;
        final start = ui.Offset(arr.start.dx * width, arr.start.dy * height);
        final end = ui.Offset(arr.end.dx * width, arr.end.dy * height);
        canvas.drawLine(start, end, paint);
        // 箭头
        final angle = atan2(end.dy - start.dy, end.dx - start.dx);
        const arrowLen = 20.0;
        const arrowAng = 0.5;
        final arrowPath = ui.Path();
        arrowPath.moveTo(end.dx, end.dy);
        arrowPath.lineTo(
          end.dx - arrowLen * cos(angle - arrowAng),
          end.dy - arrowLen * sin(angle - arrowAng),
        );
        arrowPath.lineTo(
          end.dx - arrowLen * cos(angle + arrowAng),
          end.dy - arrowLen * sin(angle + arrowAng),
        );
        arrowPath.close();
        canvas.drawPath(arrowPath, ui.Paint()..color = arr.color);
        break;

      case AnnotationType.text:
        final t = a as TextAnnotation;
        final pos = ui.Offset(t.position.dx * width, t.position.dy * height);
        final builder = ui.ParagraphBuilder(ui.ParagraphStyle(fontSize: t.fontSize))
          ..pushStyle(ui.TextStyle(color: t.color, fontSize: t.fontSize))
          ..addText(t.text);
        final paragraph = builder.build()
          ..layout(ui.ParagraphConstraints(width: width - pos.dx));
        canvas.drawParagraph(paragraph, pos);
        break;
    }
  }

  /// 使用 image 包压缩图片
  Future<Uint8List> _compressImage(Uint8List rawBytes) async {
    final decoded = img.decodeImage(rawBytes);
    if (decoded == null) return rawBytes;

    const maxWidth = 1240;
    img.Image resized = decoded;
    if (decoded.width > maxWidth) {
      resized = img.copyResize(decoded, width: maxWidth);
    }

    return Uint8List.fromList(img.encodeJpg(resized, quality: 85));
  }
}
