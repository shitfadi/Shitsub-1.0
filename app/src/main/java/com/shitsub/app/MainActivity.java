package com.shitsub.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

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

        // JavaScript
        settings.setJavaScriptEnabled(true);

        // localStorage
        settings.setDomStorageEnabled(true);

        // File/content access
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Database
        settings.setDatabaseEnabled(true);

        // Display
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // Cache
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Android TV focus
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        /*
         * Handle <input type="file"> from the HTML app.
         */
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams fileChooserParams) {

                Log.d(TAG, "File chooser requested");

                // Cancel an old callback if one exists
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }

                filePathCallback = callback;

                try {

                    /*
                     * ACTION_OPEN_DOCUMENT is more reliable than
                     * ACTION_GET_CONTENT for Android TV / modern Android.
                     */
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);

                    intent.addCategory(Intent.CATEGORY_OPENABLE);

                    /*
                     * Do NOT restrict this to text/plain.
                     *
                     * Some Android file managers don't correctly
                     * identify .srt files.
                     */
                    intent.setType("*/*");

                    /*
                     * Give WebView permission to read the selected file.
                     */
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

        /*
         * Give initial focus to the WebView for Android TV remote control.
         */
        webView.requestFocus(View.FOCUS_DOWN);

        /*
         * Load the HTML app from:
         *
         * app/src/main/assets/index.html
         */
        webView.loadUrl("file:///android_asset/index.html");
    }

    /*
     * Receive the selected SRT file.
     */
    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(requestCode, resultCode, data);

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

                /*
                 * Keep permission to read the selected file.
                 *
                 * Some file providers don't support this, so
                 * failure is safely ignored.
                 */
                try {

                    getContentResolver().takePersistableUriPermission(
                            selectedUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );

                } catch (Exception e) {

                    Log.d(
                            TAG,
                            "Persistable permission not available"
                    );
                }
            }
        }

        /*
         * Send the selected file back to WebView.
         */
        filePathCallback.onReceiveValue(results);

        filePathCallback = null;
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
     * Clean up WebView.
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
     * Show an error if WebView initialization fails.
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
