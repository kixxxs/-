import 'dart:io';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:provider/provider.dart';
import 'package:reorderables/reorderables.dart';
import '../models/photo_item.dart';
import '../providers/photo_provider.dart';
import 'crop_page.dart';

/// 编辑页 — 照片列表、删除、拖拽排序、标注、裁剪、大图预览
class EditPage extends StatelessWidget {
  const EditPage({super.key});

  @override
  Widget build(BuildContext context) {
    final photoProvider = context.watch<PhotoProvider>();
    final photos = photoProvider.photos;

    return Scaffold(
      appBar: AppBar(
        title: const Text('编辑照片'),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.camera_alt),
            label: const Text('继续拍照'),
          ),
        ],
      ),
      body: photos.isEmpty
          ? const Center(child: Text('没有照片'))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 16, color: Colors.grey),
                      const SizedBox(width: 6),
                      Text(
                        '长按拖拽排序 | 点击标注 | 裁剪 | 点击缩略图放大',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ReorderableColumn(
                    onReorder: photoProvider.reorderPhotos,
                    children: List.generate(
                      photos.length,
                      (i) => _buildPhotoCard(context, photoProvider, photos[i], i),
                    ),
                  ),
                ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton.icon(
            onPressed: () => Navigator.pushNamed(context, '/generate'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.picture_as_pdf),
            label: Text('生成 PDF (${photos.length} 页)'),
          ),
        ),
      ),
    );
  }

  Widget _buildPhotoCard(
    BuildContext context,
    PhotoProvider provider,
    PhotoItem photo,
    int index,
  ) {
    final annotationCount = photo.annotations.length;
    final file = File(photo.filePath);

    return Container(
      key: ValueKey(photo.id),
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              const Icon(Icons.drag_handle, color: Colors.grey),

              // 缩略图 — 点击放大
              GestureDetector(
                onTap: () => _viewFullImage(context, photo),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Stack(
                    children: [
                      Image.file(file, width: 72, height: 72, fit: BoxFit.cover),
                      if (photo.isEnhanced)
                        Positioned(
                          left: 0, right: 0, bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
                            color: Colors.black54,
                            child: const Text(
                              '增强',
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              style: TextStyle(color: Colors.white, fontSize: 8),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('第 ${index + 1} 页',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 4),
                    // Wrap 自动换行，避免溢出
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        _buildActionChip(context, Icons.edit, '标注', () {
                          Navigator.pushNamed(context, '/annotate', arguments: {'photoIndex': index});
                        }),
                        _buildActionChip(context, Icons.crop, '裁剪', () {
                          Navigator.push(context, MaterialPageRoute(
                            builder: (_) => CropPage(photoIndex: index),
                          ));
                        }),
                        if (!photo.isEnhanced)
                          _buildActionChip(context, Icons.auto_fix_high, '增强', () async {
                            await provider.enhancePhoto(index);
                          }),
                      ],
                    ),
                    if (annotationCount > 0) ...[
                      const SizedBox(height: 4),
                      Text('$annotationCount 个标注',
                          style: const TextStyle(color: Colors.blue, fontSize: 12)),
                    ],
                  ],
                ),
              ),

              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                onPressed: () => _confirmDelete(context, provider, index),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionChip(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: Colors.grey.shade700),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
          ],
        ),
      ),
    );
  }

  void _viewFullImage(BuildContext context, PhotoItem photo) {
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
              imageProvider: FileImage(File(photo.filePath)),
              minScale: PhotoViewComputedScale.contained,
              maxScale: PhotoViewComputedScale.covered * 4,
              backgroundDecoration: const BoxDecoration(color: Colors.black),
            ),
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, PhotoProvider provider, int index) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除照片'),
        content: const Text('确定要删除这张照片吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          TextButton(
            onPressed: () {
              provider.removePhoto(index);
              Navigator.pop(ctx);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('删除'),
          ),
        ],
      ),
    );
  }
}
