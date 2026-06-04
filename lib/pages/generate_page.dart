import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../providers/photo_provider.dart';
import '../widgets/pdf_manager.dart';
import '../widgets/pdf_preview.dart';

/// 生成页 — 文件命名、生成进度、保存/分享
class GeneratePage extends StatefulWidget {
  const GeneratePage({super.key});

  @override
  State<GeneratePage> createState() => _GeneratePageState();
}

class _GeneratePageState extends State<GeneratePage> {
  late TextEditingController _nameController;

  @override
  void initState() {
    super.initState();
    // 默认文件名：日期时间
    final now = DateTime.now();
    final defaultName =
        '${now.year}-${_pad(now.month)}-${_pad(now.day)}_'
        '${_pad(now.hour)}-${_pad(now.minute)}-${_pad(now.second)}';
    _nameController = TextEditingController(text: defaultName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  String _pad(int n) => n.toString().padLeft(2, '0');

  Future<void> _generateAndSave() async {
    final fileName = _nameController.text.trim();
    if (fileName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入文件名')),
      );
      return;
    }

    final provider = context.read<PhotoProvider>();
    try {
      final filePath = await provider.generatePdf(fileName);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF 已保存: $filePath'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('生成失败: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _sharePdf() async {
    final provider = context.read<PhotoProvider>();
    final pdfPath = provider.lastGeneratedPdfPath;

    if (pdfPath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先生成 PDF')),
      );
      return;
    }

    try {
      await Share.shareXFiles(
        [XFile(pdfPath)],
        subject: _nameController.text.trim(),
        text: 'PDF 文档: ${_nameController.text.trim()}',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('分享失败: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final photoProvider = context.watch<PhotoProvider>();
    final isGenerating = photoProvider.isGenerating;
    final pdfPath = photoProvider.lastGeneratedPdfPath;
    final photoCount = photoProvider.photos.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('生成 PDF'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 页面信息卡片
            Card(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child:
                          Icon(Icons.image, color: Colors.blue.shade600),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '文档信息',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '共 $photoCount 张照片 · A4 纵向 · 每页一张',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // 文件名输入
            const Text(
              'PDF 文件名',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                hintText: '输入文件名...',
                suffixText: '.pdf',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
            ),
            const SizedBox(height: 24),

            // 生成按钮
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: isGenerating ? null : _generateAndSave,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: isGenerating
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.picture_as_pdf),
                label: Text(isGenerating ? '正在生成...' : '生成 PDF'),
              ),
            ),
            const SizedBox(height: 28),

            // PDF 预览（生成后显示）
            if (pdfPath != null) ...[
              const Text(
                '生成完成',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 8),
              PdfPreview(pdfPath: pdfPath),
              const SizedBox(height: 20),

              // 分享按钮
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: _sharePdf,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.green.shade700,
                    side: BorderSide(color: Colors.green.shade300),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.share),
                  label: const Text('分享到微信 / 其他应用'),
                ),
              ),
            ],
            // PDF 文件管理器
            const SizedBox(height: 28),
            const PdfManager(),
          ],
        ),
      ),
    );
  }
}
