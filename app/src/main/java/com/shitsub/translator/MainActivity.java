package com.shitsub.translator;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
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
import java.io.IOException;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private WebView webView;

    private ValueCallback<Uri[]> filePathCallback;

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int STORAGE_PERMISSION_REQUEST_CODE = 1002;

    private byte[] pendingDownloadData;
    private String pendingFileName;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        // Immersive TV mode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                            | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }

        // Create WebView
        webView = new WebView(this);
        setContentView(webView);

        // WebView settings
        WebSettings webSettings = webView.getSettings();

        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);

        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // WebView debugging
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // JavaScript interface
        webView.addJavascriptInterface(
                new AndroidDownload(),
                "AndroidDownload"
        );

        // WebView client
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request
            ) {
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    String url
            ) {
                return false;
            }
        });

        // File chooser
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {

                // Cancel previous callback
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback = filePathCallback;

                try {
                    Intent intent = fileChooserParams.createIntent();

                    intent.addCategory(Intent.CATEGORY_OPENABLE);

                    // Allow SRT/text files
                    intent.setType("*/*");

                    startActivityForResult(
                            intent,
                            FILE_CHOOSER_REQUEST_CODE
                    );

                    return true;

                } catch (Exception e) {

                    MainActivity.this.filePathCallback = null;

                    Toast.makeText(
                            MainActivity.this,
                            "Unable to open file picker",
                            Toast.LENGTH_SHORT
                    ).show();

                    return false;
                }
            }
        });

        // WebView download listener
        webView.setDownloadListener(
                (url, userAgent, contentDisposition, mimetype, contentLength) -> {

                    Toast.makeText(
                            MainActivity.this,
                            "Download started",
                            Toast.LENGTH_SHORT
                    ).show();
                }
        );

        // Load app
        webView.loadUrl(
                "file:///android_asset/index.html"
        );
    }


    /**
     * Handle file chooser result.
     */
    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {

            if (filePathCallback == null) {
                return;
            }

            Uri[] results = null;

            if (resultCode == RESULT_OK && data != null) {

                Uri result = data.getData();

                if (result != null) {
                    results = new Uri[]{result};
                }
            }

            filePathCallback.onReceiveValue(results);

            filePathCallback = null;
        }
    }


    /**
     * JavaScript interface.
     *
     * HTML can call:
     *
     * AndroidDownload.saveSrt(base64Data, fileName)
     */
    public class AndroidDownload {

        @JavascriptInterface
        public void saveSrt(
                String base64Data,
                String fileName
        ) {

            // Copy values before entering lambda.
            final String receivedBase64 = base64Data;
            final String receivedFileName = fileName;

            runOnUiThread(() -> {

                if (receivedBase64 == null ||
                        receivedBase64.isEmpty()) {

                    Toast.makeText(
                            MainActivity.this,
                            "No file data received",
                            Toast.LENGTH_LONG
                    ).show();

                    return;
                }

                String safeFileName = receivedFileName;

                if (safeFileName == null ||
                        safeFileName.trim().isEmpty()) {

                    safeFileName = "translated.srt";
                }

                // Remove data URL prefix if present
                String cleanBase64 = receivedBase64;

                if (cleanBase64.contains(",")) {

                    cleanBase64 =
                            cleanBase64.substring(
                                    cleanBase64.indexOf(",") + 1
                            );
                }

                try {

                    byte[] data = Base64.decode(
                            cleanBase64,
                            Base64.DEFAULT
                    );

                    if (Build.VERSION.SDK_INT >=
                            Build.VERSION_CODES.Q) {

                        saveUsingMediaStore(
                                data,
                                safeFileName
                        );

                    } else {

                        saveUsingOldStorage(
                                data,
                                safeFileName
                        );
                    }

                } catch (Exception e) {

                    e.printStackTrace();

                    Toast.makeText(
                            MainActivity.this,
                            "Download failed: "
                                    + e.getMessage(),
                            Toast.LENGTH_LONG
                    ).show();
                }
            });
        }
    }


    /**
     * Android 10+
     * Save to public Downloads folder.
     */
    private void saveUsingMediaStore(
            byte[] data,
            String fileName
    ) throws IOException {

        ContentValues values = new ContentValues();

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

        values.put(
                MediaStore.Downloads.IS_PENDING,
                1
        );

        Uri uri = getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                values
        );

        if (uri == null) {
            throw new IOException(
                    "Could not create download file"
            );
        }

        try {

            OutputStream outputStream =
                    getContentResolver().openOutputStream(uri);

            if (outputStream == null) {

                throw new IOException(
                        "Could not open output stream"
                );
            }

            outputStream.write(data);
            outputStream.flush();
            outputStream.close();

            ContentValues completedValues =
                    new ContentValues();

            completedValues.put(
                    MediaStore.Downloads.IS_PENDING,
                    0
            );

            getContentResolver().update(
                    uri,
                    completedValues,
                    null,
                    null
            );

            Toast.makeText(
                    MainActivity.this,
                    "Downloaded to Downloads:\n"
                            + fileName,
                    Toast.LENGTH_LONG
            ).show();

        } catch (Exception e) {

            getContentResolver().delete(
                    uri,
                    null,
                    null
            );

            throw e;
        }
    }


    /**
     * Android 9 and below.
     */
    private void saveUsingOldStorage(
            byte[] data,
            String fileName
    ) throws IOException {

        if (Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.M) {

            if (checkSelfPermission(
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) != PackageManager.PERMISSION_GRANTED) {

                pendingDownloadData = data;
                pendingFileName = fileName;

                requestPermissions(
                        new String[]{
                                Manifest.permission.WRITE_EXTERNAL_STORAGE
                        },
                        STORAGE_PERMISSION_REQUEST_CODE
                );

                return;
            }
        }

        File downloadsDir =
                Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS
                );

        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs();
        }

        File file =
                new File(
                        downloadsDir,
                        fileName
                );

        FileOutputStream fos =
                new FileOutputStream(file);

        fos.write(data);
        fos.flush();
        fos.close();

        // Notify Android
        Intent scanIntent =
                new Intent(
                        Intent.ACTION_MEDIA_SCANNER_SCAN_FILE
                );

        scanIntent.setData(
                Uri.fromFile(file)
        );

        sendBroadcast(scanIntent);

        Toast.makeText(
                MainActivity.this,
                "Downloaded to Downloads:\n"
                        + fileName,
                Toast.LENGTH_LONG
        ).show();
    }


    /**
     * Storage permission result.
     */
    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {

        super.onRequestPermissionsResult(
                requestCode,
                permissions,
                grantResults
        );

        if (requestCode ==
                STORAGE_PERMISSION_REQUEST_CODE) {

            if (grantResults.length > 0 &&
                    grantResults[0] ==
                            PackageManager.PERMISSION_GRANTED) {

                if (pendingDownloadData != null) {

                    try {

                        saveUsingOldStorage(
                                pendingDownloadData,
                                pendingFileName
                        );

                    } catch (Exception e) {

                        Toast.makeText(
                                MainActivity.this,
                                "Download failed",
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }

            } else {

                Toast.makeText(
                        MainActivity.this,
                        "Storage permission denied",
                        Toast.LENGTH_LONG
                ).show();
            }

            pendingDownloadData = null;
            pendingFileName = null;
        }
    }


    /**
     * Android TV / remote back button.
     */
    @Override
    public boolean onKeyDown(
            int keyCode,
            KeyEvent event
    ) {

        if (keyCode == KeyEvent.KEYCODE_BACK) {

            if (webView != null &&
                    webView.canGoBack()) {

                webView.goBack();

                return true;
            }
        }

        return super.onKeyDown(
                keyCode,
                event
        );
    }


    @Override
    protected void onResume() {

        super.onResume();

        if (webView != null) {
            webView.onResume();
        }
    }


    @Override
    protected void onPause() {

        if (webView != null) {
            webView.onPause();
        }

        super.onPause();
    }


    @Override
    protected void onDestroy() {

        if (webView != null) {

            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
