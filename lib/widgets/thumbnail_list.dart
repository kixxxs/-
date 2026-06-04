import 'dart:io';
import 'package:flutter/material.dart';

/// 横向滚动的照片缩略图列表（拍照页使用）
class ThumbnailList extends StatelessWidget {
  final List<String> photoPaths;
  final Function(int) onTap;
  final Function(int)? onDelete;
  final int selectedIndex;

  const ThumbnailList({
    super.key,
    required this.photoPaths,
    required this.onTap,
    this.onDelete,
    this.selectedIndex = -1,
  });

  @override
  Widget build(BuildContext context) {
    if (photoPaths.isEmpty) {
      return const SizedBox(
        height: 80,
        child: Center(
          child: Text('尚未拍摄照片', style: TextStyle(color: Colors.white70)),
        ),
      );
    }

    return SizedBox(
      height: 80,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: photoPaths.length,
        itemBuilder: (context, index) {
          final isSelected = index == selectedIndex;
          return GestureDetector(
            onTap: () => onTap(index),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 64,
                  height: 72,
                  margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isSelected ? Colors.blue : Colors.white54,
                      width: isSelected ? 2.5 : 1,
                    ),
                    borderRadius: BorderRadius.circular(6),
                    image: DecorationImage(
                      image: FileImage(File(photoPaths[index])),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                if (onDelete != null)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: GestureDetector(
                      onTap: () => onDelete!(index),
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, size: 12, color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
