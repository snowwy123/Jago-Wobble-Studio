# Building Jago Wobble

Use Windows x64 and Microsoft Edge WebView2 Runtime. Install Node.js for the browser build and the .NET Framework C# compiler for the Windows host.

From this repository, run **Build.ps1** in PowerShell. The wrapper uses the included WebView2 SDK. Edit the files under **Source**, then rebuild; generated HTML is build output.

Keep licence notices with redistributed code and binaries.

## Refresher checks

Run `node --test Source/Tests/build.test.cjs` after building. With Playwright and Edge available, run `node Source/Tests/refresher-browser.cjs "path-to-extracted-Odd-Little-Marks-v1.5"`. `WOBBLE_TEST_OUTPUT` chooses an evidence folder. The test uses an isolated browser profile; it never edits the supplied brush pack.

For the existing Windows regression suite, run the built app with `--self-test` and a new, empty test folder. For the refresher probe, copy `Source/Native-probes/refresher.js` to `probe.js` in another new test folder and run the app with `--suite-test` and that folder. Set `JAGO_SUITE_ROOT` to a private test location. Never use a real drawing profile for tests.
