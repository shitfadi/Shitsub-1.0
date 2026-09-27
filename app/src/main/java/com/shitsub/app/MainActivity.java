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
            Log.e(TAG, "Failed to initialize WebView", t);
            showFatalError(t);
        }
    }

    private void setupWebView() {
        webView = new WebView(this);
        setContentView(webView);

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
                // Show ALL files rather than filtering by MIME type: many file
                // managers (especially OEM ones) don't tag .srt files with a
                // matching MIME type, which made the picker show nothing
                // selectable and appear to hang. Letting the user browse
                // freely and pick their .srt manually is far more reliable.
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
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
