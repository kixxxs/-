import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/annotation.dart';
import '../models/photo_item.dart';
import '../services/image_service.dart';
import '../services/pdf_service.dart';
import '../services/storage_service.dart';

/// 核心状态管理
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

  Future<void> addPhoto(String filePath) async {
    _photos.add(PhotoItem(id: _uuid.v4(), filePath: filePath, orderIndex: _photos.length));
    notifyListeners();
  }

  void removePhoto(int index) {
    if (index < 0 || index >= _photos.length) return;
    final file = File(_photos[index].filePath);
    if (file.existsSync()) file.deleteSync();
    _photos.removeAt(index);
    _reindexPhotos();
    notifyListeners();
  }

  void reorderPhotos(int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    final item = _photos.removeAt(oldIndex);
    _photos.insert(oldIndex < newIndex ? newIndex - 1 : newIndex, item);
    _reindexPhotos();
    notifyListeners();
  }

  void addAnnotation(int photoIndex, PhotoAnnotation annotation) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    _photos[photoIndex].annotations.add(annotation);
    notifyListeners();
  }

  void updateAnnotation(int photoIndex, String annotationId, PhotoAnnotation updated) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    final idx = _photos[photoIndex].annotations.indexWhere((a) => a.id == annotationId);
    if (idx >= 0) {
      _photos[photoIndex].annotations[idx] = updated;
      notifyListeners();
    }
  }

  void undoLastAnnotation(int photoIndex) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    if (_photos[photoIndex].annotations.isNotEmpty) {
      _photos[photoIndex].annotations.removeLast();
      notifyListeners();
    }
  }

  void clearAnnotations(int photoIndex) {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    _photos[photoIndex].annotations.clear();
    notifyListeners();
  }

  Future<void> cropPhoto(int photoIndex, CropRect cropRect) async {
    if (photoIndex < 0 || photoIndex >= _photos.length) return;
    final photo = _photos[photoIndex];
    final rawBytes = await File(photo.filePath).readAsBytes();
    final cropped = await _imageService.crop(rawBytes, cropRect);
    final newPath = '${photo.filePath}_cropped.jpg';
    await File(newPath).writeAsBytes(cropped);
    _photos[photoIndex] = photo.copyWith(filePath: newPath, cropRect: cropRect, clearCrop: false);
    notifyListeners();
  }

  Future<String> generatePdf(String fileName) async {
    if (_photos.isEmpty) throw Exception('no photos');
    _isGenerating = true;
    notifyListeners();
    try {
      final pdfDir = await _storageService.getPdfDirectory();
      final fullName = fileName.endsWith('.pdf') ? fileName : '$fileName.pdf';
      final filePath = await _pdfService.generatePdf(photos: _photos, fileName: fullName, outputDir: pdfDir.path);
      _lastGeneratedPdfPath = filePath;
      return filePath;
    } finally {
      _isGenerating = false;
      notifyListeners();
    }
  }

  Future<void> cleanupTempPhotos() async {
    await _storageService.deleteTempPhotos(_photos.map((p) => p.filePath).toList());
  }

  void _reindexPhotos() {
    for (int i = 0; i < _photos.length; i++) {
      _photos[i] = _photos[i].copyWith(orderIndex: i);
    }
  }
}
