package com.shitsub.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 51426;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    // Your GitHub Pages website
    private static final String WEBSITE_URL =
            "https://pkutty6369-droid.github.io/Srt-Malayalam-translation-/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();

        // JavaScript
        webSettings.setJavaScriptEnabled(true);

        // Local storage
        webSettings.setDomStorageEnabled(true);

        // File access
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        // Better TV/mobile website rendering
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);

        // Always load the latest GitHub version
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // JavaScript → Android bridge
        webView.addJavascriptInterface(
                new AndroidDownload(),
                "AndroidDownload"
        );

        // File picker / upload
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);

                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");

                intent.addFlags(
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
                );

                try {
                    startActivityForResult(
                            intent,
                            FILE_CHOOSER_REQUEST_CODE
                    );
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(
                            MainActivity.this,
                            "Unable to open file picker",
                            Toast.LENGTH_SHORT
                    ).show();
                    return false;
                }

                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request) {

                view.loadUrl(request.getUrl().toString());
                return true;
            }
        });

        // Load GitHub Pages instead of APK's local HTML
        webView.loadUrl(WEBSITE_URL);
    }

    // Receive selected SRT file
    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (requestCode != FILE_CHOOSER_REQUEST_CODE) {
            return;
        }

        if (filePathCallback == null) {
            return;
        }

        Uri[] results = null;

        if (resultCode == RESULT_OK && data != null) {

            Uri uri = data.getData();

            if (uri != null) {
                results = new Uri[]{uri};

                try {
                    final int takeFlags =
                            data.getFlags()
                                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION
                                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

                    getContentResolver()
                            .takePersistableUriPermission(
                                    uri,
                                    takeFlags
                            );

                } catch (Exception ignored) {
                }
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    // Android back button
    @Override
    public void onBackPressed() {

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // Native Android download bridge
    public class AndroidDownload {

        @JavascriptInterface
        public void saveSrt(
                String base64Data,
                String fileName) {

            runOnUiThread(() -> {

                try {

                    byte[] data = Base64.decode(
                            base64Data,
                            Base64.DEFAULT
                    );

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {

                        // Android 10+
                        ContentValues values =
                                new ContentValues();

                        values.put(
                                MediaStore.Downloads.DISPLAY_NAME,
                                fileName
                        );

                        values.put(
                                MediaStore.Downloads.MIME_TYPE,
                                "application/x-subrip"
                        );

                        values.put(
                                MediaStore.Downloads.RELATIVE_PATH,
                                Environment.DIRECTORY_DOWNLOADS
                        );

                        Uri uri = getContentResolver()
                                .insert(
                                        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                        values
                                );

                        if (uri == null) {
                            throw new Exception(
                                    "Could not create download file"
                            );
                        }

                        try (OutputStream outputStream =
                                     getContentResolver()
                                             .openOutputStream(uri)) {

                            if (outputStream == null) {
                                throw new Exception(
                                        "Could not open download stream"
                                );
                            }

                            outputStream.write(data);
                            outputStream.flush();
                        }

                    } else {

                        // Android 9 and older
                        File downloads =
                                Environment.getExternalStoragePublicDirectory(
                                        Environment.DIRECTORY_DOWNLOADS
                                );

                        if (!downloads.exists()) {
                            downloads.mkdirs();
                        }

                        File file =
                                new File(downloads, fileName);

                        try (FileOutputStream fos =
                                     new FileOutputStream(file)) {

                            fos.write(data);
                            fos.flush();
                        }
                    }

                    Toast.makeText(
                            MainActivity.this,
                            "Malayalam SRT saved to Downloads",
                            Toast.LENGTH_LONG
                    ).show();

                } catch (Exception e) {

                    Toast.makeText(
                            MainActivity.this,
                            "Download failed: " + e.getMessage(),
                            Toast.LENGTH_LONG
                    ).show();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {

        if (webView != null) {

            webView.stopLoading();
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();

            webView = null;
        }

        super.onDestroy();
    }
}
