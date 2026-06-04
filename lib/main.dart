import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/photo_provider.dart';
import 'pages/camera_page.dart';
import 'pages/edit_page.dart';
import 'pages/annotation_page.dart';
import 'pages/generate_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PhotoPdfApp());
}

class PhotoPdfApp extends StatelessWidget {
  const PhotoPdfApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => PhotoProvider(),
      child: MaterialApp(
        title: '拍照生成PDF',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorSchemeSeed: Colors.blue,
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            centerTitle: true,
            elevation: 0,
          ),
        ),
        initialRoute: '/',
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case '/':
              return MaterialPageRoute(
                builder: (_) => const CameraPage(),
              );
            case '/edit':
              return MaterialPageRoute(
                builder: (_) => const EditPage(),
              );
            case '/annotate':
              final args = settings.arguments as Map<String, dynamic>;
              return MaterialPageRoute(
                builder: (_) => AnnotationPage(
                  photoIndex: args['photoIndex'] as int,
                ),
              );
            case '/generate':
              return MaterialPageRoute(
                builder: (_) => const GeneratePage(),
              );
            default:
              return MaterialPageRoute(
                builder: (_) => const CameraPage(),
              );
          }
        },
      ),
    );
  }
}
