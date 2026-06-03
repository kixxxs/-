package com.artist.manager;

import android.app.DownloadManager;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.widget.FrameLayout;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private View mCustomView;
    private WebChromeClient.CustomViewCallback mCustomViewCallback;
    private FrameLayout mFullscreenContainer;
    private boolean mIsLandscapeVideo = true; // 默认横版，保持兼容

    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setDatabaseEnabled(true);
            settings.setDomStorageEnabled(true);

            mFullscreenContainer = new FrameLayout(this);
            mFullscreenContainer.setId(View.generateViewId());
            mFullscreenContainer.setBackgroundColor(0xFF000000);

            // JS 接口：前端播放视频时告知横竖方向
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void setVideoOrientation(boolean isLandscape) {
                    mIsLandscapeVideo = isLandscape;
                }
            }, "NativeVideo");

            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                             String mimeType, long contentLength) {
                    try {
                        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                        request.setMimeType(mimeType);
                        request.addRequestHeader("User-Agent", userAgent);
                        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                        request.setTitle(fileName);
                        request.setDescription("正在下载...");
                        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                        dm.enqueue(request);
                        Toast.makeText(MainActivity.this, "下载已开始", Toast.LENGTH_SHORT).show();
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "下载失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onShowCustomView(View view, CustomViewCallback callback) {
                    if (mFullscreenContainer == null) {
                        if (callback != null) callback.onCustomViewHidden();
                        return;
                    }
                    // If already showing a fullscreen view, hide it first
                    if (mCustomView != null) {
                        onHideCustomView();
                    }
                    mCustomView = view;
                    mCustomViewCallback = callback;

                    try {
                        if (mFullscreenContainer.getParent() != null) {
                            ((ViewGroup) mFullscreenContainer.getParent()).removeView(mFullscreenContainer);
                        }
                        if (view.getParent() != null) {
                            ((ViewGroup) view.getParent()).removeView(view);
                        }

                        ((ViewGroup) getWindow().getDecorView()).addView(mFullscreenContainer,
                            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT));
                        mFullscreenContainer.addView(view,
                            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT));
                        mFullscreenContainer.setVisibility(View.VISIBLE);
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                        if (mIsLandscapeVideo) {
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                        }
                    } catch (Exception e) {
                        mCustomView = null;
                        mCustomViewCallback = null;
                        if (callback != null) callback.onCustomViewHidden();
                    }
                }

                @Override
                public void onHideCustomView() {
                    if (mFullscreenContainer == null) return;

                    try {
                        mFullscreenContainer.removeAllViews();
                        if (mFullscreenContainer.getParent() != null) {
                            ((ViewGroup) mFullscreenContainer.getParent()).removeView(mFullscreenContainer);
                        }
                        mFullscreenContainer.setVisibility(View.GONE);
                        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                    } catch (Exception e) {
                        // Ignore - view hierarchy may already be cleaned up
                    }

                    if (mCustomViewCallback != null) {
                        mCustomViewCallback.onCustomViewHidden();
                    }
                    mCustomView = null;
                    mCustomViewCallback = null;
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onBackPressed() {
        if (mCustomView != null) {
            // Exit fullscreen instead of closing activity
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getWebChromeClient().onHideCustomView();
            }
            return;
        }
        super.onBackPressed();
    }
}
