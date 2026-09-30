package com.shitsub.translator;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Hide navigation bars for immersive TV experience
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }

        // Create and configure WebView
        webView = new WebView(this);
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Enable remote debugging
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // Add JavaScript interface for Android download
        webView.addJavascriptInterface(new AndroidDownload(), "AndroidDownload");

        // WebView clients
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load the web app
        webView.loadUrl("file:///android_asset/index.html");
    }

    /**
     * JavaScript Interface for downloading SRT files from WebView
     */
    public class AndroidDownload {

        @JavascriptInterface
        public void saveSrt(String base64Data, String fileName) {
            runOnUiThread(() -> {
                try {
                    // Decode base64 data
                    byte[] data = Base64.decode(base64Data, Base64.DEFAULT);

                    // Get Downloads directory
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS
                    );

                    // Create file
                    File file = new File(downloadsDir, fileName);

                    // Write data
                    FileOutputStream fos = new FileOutputStream(file);
                    fos.write(data);
                    fos.close();

                    // Show success message
                    Toast.makeText(
                        MainActivity.this,
                        "Downloaded: " + fileName,
                        Toast.LENGTH_LONG
                    ).show();

                    // Notify media scanner
                    Uri contentUri = Uri.fromFile(file);
                    sendBroadcast(new android.content.Intent(
                        android.content.Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                        contentUri
                    ));

                } catch (IOException e) {
                    e.printStackTrace();
                    Toast.makeText(
                        MainActivity.this,
                        "Download failed: " + e.getMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                }
            });
        }
    }

    /**
     * Handle D-Pad and remote control navigation
     */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Handle back button
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }

        // Pass other keys to WebView for focus navigation
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
