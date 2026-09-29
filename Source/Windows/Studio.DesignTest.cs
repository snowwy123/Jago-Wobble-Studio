// MIT. Copyright (c) 2026 Cameron Jago Lis Illustrates.
using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;

internal sealed partial class StudioWindow
{
    // Captures use the same isolated profile as the native tests.
    private async Task CaptureDesignPreviews()
    {
        var core = browser.CoreWebView2;
        await core.ExecuteScriptAsync(DesktopScripts.Read("release-test.js"));
        string releaseStatus = "";
        for (int attempt = 0; attempt < 100; attempt++)
        {
            releaseStatus = await core.ExecuteScriptAsync("window.releaseTestResult");
            if (releaseStatus != "\"running\"") break;
            await Task.Delay(100);
        }
        File.WriteAllText(Path.Combine(Program.TestRoot, "release-test.json"), releaseStatus);
        if (!releaseStatus.StartsWith("\"PASS:")) throw new Exception(releaseStatus);

        await core.ExecuteScriptAsync("window.designPrevious=snapshot();setTool('pen');brushSize=8;syncBrushUI();setAppTheme('sketchbook');makeStudy('shading');resizeBuffers();invalidate();resetHistory();updateUI();fit();showPanel('layers');$('inspector').scrollTop=0;paintCanvas()");
        await DesignScreenshot("sketchbook-shading.png");
        await core.ExecuteScriptAsync("makeStudy('motion');resizeBuffers();invalidate();resetHistory();updateUI();fit();showPanel('motion');$('inspector').scrollTop=0;paintCanvas()");
        await DesignScreenshot("sketchbook-motion.png");
        await core.ExecuteScriptAsync("$('newBtn').click();$('newStyle').value='pixel';$('newStyle').dispatchEvent(new Event('change'));$('newPixelSize').value='8'");
        await DesignScreenshot("new-pixels.png");
        await core.ExecuteScriptAsync("$('newDialog').close();$('exportBtn').click();$('exportStyle').value='pixel';$('exportStyle').dispatchEvent(new Event('change'));$('exportPixelSize').value='6'");
        await DesignScreenshot("export-pixels.png");
        await core.ExecuteScriptAsync("$('exportDialog').close();$('toolColor').click()");
        await DesignScreenshot("colour-wheel.png");
        await core.ExecuteScriptAsync("$('colourDialog').close()");

        foreach (var size in new[] { new[] { 1024, 768 }, new[] { 390, 844 } })
        {
            string metrics = "{\"width\":" + size[0] + ",\"height\":" + size[1] + ",\"deviceScaleFactor\":1,\"mobile\":false}";
            await core.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride", metrics);
            await core.ExecuteScriptAsync("project=fresh();resizeBuffers();invalidate();updateUI();fit();setTool('pen');showPanel('draw');$('inspector').scrollTop=0;paintCanvas()");
            await DesignScreenshot("sketchbook-" + size[0] + ".png");
            string layout = await core.ExecuteScriptAsync("JSON.stringify({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,canvas:$('viewport').getBoundingClientRect().width,theme:document.documentElement.dataset.theme})");
            File.WriteAllText(Path.Combine(Program.TestRoot, "layout-" + size[0] + ".json"), layout);
            if (size[0] < 760)
            {
                await core.ExecuteScriptAsync("$('inspector').classList.add('open');$('inspector').scrollTop=0");
                await DesignScreenshot("sketchbook-mobile-controls.png");
                await core.ExecuteScriptAsync("$('toolColor').click()");
                await DesignScreenshot("colour-wheel-mobile.png");
                await core.ExecuteScriptAsync("$('colourDialog').close()");
                await core.ExecuteScriptAsync("$('inspector').classList.remove('open')");
            }
        }

        await core.CallDevToolsProtocolMethodAsync("Emulation.clearDeviceMetricsOverride", "{}");
        await core.ExecuteScriptAsync("project=validateProject(JSON.parse(window.designPrevious));resizeBuffers();invalidate();updateUI();fit();saveLocal()");
    }

    private async Task DesignScreenshot(string name)
    {
        await browser.CoreWebView2.ExecuteScriptAsync("clearTimeout(toastTimer);$('toast').classList.remove('show')");
        await Task.Delay(200);
        using (var file = File.Create(Path.Combine(Program.TestRoot, name)))
            await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, file);
    }
}
