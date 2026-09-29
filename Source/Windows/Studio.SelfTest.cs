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

// Runs in a separate profile. Never point this at a drawing profile.
internal sealed partial class StudioWindow
{
    private async Task RunSelfTest()
    {
        try
        {
            if (testStage == 0)
            {
                testStage = 1;
                string result = await browser.CoreWebView2.ExecuteScriptAsync(DesktopScripts.Read("drawing-test.js"));
                var state = json.Deserialize<Dictionary<string, object>>(result);
                if (state == null || !state.ContainsKey("ok"))
                    throw new Exception("The embedded app did not pass initialization: " + result);
                File.WriteAllText(Path.Combine(Program.TestRoot, "engine-test.json"), result);
                await browser.CoreWebView2.ExecuteScriptAsync(DesktopScripts.Read("preset-test.js"));
                string presetStatus = "";
                for (int attempt = 0; attempt < 100; attempt++)
                {
                    await Task.Delay(100);
                    presetStatus = await browser.CoreWebView2.ExecuteScriptAsync("window.presetTestResult");
                    if (presetStatus != "\"running\"")
                        break;
                }

                File.WriteAllText(Path.Combine(Program.TestRoot, "preset-test.json"), presetStatus);
                if (presetStatus != "\"PASS\"")
                    throw new Exception("Preset test: " + presetStatus);
                using (var preview = File.Create(Path.Combine(Program.TestRoot, "preset-motion.png")))
                    await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, preview);
                await browser.CoreWebView2.ExecuteScriptAsync("showPanel('draw');$('stampDetails').open=true;$('inspector').scrollTop=0");
                using (var preview = File.Create(Path.Combine(Program.TestRoot, "preset-brush.png")))
                    await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, preview);
                await browser.CoreWebView2.ExecuteScriptAsync("$('stampVariationSettings').scrollIntoView({block:'start'})");
                using (var preview = File.Create(Path.Combine(Program.TestRoot, "stamp-controls.png")))
                    await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, preview);
                await browser.CoreWebView2.ExecuteScriptAsync("setTool('pen');$('inspector').scrollTop=0");
                using (var preview = File.Create(Path.Combine(Program.TestRoot, "regular-controls.png")))
                    await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, preview);
                await browser.CoreWebView2.ExecuteScriptAsync("showLibrary()");
                using (var preview = File.Create(Path.Combine(Program.TestRoot, "preset-manager.png")))
                    await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, preview);
                await browser.CoreWebView2.ExecuteScriptAsync("$('libraryDialog').close();project=validateProject(JSON.parse(window.presetTestPrevious));studioLibrary=window.presetTestLibrary;saveLibrary();resizeBuffers();updateUI();invalidate();saveLocal()");
                testDownload = new TaskCompletionSource<string>();
                await browser.CoreWebView2.ExecuteScriptAsync("download(new Blob([snapshot()],{type:'application/json'}),'native-save-test.jago')");
                string projectPath = await testDownload.Task;
                if (!File.ReadAllText(projectPath).Contains("Windows app self-test"))
                    throw new Exception("Native project save content is incorrect");
                testDownload = new TaskCompletionSource<string>();
                await browser.CoreWebView2.ExecuteScriptAsync("canvasBlob(exportCanvas(0,0,256,192,true)).then(b=>download(b,'native-png-test.png'))");
                string png = await testDownload.Task;
                using (var im = Image.FromFile(png))
                    if (im.Width != 256 || im.Height != 192)
                        throw new Exception("PNG dimensions failed");
                testDownload = new TaskCompletionSource<string>();
                await browser.CoreWebView2.ExecuteScriptAsync("(() => { const w=new GIFWriter(256,192);for(let i=0;i<4;i++)w.add(exportCanvas(0,i,256,192,false).getContext('2d').getImageData(0,0,256,192).data,.125,false);download(w.finish(),'native-gif-test.gif'); })()");
                await testDownload.Task;
                testDownload = new TaskCompletionSource<string>();
                await browser.CoreWebView2.ExecuteScriptAsync("exportPNGSequence({seconds:1,fps:24,w:128,h:96,transparent:true,style:'smooth'}).then(b=>download(b,'native-sequence-test.zip'))");
                string sequencePath = await testDownload.Task;
                byte[] sequenceBytes = File.ReadAllBytes(sequencePath);
                if (sequenceBytes.Length < 100 || sequenceBytes[0] != 80 || sequenceBytes[1] != 75)
                    throw new Exception("Native PNG sequence ZIP failed");
                await CaptureDesignPreviews();
                browser.CoreWebView2.Reload();
            }
            else if (testStage == 1)
            {
                testStage = 2;
                string persisted = await browser.CoreWebView2.ExecuteScriptAsync("project.name === 'Windows app self-test' && project.frames.length === 2 && project.renderStyle === 'pixel'");
                if (persisted != "true")
                    throw new Exception("Autosave did not survive a page reload");
                if (pageErrors.Count != 0)
                    throw new Exception(string.Join("\n", pageErrors));
                TestDone(true, "PASS: packaged resources, native WebView2 startup, isolated local origin, canvas rendering, timeline edits, motion and shading studies, 72-image motion export schedule, presets, new shapes, crisp pixels, lossless style switching, clear all undo, animated selection groups, brush resets, themes, selection handles, layer duplication, independent colour picker, connected layer warps, all-frame timing with undo, native project/PNG/GIF/PNG-sequence ZIP saving, and autosave restored after reload. No page errors.");
            }
        }
        catch (Exception ex)
        {
            TestDone(false, ex.ToString());
        }
    }

    private void TestDone(bool success, string result)
    {
        if (watchdog != null)
            watchdog.Stop();
        Program.Result = success ? 0 : 1;
        File.WriteAllText(Path.Combine(Program.TestRoot, "result.txt"), result + (pageErrors.Count == 0 ? "" : "\n" + string.Join("\n", pageErrors)));
        allowClose = true;
        Close();
    }
}
