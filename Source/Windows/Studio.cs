// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed partial class StudioWindow : Form
{
    private const string Origin = "https://jagoloopstudio.example";
    private readonly WebView2 browser = new WebView2();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer
    {
        MaxJsonLength = 32000000
    };
    private readonly Label loading = new Label();
    private bool ready, allowClose, closing;
    private int testStage;
    private string lastSaveFolder = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    private TaskCompletionSource<string> testDownload;
    private System.Windows.Forms.Timer watchdog;
    private readonly List<string> pageErrors = new List<string>();
    internal StudioWindow()
    {
        Text = "Jago Wobble Studio";
        ClientSize = new Size(1360, 900);
        MinimumSize = new Size(780, 600);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(243, 237, 223);
        Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
        AutoScaleMode = AutoScaleMode.Dpi;
        browser.Dock = DockStyle.Fill;
        browser.DefaultBackgroundColor = BackColor;
        loading.Dock = DockStyle.Fill;
        loading.Text = "Opening your studio…";
        loading.TextAlign = ContentAlignment.MiddleCenter;
        loading.ForeColor = Color.FromArgb(41, 78, 104);
        loading.Font = new Font("Segoe UI", 18);
        Controls.Add(browser);
        Controls.Add(loading);
        if (Program.IsTest)
        {
            ShowInTaskbar = false;
            Opacity = 0;
            watchdog = new System.Windows.Forms.Timer
            {
                Interval = 60000
            };
            watchdog.Tick += delegate
            {
                TestDone(false, "Native app test timed out");
            };
            watchdog.Start();
        }

        Shown += async delegate
        {
            await StartBrowser();
        };
        FormClosing += BeforeClose;
    }

    private async Task StartBrowser()
    {
        try
        {
            CoreWebView2Environment.GetAvailableBrowserVersionString();
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.AppRoot, "Profile"));
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = Program.IsTest;
            core.Settings.IsSwipeNavigationEnabled = false;
            core.SetVirtualHostNameToFolderMapping("jagoloopstudio.example", Program.RuntimeRoot, CoreWebView2HostResourceAccessKind.DenyCors);
            core.NavigationStarting += (s, e) =>
            {
                if (!e.Uri.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase))
                    e.Cancel = true;
            };
            core.NewWindowRequested += (s, e) =>
            {
                e.Handled = true;
                OpenCreditLink(e.Uri);
            };
            core.DownloadStarting += DownloadStarting;
            // This local studio handles each file through its own Windows Save dialog.
            // Permit repeated exports only within this app's private origin.
            core.PermissionRequested += (s, e) =>
            {
                if (e.Uri.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase) && e.PermissionKind == CoreWebView2PermissionKind.MultipleAutomaticDownloads)
                    e.State = CoreWebView2PermissionState.Allow;
            };
            core.WebMessageReceived += (s, e) =>
            {
                if (!e.Source.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase))
                    return;
                try
                {
                    string message = e.TryGetWebMessageAsString();
                    if (Program.IsTest && message.StartsWith("test-stage:"))
                        File.AppendAllText(Path.Combine(Program.TestRoot, "test-stages.txt"), message + "\n");
                    if (message.StartsWith("page-error:"))
                    {
                        pageErrors.Add(message);
                        if (Program.IsTest)
                            File.AppendAllText(Path.Combine(Program.TestRoot, "page-errors.txt"), message + "\n");
                    }
                }
                catch
                {
                }
            };
            core.ProcessFailed += delegate
            {
                if (Program.IsTest)
                    TestDone(false, "The drawing renderer stopped unexpectedly");
                else
                    MessageBox.Show(this, "The drawing renderer stopped. Close and reopen the studio to restore your last autosave.", Text);
            };
            await core.AddScriptToExecuteOnDocumentCreatedAsync(DesktopScripts.Read("desktop-bridge.js"));
            core.NavigationCompleted += async (s, e) =>
            {
                if (!e.IsSuccess)
                {
                    if (Program.IsTest)
                        TestDone(false, "Navigation failed: " + e.WebErrorStatus);
                    else
                        loading.Text = "The studio could not load. Please close and reopen the app.";
                    return;
                }

                ready = true;
                loading.Visible = false;
                browser.Focus();
                if (Program.IsTest)
                    await RunSelfTest();
            };
            core.Navigate(Origin + "/index.html");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            if (Program.IsTest)
            {
                TestDone(false, "Microsoft WebView2 Runtime is missing");
                return;
            }

            loading.Text = "Microsoft Edge WebView2 Runtime is needed to open this app.";
            var button = new Button
            {
                Text = "Open Microsoft’s download page",
                AutoSize = true,
                Anchor = AnchorStyles.None,
                BackColor = Color.FromArgb(41, 78, 104),
                ForeColor = Color.FromArgb(255, 250, 240),
                Padding = new Padding(12),
                Location = new Point(30, 30)
            };
            button.Click += delegate
            {
                Process.Start(new ProcessStartInfo("https://developer.microsoft.com/microsoft-edge/webview2/") { UseShellExecute = true });
            };
            Controls.Add(button);
            button.BringToFront();
        }
        catch (Exception ex)
        {
            if (Program.IsTest)
                TestDone(false, ex.ToString());
            else
            {
                loading.Text = "The studio could not open.";
                MessageBox.Show(this, ex.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    private void DownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
    {
        var deferral = e.GetDeferral();
        e.Handled = true;
        // Leave WebView's callback before opening a modal Windows dialog.
        BeginInvoke(new Action(() =>
        {
            try
            {
                string name = Path.GetFileName(e.ResultFilePath);
                if (string.IsNullOrWhiteSpace(name))
                    name = "Jago drawing.png";
                string path;
                if (Program.IsTest)
                    path = Path.Combine(Program.TestRoot, name);
                else
                {
                    string ext = Path.GetExtension(name).ToLowerInvariant();
                    using (var dialog = new SaveFileDialog
                    {
                        FileName = name,
                        InitialDirectory = lastSaveFolder,
                        AddExtension = true,
                        DefaultExt = ext.TrimStart('.'),
                        OverwritePrompt = true,
                        Filter = ext == ".jago" ? "Jago Wobble project (*.jago)|*.jago" : ext == ".jagopresets" ? "Jago presets (*.jagopresets)|*.jagopresets" : ext == ".gif" ? "Animated GIF (*.gif)|*.gif" : ext == ".zip" ? "PNG frame sequence (*.zip)|*.zip" : "PNG image (*.png)|*.png"
                    }

                    )
                    {
                        if (dialog.ShowDialog(this) != DialogResult.OK)
                        {
                            e.Cancel = true;
                            Announce("Save cancelled");
                            return;
                        }

                        path = dialog.FileName;
                        lastSaveFolder = Path.GetDirectoryName(path);
                    }
                }

                e.ResultFilePath = path;
                var operation = e.DownloadOperation;
                EventHandler<object> completed = null;
                completed = (s, args) =>
                {
                    if (operation.State == CoreWebView2DownloadState.Completed)
                    {
                        operation.StateChanged -= completed;
                        Announce("Saved " + Path.GetFileName(path));
                        if (testDownload != null)
                            testDownload.TrySetResult(path);
                    }
                    else if (operation.State == CoreWebView2DownloadState.Interrupted)
                    {
                        operation.StateChanged -= completed;
                        Announce("File was not saved: " + operation.InterruptReason);
                        if (testDownload != null)
                            testDownload.TrySetException(new IOException(operation.InterruptReason.ToString()));
                    }
                };
                operation.StateChanged += completed;
            }
            catch (Exception ex)
            {
                e.Cancel = true;
                if (Program.IsTest)
                    TestDone(false, ex.ToString());
                else
                    MessageBox.Show(this, "The file could not be saved.\n\n" + ex.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                deferral.Complete();
            }
        }));
    }

    private void OpenCreditLink(string url)
    {
        if (url != "https://internet-janitor.itch.io/wigglypaint" && url != "https://github.com/JohnEarnest/Decker" && url != "https://cameronjagolis.co.uk/" && url != "https://ko-fi.com/cameronillustrates" && url != "https://github.com/snowwy123/Jago-Wobble-Studio")
            return;
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
        }
    }

    private async void Announce(string message)
    {
        if (!ready || browser.IsDisposed)
            return;
        try
        {
            await browser.CoreWebView2.ExecuteScriptAsync("window.desktopToast && window.desktopToast(" + json.Serialize(message) + ")");
        }
        catch
        {
        }
    }

    private async void BeforeClose(object sender, FormClosingEventArgs e)
    {
        if (allowClose || !ready || Program.IsTest)
            return;
        e.Cancel = true;
        if (closing)
            return;
        closing = true;
        try
        {
            string result = await browser.CoreWebView2.ExecuteScriptAsync("(() => { if(dirty) saveLocal(); return exporting ? 'export' : autosaveFailed ? 'save' : 'ok'; })()");
            string status = json.Deserialize<string>(result);
            if (status != "ok" && MessageBox.Show(this, status == "export" ? "An export is still running. Close the studio anyway?" : "Your drawing could not be autosaved. Cancel and use Save to keep a project file, or close anyway.", Text, MessageBoxButtons.OKCancel, MessageBoxIcon.Warning) != DialogResult.OK)
                return;
            allowClose = true;
            Close();
        }
        catch
        {
            allowClose = true;
            Close();
        }
        finally
        {
            closing = false;
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (watchdog != null)
                watchdog.Dispose();
            browser.Dispose();
        }

        base.Dispose(disposing);
    }
}
