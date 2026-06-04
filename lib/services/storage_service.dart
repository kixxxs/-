import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// 存储服务 — 管理本地文件读写
class StorageService {
  /// 获取 PDF 保存目录，不存在则创建
  Future<Directory> getPdfDirectory() async {
    final appDir = await getApplicationDocumentsDirectory();
    final pdfDir = Directory('${appDir.path}/PDFs');
    if (!await pdfDir.exists()) {
      await pdfDir.create(recursive: true);
    }
    return pdfDir;
  }

  /// 获取临时照片目录
  Future<Directory> getTempPhotoDirectory() async {
    final tempDir = await getTemporaryDirectory();
    final photoDir = Directory('${tempDir.path}/photos');
    if (!await photoDir.exists()) {
      await photoDir.create(recursive: true);
    }
    return photoDir;
  }

  /// 保存文件到指定目录，返回保存后的完整路径
  Future<String> saveFile(File sourceFile, Directory targetDir, String fileName) async {
    final targetPath = '${targetDir.path}/$fileName';
    final savedFile = await sourceFile.copy(targetPath);
    return savedFile.path;
  }

  /// 删除临时照片文件
  Future<void> deleteTempPhotos(List<String> filePaths) async {
    for (final path in filePaths) {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    }
  }

  /// 检查文件是否存在
  Future<bool> fileExists(String path) async {
    return File(path).exists();
  }

  /// 列出 PDF 目录下所有 PDF 文件
  Future<List<PdfFileInfo>> listPdfFiles() async {
    final pdfDir = await getPdfDirectory();
    final files = <PdfFileInfo>[];
    final entries = pdfDir.listSync().whereType<File>().where((f) => f.path.endsWith('.pdf'));
    for (final f in entries) {
      final stat = await f.stat();
      files.add(PdfFileInfo(
        name: f.uri.pathSegments.last,
        path: f.path,
        size: stat.size,
        modified: stat.modified,
      ));
    }
    files.sort((a, b) => b.modified.compareTo(a.modified)); // 最新的在前
    return files;
  }

  /// 批量删除文件
  Future<int> deleteFiles(List<String> paths) async {
    int deleted = 0;
    for (final path in paths) {
      final f = File(path);
      if (await f.exists()) {
        await f.delete();
        deleted++;
      }
    }
    return deleted;
  }
}

/// PDF 文件信息
class PdfFileInfo {
  final String name;
  final String path;
  final int size;
  final DateTime modified;

  PdfFileInfo({
    required this.name,
    required this.path,
    required this.size,
    required this.modified,
  });

  String get sizeStr {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  String get dateStr {
    return '${modified.month.toString().padLeft(2, '0')}-${modified.day.toString().padLeft(2, '0')} '
        '${modified.hour.toString().padLeft(2, '0')}:${modified.minute.toString().padLeft(2, '0')}';
  }
}
