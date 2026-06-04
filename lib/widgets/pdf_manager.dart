import 'package:flutter/material.dart';
import '../services/storage_service.dart';

/// PDF 文件管理器 — 列表 / 全选 / 删除
class PdfManager extends StatefulWidget {
  const PdfManager({super.key});

  @override
  State<PdfManager> createState() => _PdfManagerState();
}

class _PdfManagerState extends State<PdfManager> {
  final StorageService _storage = StorageService();
  List<PdfFileInfo> _files = [];
  final Set<String> _selected = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadFiles();
  }

  Future<void> _loadFiles() async {
    setState(() => _loading = true);
    _files = await _storage.listPdfFiles();
    _selected.clear();
    setState(() => _loading = false);
  }

  bool get _allSelected => _files.isNotEmpty && _selected.length == _files.length;

  void _toggleAll() {
    setState(() {
      if (_allSelected) {
        _selected.clear();
      } else {
        _selected.addAll(_files.map((f) => f.path));
      }
    });
  }

  void _toggleOne(String path) {
    setState(() {
      if (_selected.contains(path)) {
        _selected.remove(path);
      } else {
        _selected.add(path);
      }
    });
  }

  Future<void> _deleteSelected() async {
    if (_selected.isEmpty) return;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除文件'),
        content: Text('确定要删除选中的 ${_selected.length} 个 PDF 文件吗？\n此操作不可恢复。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('删除'),
          ),
        ],
      ),
    );

    if (ok == true) {
      await _storage.deleteFiles(_selected.toList());
      _loadFiles();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 标题栏 + 全选
        Row(
          children: [
            const Icon(Icons.folder_open, size: 18, color: Colors.grey),
            const SizedBox(width: 6),
            const Text('本地 PDF 文件', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const Spacer(),
            if (_files.isNotEmpty)
              GestureDetector(
                onTap: _toggleAll,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _allSelected ? Icons.check_box : Icons.check_box_outline_blank,
                      size: 20, color: Colors.blue,
                    ),
                    const SizedBox(width: 4),
                    Text(_allSelected ? '取消全选' : '全选',
                        style: const TextStyle(color: Colors.blue, fontSize: 13)),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),

        // 内容
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (_files.isEmpty)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(
              child: Text('暂无 PDF 文件', style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(10),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                ..._files.map(_buildRow),
                // 删除按钮
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    border: Border(top: BorderSide(color: Colors.grey.shade200)),
                  ),
                  child: ElevatedButton.icon(
                    onPressed: _selected.isEmpty ? null : _deleteSelected,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey.shade300,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: Text('删除选中${_selected.isNotEmpty ? ' (${_selected.length})' : ''}'),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildRow(PdfFileInfo file) {
    final isSel = _selected.contains(file.path);
    return InkWell(
      onTap: () => _toggleOne(file.path),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
        ),
        child: Row(
          children: [
            Icon(
              isSel ? Icons.check_box : Icons.check_box_outline_blank,
              size: 20, color: isSel ? Colors.blue : Colors.grey,
            ),
            const SizedBox(width: 10),
            const Icon(Icons.picture_as_pdf, color: Colors.red, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(file.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text('${file.sizeStr} · ${file.dateStr}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
