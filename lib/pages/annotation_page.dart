import 'dart:io';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../models/annotation.dart';
import '../providers/photo_provider.dart';
import '../widgets/annotation_painter.dart';

enum AnnotationTool { none, draw, arrow, text }

/// 标注页 — 自由绘制 + WeChat 风格文字编辑
class AnnotationPage extends StatefulWidget {
  final int photoIndex;
  const AnnotationPage({super.key, required this.photoIndex});

  @override
  State<AnnotationPage> createState() => _AnnotationPageState();
}

class _AnnotationPageState extends State<AnnotationPage> {
  final Uuid _uuid = const Uuid();
  AnnotationTool _currentTool = AnnotationTool.none;
  Color _currentColor = Colors.red;

  // 绘制状态
  PhotoAnnotation? _drawingAnnotation;
  List<Offset> _currentStroke = [];
  Offset? _arrowStart;

  // 文字编辑状态
  TextEditingController? _textCtrl;
  FocusNode? _textFocus;
  Offset? _textPos; // 归一化

  // 拖动文字
  String? _dragId;
  Offset? _dragOffset;

  Offset _norm(Offset s, Size sz) => Offset((s.dx / sz.width).clamp(0, 1), (s.dy / sz.height).clamp(0, 1));

  @override
  void dispose() {
    _textCtrl?.dispose();
    _textFocus?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PhotoProvider>();
    final photo = provider.photos[widget.photoIndex];
    final annotations = photo.annotations;
    final screenSize = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black87,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('标注 - 第 ${widget.photoIndex + 1} 张', style: const TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.cleaning_services),
            tooltip: '清除标注',
            onPressed: annotations.isEmpty ? null : () => _confirmClear(provider),
          ),
        ],
      ),
      body: Stack(
        children: [
          // 照片 + 标注层
          GestureDetector(
            onPanStart: _onPanStart,
            onPanUpdate: _onPanUpdate,
            onPanEnd: _onPanEnd,
            onTapUp: _onTapUp,
            child: Stack(
              fit: StackFit.expand,
              children: [
                PhotoView(
                  imageProvider: FileImage(File(photo.filePath)),
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.covered * 4,
                  backgroundDecoration: const BoxDecoration(color: Colors.black),
                ),
                IgnorePointer(
                  child: CustomPaint(
                    size: Size(screenSize.width, screenSize.height),
                    painter: AnnotationPainter(
                      annotations: annotations,
                      drawingAnnotation: _drawingAnnotation,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 文字输入：WeChat 风格底部输入栏
          if (_textCtrl != null)
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: _buildTextInputBar(),
            ),

          // 工具提示
          if (_currentTool != AnnotationTool.none)
            Positioned(top: 8, left: 0, right: 0, child: _buildHint()),
        ],
      ),
      bottomNavigationBar: SafeArea(child: _buildToolbar(provider)),
    );
  }

  // ─── 底部文字输入栏（WeChat 风格）───
  Widget _buildTextInputBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: const BoxDecoration(
        color: Color(0xEE1E1E1E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      child: Row(
        children: [
          const Icon(Icons.text_fields, color: Colors.white54, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _textCtrl,
              focusNode: _textFocus,
              autofocus: true,
              style: const TextStyle(color: Colors.white, fontSize: 16),
              decoration: const InputDecoration(
                hintText: '输入文字...',
                hintStyle: TextStyle(color: Colors.white38),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
              maxLength: 100,
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(width: 8),
          _textBtn(Icons.close, Colors.redAccent, _cancelText),
          const SizedBox(width: 8),
          _textBtn(Icons.check, Colors.green, _commitText),
        ],
      ),
    );
  }

  Widget _textBtn(IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
        child: Icon(icon, color: color, size: 22),
      ),
    );
  }

  void _showTextInput(Offset screenPos) {
    final size = MediaQuery.of(context).size;
    _textCtrl = TextEditingController();
    _textFocus = FocusNode();
    _textPos = _norm(screenPos, size);
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) => _textFocus?.requestFocus());
  }

  void _commitText() {
    final text = _textCtrl?.text.trim() ?? '';
    if (text.isNotEmpty && _textPos != null) {
      context.read<PhotoProvider>().addAnnotation(
            widget.photoIndex,
            TextAnnotation(id: _uuid.v4(), position: _textPos!, text: text, color: _currentColor),
          );
    }
    _clearTextState();
  }

  void _cancelText() => _clearTextState();

  void _clearTextState() {
    _textCtrl?.dispose(); _textCtrl = null;
    _textFocus?.dispose(); _textFocus = null;
    _textPos = null;
    setState(() {});
  }

  // ─── 工具栏 ───
  Widget _buildToolbar(PhotoProvider provider) {
    return Container(
      color: Colors.grey.shade900,
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _tb(Icons.brush, '画笔', AnnotationTool.draw),
          _tb(Icons.arrow_right_alt, '箭头', AnnotationTool.arrow),
          _tb(Icons.text_fields, '文字', AnnotationTool.text),
          ..._colors.map((c) => _colorDot(c)),
          _tb(Icons.undo, '撤销', null, onTap: () => provider.undoLastAnnotation(widget.photoIndex)),
        ],
      ),
    );
  }

  static const _colors = [Colors.red, Colors.blue, Colors.green, Colors.yellow, Colors.orange, Colors.white];

  Widget _tb(IconData icon, String label, AnnotationTool? tool, {VoidCallback? onTap}) {
    final active = _currentTool == tool;
    final color = tool == AnnotationTool.text ? _currentColor : null;
    return GestureDetector(
      onTap: onTap ?? (() {
        if (_textCtrl != null) return; // 文字输入中不允许切换工具
        setState(() => _currentTool = _currentTool == tool ? AnnotationTool.none : (tool ?? AnnotationTool.none));
        _drawingAnnotation = null; _currentStroke = []; _arrowStart = null;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: active ? Colors.blue.shade700 : Colors.white12,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? Colors.blue : Colors.white24),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: active ? Colors.white : (color ?? Colors.white70), size: 22),
          Text(label, style: TextStyle(color: active ? Colors.white : Colors.white54, fontSize: 10)),
        ]),
      ),
    );
  }

  Widget _colorDot(Color color) {
    final sel = color.value == _currentColor.value;
    return GestureDetector(
      onTap: () => setState(() => _currentColor = color),
      child: Container(
        width: 24, height: 24, margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(color: color, shape: BoxShape.circle,
          border: Border.all(color: sel ? Colors.white : Colors.transparent, width: 2.5)),
      ),
    );
  }

  Widget _buildHint() {
    String t;
    switch (_currentTool) {
      case AnnotationTool.draw: t = '手指绘画'; break;
      case AnnotationTool.arrow: t = '滑动箭头'; break;
      case AnnotationTool.text: t = '点击添加文字'; break;
      default: t = '';
    }
    return Center(child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(16)),
      child: Text(t, style: const TextStyle(color: Colors.white, fontSize: 13)),
    ));
  }

  // ─── 手势 ───

  void _onTapUp(TapUpDetails d) {
    // 文字工具：点击直接放置文字
    if (_currentTool == AnnotationTool.text && _textCtrl == null) {
      _showTextInput(d.localPosition);
    }
  }

  void _onPanStart(DragStartDetails d) {
    final sz = MediaQuery.of(context).size;
    if (sz.isEmpty) return;

    // 拖动已有文字
    if (_currentTool == AnnotationTool.none) {
      _checkDragStart(d.localPosition, sz);
      return;
    }
    // 文字输入中不允许手势
    if (_textCtrl != null) return;

    if (_currentTool == AnnotationTool.draw) {
      _currentStroke = [_norm(d.localPosition, sz)];
      _updateStroke();
    } else if (_currentTool == AnnotationTool.arrow) {
      _arrowStart = _norm(d.localPosition, sz);
    } else if (_currentTool == AnnotationTool.text) {
      _showTextInput(d.localPosition);
      // 不重置工具，保持文字模式可连续使用
    }
  }

  void _onPanUpdate(DragUpdateDetails d) {
    final sz = MediaQuery.of(context).size;
    if (sz.isEmpty || _textCtrl != null) return;

    if (_dragId != null) {
      final newPos = _norm(d.localPosition - (_dragOffset ?? Offset.zero), sz);
      _updateTextDrag(newPos);
      return;
    }

    if (_currentTool == AnnotationTool.draw && _currentStroke.isNotEmpty) {
      _currentStroke.add(_norm(d.localPosition, sz));
      _updateStroke();
    } else if (_currentTool == AnnotationTool.arrow && _arrowStart != null) {
      setState(() {
        _drawingAnnotation = ArrowAnnotation(
          id: 'drawing', start: _arrowStart!, end: _norm(d.localPosition, sz), color: _currentColor);
      });
    }
  }

  void _onPanEnd(DragEndDetails d) {
    if (_dragId != null) { _dragId = null; _dragOffset = null; return; }
    if (_textCtrl != null) return;

    if (_currentTool == AnnotationTool.draw && _currentStroke.length > 1) {
      context.read<PhotoProvider>().addAnnotation(widget.photoIndex,
          DrawingAnnotation(id: _uuid.v4(), strokes: [List.from(_currentStroke)], color: _currentColor));
    }
    if (_currentTool == AnnotationTool.arrow && _drawingAnnotation != null) {
      final a = _drawingAnnotation as ArrowAnnotation;
      context.read<PhotoProvider>().addAnnotation(widget.photoIndex,
          ArrowAnnotation(id: _uuid.v4(), start: a.start, end: a.end, color: a.color));
    }
    setState(() { _drawingAnnotation = null; _currentStroke = []; _arrowStart = null; });
  }

  void _updateStroke() {
    if (_currentStroke.length < 2) return;
    setState(() => _drawingAnnotation = DrawingAnnotation(
        id: 'drawing', strokes: [List.from(_currentStroke)], color: _currentColor));
  }

  // ─── 文字拖动 ───
  void _checkDragStart(Offset pos, Size sz) {
    final p = context.read<PhotoProvider>();
    final anns = p.photos[widget.photoIndex].annotations;
    for (final a in anns.reversed) {
      if (a is TextAnnotation) {
        final ap = Offset(a.position.dx * sz.width, a.position.dy * sz.height);
        if ((pos - ap).distance < 60) {
          _dragId = a.id;
          _dragOffset = pos - ap;
          return;
        }
      }
    }
  }

  void _updateTextDrag(Offset newPos) {
    if (_dragId == null) return;
    final p = context.read<PhotoProvider>();
    final anns = p.photos[widget.photoIndex].annotations;
    final idx = anns.indexWhere((a) => a.id == _dragId);
    if (idx >= 0 && anns[idx] is TextAnnotation) {
      p.updateAnnotation(widget.photoIndex, _dragId!, (anns[idx] as TextAnnotation).copyWith(position: newPos));
    }
  }

  void _confirmClear(PhotoProvider p) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('清除标注'), content: const Text('确定清除所有标注？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        TextButton(onPressed: () { p.clearAnnotations(widget.photoIndex); Navigator.pop(ctx); },
            style: TextButton.styleFrom(foregroundColor: Colors.red), child: const Text('清除')),
      ],
    ));
  }
}
