import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:camera/camera.dart';
import 'package:photo_view/photo_view.dart';
import '../providers/photo_provider.dart';
import '../services/camera_service.dart';
import '../widgets/thumbnail_list.dart';

/// 拍照页 — 相机预览 + 已拍缩略图 + 快门与确认按钮
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
      await _cameraService.initialize();
      setState(() => _isCameraReady = true);
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
    // 先释放相机资源，避免与编辑/标注页冲突
    _cameraService.dispose();
    setState(() => _isCameraReady = false);
    Navigator.pushNamed(context, '/edit');
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
                  ? ClipRRect(
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(0)),
                      child: CameraPreview(_cameraService.controller!),
                    )
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
