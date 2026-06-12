import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/photo_item.dart';
import '../providers/photo_provider.dart';

/// 裁剪页 — 可拖拽的裁剪框，确认时正确映射到图片坐标
class CropPage extends StatefulWidget {
  final int photoIndex;

  const CropPage({super.key, required this.photoIndex});

  @override
  State<CropPage> createState() => _CropPageState();
}

class _CropPageState extends State<CropPage> {
  double _left = 0.08, _top = 0.08, _right = 0.92, _bottom = 0.92;
  bool _isProcessing = false;
  String? _dragTarget;
  Offset? _moveStart;
  int _imgW = 1, _imgH = 1;
  Size _displaySize = Size.zero;

  double get width => _right - _left;
  double get height => _bottom - _top;

  @override
  void initState() {
    super.initState();
    _loadImgSize();
  }

  Future<void> _loadImgSize() async {
    final p = context.read<PhotoProvider>();
    final photo = p.photos[widget.photoIndex];
    final file = File(photo.filePath);
    if (!await file.exists()) return;
    final bytes = await file.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final w = frame.image.width;
    final h = frame.image.height;
    frame.image.dispose();
    codec.dispose();
    if (mounted) {
      setState(() {
        _imgW = w;
        _imgH = h;
      });
    }
  }

  /// 将屏幕归一化坐标转为图片归一化坐标（考虑 BoxFit.contain 留黑）
  CropRect _toImageCrop() {
    final screen = _displaySize;
    if (_imgW <= 1 || _imgH <= 1 || screen.width <= 0 || screen.height <= 0) {
      return const CropRect(left: 0, top: 0, width: 1, height: 1);
    }
    final imgAspect = _imgW / _imgH;
    final screenAspect = screen.width / screen.height;
    double dispL, dispT, dispW, dispH;

    if (screenAspect > imgAspect) {
      dispH = screen.height;
      dispW = screen.height * imgAspect;
      dispL = (screen.width - dispW) / 2;
      dispT = 0.0;
    } else {
      dispW = screen.width;
      dispH = screen.width / imgAspect;
      dispL = 0.0;
      dispT = (screen.height - dispH) / 2;
    }

    double s2iX(double sx) => ((sx * screen.width - dispL) / dispW).clamp(0.0, 1.0);
    double s2iY(double sy) => ((sy * screen.height - dispT) / dispH).clamp(0.0, 1.0);

    final iL = s2iX(_left);
    final iT = s2iY(_top);
    final iR = s2iX(_right);
    final iB = s2iY(_bottom);
    return CropRect(
      left: iL,
      top: iT,
      width: (iR - iL).clamp(0.01, 1.0),
      height: (iB - iT).clamp(0.01, 1.0),
    );
  }

  bool get _isImageReady => _imgW > 1 && _imgH > 1;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PhotoProvider>();
    final photo = provider.photos[widget.photoIndex];

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black87,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('裁剪照片', style: TextStyle(color: Colors.white)),
        actions: [
          TextButton(
            onPressed: _isProcessing ? null : _reset,
            child: const Text('重置', style: TextStyle(color: Colors.white70)),
          ),
          TextButton(
            onPressed: (_isProcessing || !_isImageReady) ? null : () => _applyCrop(provider),
            child: Text(_isImageReady ? '应用' : '加载中…', style: TextStyle(color: _isImageReady ? Colors.green : Colors.grey)),
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          _displaySize = Size(constraints.maxWidth, constraints.maxHeight);
          return GestureDetector(
            onPanStart: _onPanStartSimple,
            onPanUpdate: _onPanUpdateSimple,
            onPanEnd: _onPanEnd,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.file(File(photo.filePath), fit: BoxFit.contain),
                CustomPaint(
                  painter: _CropOverlayPainter(
                    left: _left, top: _top, right: _right, bottom: _bottom,
                  ),
                ),
                if (_isProcessing)
                  const Center(child: CircularProgressIndicator(color: Colors.white)),
              ],
            ),
          );
        },
      ),
    );
  }

  void _reset() {
    setState(() {
      _left = 0.08; _top = 0.08; _right = 0.92; _bottom = 0.92;
    });
  }

  Future<void> _applyCrop(PhotoProvider provider) async {
    setState(() => _isProcessing = true);
    try {
      final cropRect = _toImageCrop(); // 使用 LayoutBuilder 获取的实际显示尺寸
      await provider.cropPhoto(widget.photoIndex, cropRect);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('裁剪完成'), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('裁剪失败: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  // ─── 手势处理 ───

  void _onPanStartSimple(DragStartDetails details) {
    final size = _displaySize;
    if (size.isEmpty) return;
    final px = (details.localPosition.dx / size.width).clamp(0.0, 1.0);
    final py = (details.localPosition.dy / size.height).clamp(0.0, 1.0);

    const ht = 0.07;
    _dragTarget = null;

    if ((px - _left).abs() < ht && (py - _top).abs() < ht) {
      _dragTarget = 'topLeft';
    } else if ((px - _right).abs() < ht && (py - _top).abs() < ht) {
      _dragTarget = 'topRight';
    } else if ((px - _left).abs() < ht && (py - _bottom).abs() < ht) {
      _dragTarget = 'bottomLeft';
    } else if ((px - _right).abs() < ht && (py - _bottom).abs() < ht) {
      _dragTarget = 'bottomRight';
    } else if ((py - _top).abs() < ht && px > _left && px < _right) {
      _dragTarget = 'top';
    } else if ((py - _bottom).abs() < ht && px > _left && px < _right) {
      _dragTarget = 'bottom';
    } else if ((px - _left).abs() < ht && py > _top && py < _bottom) {
      _dragTarget = 'left';
    } else if ((px - _right).abs() < ht && py > _top && py < _bottom) {
      _dragTarget = 'right';
    } else if (px > _left && px < _right && py > _top && py < _bottom) {
      _dragTarget = 'move';
      _moveStart = Offset(px - _left, py - _top);
    }
  }

  void _onPanUpdateSimple(DragUpdateDetails details) {
    if (_dragTarget == null) return;
    final size = _displaySize;
    if (size.isEmpty) return;
    final px = (details.localPosition.dx / size.width).clamp(0.0, 1.0);
    final py = (details.localPosition.dy / size.height).clamp(0.0, 1.0);

    setState(() {
      const minSize = 0.08;
      switch (_dragTarget) {
        case 'topLeft':
          _left = px.clamp(0.0, _right - minSize);
          _top = py.clamp(0.0, _bottom - minSize);
          break;
        case 'topRight':
          _right = px.clamp(_left + minSize, 1.0);
          _top = py.clamp(0.0, _bottom - minSize);
          break;
        case 'bottomLeft':
          _left = px.clamp(0.0, _right - minSize);
          _bottom = py.clamp(_top + minSize, 1.0);
          break;
        case 'bottomRight':
          _right = px.clamp(_left + minSize, 1.0);
          _bottom = py.clamp(_top + minSize, 1.0);
          break;
        case 'top':
          _top = py.clamp(0.0, _bottom - minSize);
          break;
        case 'bottom':
          _bottom = py.clamp(_top + minSize, 1.0);
          break;
        case 'left':
          _left = px.clamp(0.0, _right - minSize);
          break;
        case 'right':
          _right = px.clamp(_left + minSize, 1.0);
          break;
        case 'move':
          final w = width, h = height;
          _left = (px - (_moveStart?.dx ?? 0)).clamp(0.0, 1.0 - w);
          _top = (py - (_moveStart?.dy ?? 0)).clamp(0.0, 1.0 - h);
          _right = _left + w; _bottom = _top + h;
          break;
      }
    });
  }

  void _onPanEnd(DragEndDetails details) {
    _dragTarget = null;
    _moveStart = null;
  }
}

/// 裁剪遮罩画笔
class _CropOverlayPainter extends CustomPainter {
  final double left, top, right, bottom;

  _CropOverlayPainter({
    required this.left, required this.top,
    required this.right, required this.bottom,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final l = left * size.width;
    final t = top * size.height;
    final r = right * size.width;
    final b = bottom * size.height;

    final maskPaint = Paint()..color = const Color(0x88000000);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, t), maskPaint);
    canvas.drawRect(Rect.fromLTWH(0, b, size.width, size.height - b), maskPaint);
    canvas.drawRect(Rect.fromLTWH(0, t, l, b - t), maskPaint);
    canvas.drawRect(Rect.fromLTWH(r, t, size.width - r, b - t), maskPaint);

    final borderPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas.drawRect(Rect.fromLTRB(l, t, r, b), borderPaint);

    final gridPaint = Paint()
      ..color = Colors.white24
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.5;
    for (int i = 1; i < 3; i++) {
      final x = l + (r - l) * i / 3;
      canvas.drawLine(Offset(x, t), Offset(x, b), gridPaint);
      final y = t + (b - t) * i / 3;
      canvas.drawLine(Offset(l, y), Offset(r, y), gridPaint);
    }

    const h = 28.0;
    final handleFill = Paint()..color = Colors.blue.withOpacity(0.3);
    canvas.drawCircle(Offset(l, t), h / 2, handleFill);
    canvas.drawCircle(Offset(l, t), h / 2, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
    canvas.drawCircle(Offset(r, t), h / 2, handleFill);
    canvas.drawCircle(Offset(r, t), h / 2, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
    canvas.drawCircle(Offset(l, b), h / 2, handleFill);
    canvas.drawCircle(Offset(l, b), h / 2, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
    canvas.drawCircle(Offset(r, b), h / 2, handleFill);
    canvas.drawCircle(Offset(r, b), h / 2, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
  }

  @override
  bool shouldRepaint(covariant _CropOverlayPainter old) => true;
}
