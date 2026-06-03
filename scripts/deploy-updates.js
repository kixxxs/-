// 生成版本信息 + 更新文件清单
// 用法: node scripts/deploy-updates.js
// 输出: 显示需要上传到服务器的文件列表和 version-info.json 内容

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DIST = path.join(ROOT, 'dist');
var PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
var VERSION = PKG.version || '1.0.0';

// Read Android version
var androidVersionCode = 1;
var androidVersionName = '1.0.0';
try {
  var gradlePath = path.join(ROOT, 'android', 'app', 'build.gradle');
  var gradle = fs.readFileSync(gradlePath, 'utf-8');
  var vcMatch = gradle.match(/versionCode\s+(\d+)/);
  var vnMatch = gradle.match(/versionName\s+"([^"]+)"/);
  if (vcMatch) androidVersionCode = parseInt(vcMatch[1], 10);
  if (vnMatch) androidVersionName = vnMatch[1];
} catch(e) {
  console.warn('无法读取 Android 版本号，使用默认值');
}

// Build version info
var versionInfo = {
  generatedAt: new Date().toISOString(),
  desktop: {
    version: VERSION
  },
  android: {
    versionCode: androidVersionCode,
    versionName: androidVersionName,
    apkUrl: '/updates/artist-manager.apk'
  },
  ios: {
    version: VERSION,
    ipaUrl: '/updates/artist-manager.ipa'
  }
};

// Files to upload
var filesToUpload = [
  { src: path.join(DIST, 'latest.yml'), dst: 'latest.yml' },
  { src: path.join(DIST, 'artist-manager-setup.exe'), dst: 'artist-manager-setup.exe' },
  { src: path.join(DIST, 'artist-manager-setup.exe.blockmap'), dst: 'artist-manager-setup.exe.blockmap' }
];

// APK
var apkPaths = [
  path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(DIST, 'artist-manager.apk')
];
for (var i = 0; i < apkPaths.length; i++) {
  if (fs.existsSync(apkPaths[i])) {
    filesToUpload.push({ src: apkPaths[i], dst: 'artist-manager.apk' });
    break;
  }
}

// IPA (may not exist)
var ipaPath = path.join(DIST, 'artist-manager.ipa');
if (fs.existsSync(ipaPath)) {
  filesToUpload.push({ src: ipaPath, dst: 'artist-manager.ipa' });
}

// manifest.plist template (generate from version)
var manifestPlist = '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"\n' +
'  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
'<plist version="1.0">\n' +
'<dict>\n' +
'    <key>items</key>\n' +
'    <array>\n' +
'        <dict>\n' +
'            <key>assets</key>\n' +
'            <array>\n' +
'                <dict>\n' +
'                    <key>kind</key>\n' +
'                    <string>software-package</string>\n' +
'                    <key>url</key>\n' +
'                    <string>http://42.194.230.53:8080/updates/artist-manager.ipa</string>\n' +
'                </dict>\n' +
'            </array>\n' +
'            <key>metadata</key>\n' +
'            <dict>\n' +
'                <key>bundle-identifier</key>\n' +
'                <string>com.artist.manager</string>\n' +
'                <key>bundle-version</key>\n' +
'                <string>' + VERSION + '</string>\n' +
'                <key>kind</key>\n' +
'                <string>software</string>\n' +
'                <key>title</key>\n' +
'                <string>艺人管理系统</string>\n' +
'            </dict>\n' +
'        </dict>\n' +
'    </array>\n' +
'</dict>\n' +
'</plist>\n';

// Write version-info.json
var versionInfoPath = path.join(DIST, 'version-info.json');
fs.writeFileSync(versionInfoPath, JSON.stringify(versionInfo, null, 2), 'utf-8');
filesToUpload.push({ src: versionInfoPath, dst: 'version-info.json' });

// Write manifest.plist to dist
var plistDistPath = path.join(DIST, 'manifest.plist');
fs.writeFileSync(plistDistPath, manifestPlist, 'utf-8');
filesToUpload.push({ src: plistDistPath, dst: 'manifest.plist' });

// Output
console.log('');
console.log('版本信息 (version-info.json):');
console.log(JSON.stringify(versionInfo, null, 2));
console.log('');
console.log('需要上传到服务器 /app/updates/ 的文件:');
filesToUpload.forEach(function(f) {
  var size = 'N/A';
  if (fs.existsSync(f.src)) {
    var stat = fs.statSync(f.src);
    size = (stat.size / 1024 / 1024).toFixed(1) + ' MB';
  }
  console.log('  ' + f.dst + '  (' + size + ')');
});
console.log('');
console.log('上传命令示例:');
console.log('  scp dist/latest.yml dist/artist-manager-setup.exe dist/artist-manager-setup.exe.blockmap dist/version-info.json dist/manifest.plist dist/artist-manager.apk ubuntu@42.194.230.53:/tmp/updates/');
console.log('  ssh ubuntu@42.194.230.53 "sudo cp /tmp/updates/* /app/updates/ && sudo systemctl restart artist-manager"');
console.log('');
