package com.shitsub.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.TextView;

/**
 * Hosts the ShitSub web app (assets/index.html) inside a full-screen WebView.
 *
 * This version wraps WebView creation in a try/catch: on some devices the
 * system's WebView component can be missing, disabled, or too old, which
 * otherwise crashes the app instantly on launch with no visible error.
 * If that happens here, you'll see a readable on-screen message instead.
 */
public class MainActivity extends Activity {

    private static final String TAG = "ShitSub";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 51426;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            setupWebView();
        } catch (Throwable t) {
            // Don't let a WebView init failure silently kill the app —
            // show the real reason on screen instead.
            Log.e(TAG, "Failed to initialize WebView", t);
            showFatalError(t);
        }
    }

    private void setupWebView() {
        webView = new WebView(this);
        setContentView(webView);

        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);      // required: localStorage powers "remember" tick options
        settings.setAllowFileAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                              ValueCallback<Uri[]> filePathCallbackParam,
                                              FileChooserParams fileChooserParams) {
                filePathCallback = filePathCallbackParam;
                Intent intent = fileChooserParams.createIntent();
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                        "text/plain", "application/x-subrip", "application/octet-stream"
                });
                try {
                    startActivityForResult(Intent.createChooser(intent, "Select SRT file"),
                            FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Make sure the remote's D-pad / touch actually reaches the WebView content.
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);

        webView.loadUrl("file:///android_asset/index.html");
    }

    /** Shows the actual exception on screen instead of a silent crash-to-home. */
    private void showFatalError(Throwable t) {
        TextView tv = new TextView(this);
        tv.setBackgroundColor(Color.WHITE);
        tv.setTextColor(Color.parseColor("#E50914"));
        tv.setTextSize(14);
        tv.setPadding(40, 80, 40, 40);
        tv.setGravity(Gravity.START);
        tv.setText("ShitSub failed to start.\n\nReason:\n" + Log.getStackTraceString(t));
        setContentView(tv);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri singleUri = data.getData();
                if (singleUri != null) {
                    results = new Uri[]{singleUri};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
