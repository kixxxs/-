import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/annotation.dart';
import '../models/photo_item.dart';
import '../services/image_service.dart';
import '../services/pdf_service.dart';
import '../services/storage_service.dart';

/// 核心状态管理 — 照片列表的增删改查、排序、标注、增强、裁剪、PDF 生成
class PhotoProvider extends ChangeNotifier {
  final PdfService _pdfService = PdfService();
  final StorageService _storageService = StorageService();
  final ImageService _imageService = ImageService();
  final Uuid _uuid = const Uuid();

  final List<PhotoItem> _photos = [];
  List<PhotoItem> get photos => List.unmodifiable(_photos);

  bool _isGenerating = false;
  bool get isGenerating => _isGenerating;

  String? _lastGeneratedPdfPath;
  String? get lastGeneratedPdfPath => _lastGeneratedPdfPath;

  /// 拍照后添加照片（原图，不自动增强）
  Future<void> addPhoto(String filePath) async {
    final item = PhotoItem(
      id: _uuid.v4(),
      filePath: filePath,
      orderIndex: _photos.length,
    );
    _photos.add(item);
    notifyListeners();
  }

  /// 手动增强指定照片的画质
  Future<void> enhancePhoto(int photoIndex) async {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;

    final photo = _photos[photoIndex];
    final rawBytes = await File(photo.filePath).readAsBytes();
    final enhanced = await _imageService.enhance(rawBytes);

    final enhancedPath = '${photo.filePath}_enhanced.jpg';
    await File(enhancedPath).writeAsBytes(enhanced);

    _photos[photoIndex] = photo.copyWith(
      filePath: enhancedPath,
      isEnhanced: true,
    );
    notifyListeners();
  }

  /// 删除指定索引的照片
  void removePhoto(int index) {
    if (index < 0 || index >= _photos.length) return;

    final filePath = _photos[index].filePath;
    final file = File(filePath);
    if (file.existsSync()) {
      file.deleteSync();
    }

    _photos.removeAt(index);
    _reindexPhotos();
    notifyListeners();
  }

  /// 拖拽排序
  void reorderPhotos(int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    final item = _photos.removeAt(oldIndex);
    final adjustedIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
    _photos.insert(adjustedIndex, item);
    _reindexPhotos();
    notifyListeners();
  }

  /// 添加标注
  void addAnnotation(int photoIndex, PhotoAnnotation annotation) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    _photos[photoIndex].annotations.add(annotation);
    notifyListeners();
  }

  /// 更新标注（用于文字移动等）
  void updateAnnotation(int photoIndex, String annotationId, PhotoAnnotation updated) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    final annotations = _photos[photoIndex].annotations;
    final idx = annotations.indexWhere((a) => a.id == annotationId);
    if (idx >= 0) {
      annotations[idx] = updated;
      notifyListeners();
    }
  }

  /// 撤销最后一个标注
  void undoLastAnnotation(int photoIndex) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    final annotations = _photos[photoIndex].annotations;
    if (annotations.isNotEmpty) {
      annotations.removeLast();
      notifyListeners();
    }
  }

  /// 清除所有标注
  void clearAnnotations(int photoIndex) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    _photos[photoIndex].annotations.clear();
    notifyListeners();
  }

  /// 裁剪照片
  Future<void> cropPhoto(int photoIndex, CropRect cropRect) async {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;

    final photo = _photos[photoIndex];
    final rawBytes = await File(photo.filePath).readAsBytes();
    final cropped = await _imageService.crop(rawBytes, cropRect);

    final newPath = '${photo.filePath}_cropped.jpg';
    await File(newPath).writeAsBytes(cropped);

    // 更新照片路径和裁剪信息
    _photos[photoIndex] = photo.copyWith(
      filePath: newPath,
      cropRect: cropRect,
      clearCrop: false,
    );
    notifyListeners();
  }

  /// 生成 PDF
  Future<String> generatePdf(String fileName) async {
    if (_photos.isEmpty) throw Exception('没有照片可生成 PDF');

    _isGenerating = true;
    notifyListeners();

    try {
      final pdfDir = await _storageService.getPdfDirectory();
      final fullName = fileName.endsWith('.pdf') ? fileName : '$fileName.pdf';
      final filePath = await _pdfService.generatePdf(
        photos: _photos,
        fileName: fullName,
        outputDir: pdfDir.path,
      );
      _lastGeneratedPdfPath = filePath;
      return filePath;
    } finally {
      _isGenerating = false;
      notifyListeners();
    }
  }

  /// 清理临时照片
  Future<void> cleanupTempPhotos() async {
    final paths = _photos.map((p) => p.filePath).toList();
    await _storageService.deleteTempPhotos(paths);
  }

  void _reindexPhotos() {
    for (int i = 0; i < _photos.length; i++) {
      _photos[i] = _photos[i].copyWith(orderIndex: i);
    }
  }
}
