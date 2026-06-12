import 'dart:async';
import 'package:camera/camera.dart';
import 'package:path_provider/path_provider.dart';

/// 相机服务
class CameraService {
  CameraController? _controller;
  List<CameraDescription>? _cameras;

  CameraController? get controller => _controller;

  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  /// 初始化相机
  Future<void> initialize() async {
    _cameras = await availableCameras();

    if (_cameras == null || _cameras!.isEmpty) {
      throw Exception('未检测到可用相机');
    }

    final camera = _cameras!.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.back,
      orElse: () => _cameras!.first,
    );

    // 直接用最高分辨率，画质最好
    _controller = CameraController(camera, ResolutionPreset.max, enableAudio: false);
    await _controller!.initialize();
    _isInitialized = true;
  }

  /// 拍照 — 使用 saveTo（第2版已验证可行）
  Future<String> takePicture() async {
    if (_controller == null || !_isInitialized) {
      throw Exception('相机未初始化');
    }

    final dir = await getTemporaryDirectory();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final filePath = '${dir.path}/photo_$timestamp.jpg';

    try {
      final xFile = await _controller!.takePicture();
      await xFile.saveTo(filePath);
    } catch (e) {
      throw Exception('拍照失败: $e');
    }

    return filePath;
  }

  Future<void> dispose() async {
    await _controller?.dispose();
    _controller = null;
    _isInitialized = false;
  }
}
