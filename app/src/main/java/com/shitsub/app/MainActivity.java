package com.shitsub.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final String TAG = "ShitSub";
    private static final int FILE_CHOOSER_REQUEST_CODE = 51426;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            setupWebView();
        } catch (Throwable t) {
            Log.e(TAG, "Failed to initialize WebView", t);
            showError(t);
        }
    }

    private void setupWebView() {

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Android TV focus
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        /*
         * Connect JavaScript to Android.
         *
         * JavaScript can call:
         *
         * AndroidDownload.saveSrt(base64Data, filename)
         */
        webView.addJavascriptInterface(
                new AndroidDownload(),
                "AndroidDownload"
        );

        /*
         * Handle HTML file picker.
         */
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams fileChooserParams) {

                Log.d(TAG, "File chooser requested");

                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }

                filePathCallback = callback;

                try {

                    Intent intent =
                            new Intent(Intent.ACTION_OPEN_DOCUMENT);

                    intent.addCategory(Intent.CATEGORY_OPENABLE);

                    // Do not restrict MIME type.
                    // Some file managers don't identify .srt correctly.
                    intent.setType("*/*");

                    intent.addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                                    | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
                    );

                    startActivityForResult(
                            intent,
                            FILE_CHOOSER_REQUEST_CODE
                    );

                    return true;

                } catch (Exception e) {

                    Log.e(TAG, "Unable to open file picker", e);

                    if (filePathCallback != null) {
                        filePathCallback.onReceiveValue(null);
                        filePathCallback = null;
                    }

                    return false;
                }
            }
        });

        webView.requestFocus(View.FOCUS_DOWN);

        /*
         * Load your HTML.
         */
        webView.loadUrl(
                "file:///android_asset/index.html"
        );
    }

    /*
     * Android file picker result.
     */
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

            Uri selectedUri = data.getData();

            if (selectedUri != null) {

                results = new Uri[]{selectedUri};

                try {

                    getContentResolver()
                            .takePersistableUriPermission(
                                    selectedUri,
                                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                            );

                } catch (Exception e) {

                    Log.d(
                            TAG,
                            "Persistable permission unavailable"
                    );
                }
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    /*
     * JavaScript bridge for downloading SRT.
     */
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

                    if (android.os.Build.VERSION.SDK_INT >= 29) {

                        /*
                         * Android 10+
                         *
                         * Save directly into Downloads
                         * using MediaStore.
                         */
                        android.content.ContentValues values =
                                new android.content.ContentValues();

                        values.put(
                                android.provider.MediaStore.Downloads.DISPLAY_NAME,
                                fileName
                        );

                        values.put(
                                android.provider.MediaStore.Downloads.MIME_TYPE,
                                "application/x-subrip"
                        );

                        values.put(
                                android.provider.MediaStore.Downloads.RELATIVE_PATH,
                                Environment.DIRECTORY_DOWNLOADS
                        );

                        Uri uri =
                                getContentResolver().insert(
                                        android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
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
                                        "Could not open download file"
                                );
                            }

                            outputStream.write(data);
                            outputStream.flush();
                        }

                    } else {

                        /*
                         * Older Android versions.
                         */
                        java.io.File downloads =
                                Environment.getExternalStoragePublicDirectory(
                                        Environment.DIRECTORY_DOWNLOADS
                                );

                        if (!downloads.exists()) {
                            downloads.mkdirs();
                        }

                        java.io.File file =
                                new java.io.File(
                                        downloads,
                                        fileName
                                );

                        try (java.io.FileOutputStream fos =
                                     new java.io.FileOutputStream(file)) {

                            fos.write(data);
                            fos.flush();
                        }
                    }

                    Toast.makeText(
                            MainActivity.this,
                            "SRT saved to Downloads",
                            Toast.LENGTH_LONG
                    ).show();

                    Log.d(
                            TAG,
                            "SRT saved: " + fileName
                    );

                } catch (Exception e) {

                    Log.e(
                            TAG,
                            "SRT download failed",
                            e
                    );

                    Toast.makeText(
                            MainActivity.this,
                            "Download failed: " + e.getMessage(),
                            Toast.LENGTH_LONG
                    ).show();
                }
            });
        }
    }

    /*
     * Android back button.
     */
    @Override
    public void onBackPressed() {

        if (webView != null && webView.canGoBack()) {

            webView.goBack();

        } else {

            super.onBackPressed();
        }
    }

    /*
     * Clean up.
     */
    @Override
    protected void onDestroy() {

        if (webView != null) {

            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

    /*
     * Error screen.
     */
    private void showError(Throwable throwable) {

        android.widget.TextView textView =
                new android.widget.TextView(this);

        textView.setBackgroundColor(
                android.graphics.Color.WHITE
        );

        textView.setTextColor(
                android.graphics.Color.RED
        );

        textView.setTextSize(14);

        textView.setPadding(
                40,
                80,
                40,
                40
        );

        textView.setText(
                "ShitSub failed to start.\n\n" +
                "Reason:\n\n" +
                Log.getStackTraceString(throwable)
        );

        setContentView(textView);
    }
}
