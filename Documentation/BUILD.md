# Building from source

This is for people who want to change the application. You do not need it to use the studio.

With Node.js installed, run `node Source/build-browser.cjs` from the studio folder. That builds the self-contained HTML.

On Windows, run `Source/Windows/Build.ps1 -SdkDirectory <your WebView2 SDK folder>`. It uses the .NET Framework compiler and embeds the browser page. The WebView2 Runtime is required when running the resulting application. Dependencies and fonts retain the included licences.
