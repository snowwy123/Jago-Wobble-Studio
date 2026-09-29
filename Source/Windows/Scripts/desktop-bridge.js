window.addEventListener('error', (e) => chrome.webview.postMessage('page-error:' + e.message));
window.addEventListener('unhandledrejection', (e) =>
  chrome.webview.postMessage('page-error:' + String(e.reason))
);
window.addEventListener('DOMContentLoaded', () => {
  const originalToast = toast;
  window.desktopToast = originalToast;
  toast = (message) =>
    originalToast(
      message === 'Export downloaded' || message === 'Editable project downloaded'
        ? 'Choose where to save your file…'
        : message
    );
});
