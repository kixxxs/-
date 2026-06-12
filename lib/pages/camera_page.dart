import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:camera/camera.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:photo_view/photo_view.dart';
import '../providers/photo_provider.dart';
import '../services/camera_service.dart';
import '../widgets/thumbnail_list.dart';

/// 优化后的拍照页 — 彻底解决画面拉伸与返回卡顿问题
class CameraPage extends StatefulWidget {
  const CameraPage({super.key});

  @override
  State<CameraPage> createState() => _CameraPageState();
}

class _CameraPageState extends State<CameraPage> with WidgetsBindingObserver {
  final CameraService _cameraService = CameraService();
  bool _isCameraReady = false;
  bool _isTakingPicture = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraService.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) {
      _cameraService.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    try {
      // 先确保权限已授予
      var status = await Permission.camera.status;
      if (status.isDenied || status.isLimited) {
        status = await Permission.camera.request();
      }
      if (!status.isGranted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('需要相机权限才能拍照')),
          );
        }
        return;
      }

      // 权限授予后等待一帧，确保系统注册完成
      await Future.delayed(const Duration(milliseconds: 300));

      await _cameraService.initialize();
      if (mounted) {
        setState(() => _isCameraReady = true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('相机初始化失败: $e')),
        );
      }
    }
  }

  Future<void> _takePicture() async {
    if (_isTakingPicture || !_isCameraReady) return;

    setState(() => _isTakingPicture = true);
    try {
      final filePath = await _cameraService.takePicture();
      if (mounted) {
        context.read<PhotoProvider>().addPhoto(filePath);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('拍照失败: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isTakingPicture = false);
    }
  }

  /// 🛠️ 终极优化：使用官方推荐的 AspectRatio，彻底解决拉伸变形和黑屏卡顿
  Widget _buildCameraPreview() {
    final controller = _cameraService.controller;
    if (controller == null || !controller.value.isInitialized) {
      return const Center(child: CircularProgressIndicator(color: Colors.white));
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        color: Colors.black,
        child: Center(
          child: AspectRatio(
            // 自动匹配手机摄像头的物理真实比例（通常是 3:4 或 9:16），保证绝不拉伸
            aspectRatio: 1 / controller.value.aspectRatio,
            child: CameraPreview(controller),
          ),
        ),
      ),
    );
  }

  void _viewPhoto(String filePath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
          ),
          body: Center(
            child: PhotoView(
              imageProvider: FileImage(File(filePath)),
              minScale: PhotoViewComputedScale.contained,
              maxScale: PhotoViewComputedScale.covered * 3,
            ),
          ),
        ),
      ),
    );
  }

  void _goToEditPage() {
    final photos = context.read<PhotoProvider>().photos;
    if (photos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先拍摄至少一张照片')),
      );
      return;
    }
    // 先释放相机资源，避免与后面的编辑页冲突
    _cameraService.dispose();
    setState(() => _isCameraReady = false);
    
    Navigator.pushNamed(context, '/edit').then((_) {
      // 💡 优化：当从编辑页 pop 返回时，强制重新初始化相机并刷新 UI 状态
      _initCamera();
    });
  }

  @override
  Widget build(BuildContext context) {
    final photoProvider = context.watch<PhotoProvider>();
    final photoPaths = photoProvider.photos.map((p) => p.filePath).toList();

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // 相机预览区域
            Expanded(
              child: _isCameraReady && _cameraService.controller != null
                  ? _buildCameraPreview()
                  : const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(color: Colors.white),
                          SizedBox(height: 16),
                          Text(
                            '正在启动相机...',
                            style: TextStyle(color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
            ),

            // 底部控制区
            Container(
              color: Colors.black87,
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                children: [
                  // 已拍照片缩略图
                  ThumbnailList(
                    photoPaths: photoPaths,
                    onTap: (index) => _viewPhoto(photoPaths[index]),
                    onDelete: (index) {
                      context.read<PhotoProvider>().removePhoto(index);
                    },
                  ),
                  const SizedBox(height: 12),

                  // 快门和确认按钮
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        // 照片计数
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white12,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '${photoPaths.length} 张',
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 14),
                          ),
                        ),

                        // 快门按钮
                        GestureDetector(
                          onTap: _takePicture,
                          child: Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: Colors.white, width: 4),
                              color: _isTakingPicture
                                  ? Colors.grey
                                  : Colors.white24,
                            ),
                            child: _isTakingPicture
                                ? const CircularProgressIndicator(
                                    color: Colors.white)
                                : const Icon(Icons.camera_alt,
                                    color: Colors.white, size: 36),
                          ),
                        ),

                        // 确认 → 进入编辑页
                        ElevatedButton.icon(
                          onPressed: photoPaths.isEmpty ? null : _goToEditPage,
                          icon: const Icon(Icons.check, size: 20),
                          label: const Text('确认'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: Colors.grey.shade700,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
