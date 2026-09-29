// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Inspiration: WigglyPaint and Decker by John Earnest (Internet Janitor).
// Created by Cameron Jago Lis Illustrates. Independent release.
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

[assembly: AssemblyTitle("Jago Wobble Studio")]
[assembly: AssemblyDescription("Animated drawing and illustration for Windows")]
[assembly: AssemblyProduct("Jago Wobble Studio")]
[assembly: AssemblyCompany("Cameron Jago Lis Illustrates")]
[assembly: AssemblyCopyright("Copyright (c) 2026 Cameron Jago Lis Illustrates.")]
[assembly: AssemblyVersion("1.2.0.0")]
[assembly: AssemblyFileVersion("1.2.0.0")]
internal static class Program
{
    internal static string AppRoot, RuntimeRoot, TestRoot;
    internal static bool IsTest;
    internal static int Result;
    private static Mutex instance;
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string c, string title);
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr h, int n);
    [STAThread]
    private static int Main(string[] args)
    {
        IsTest = args.Length == 2 && args[0] == "--self-test";
        if (IsTest)
            TestRoot = Path.GetFullPath(args[1]);
        AppRoot = IsTest ? TestRoot : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Jago Loop Studio");
        try
        {
            if (!IsTest)
            {
                bool first;
                instance = new Mutex(true, @"Local\JagoLoopStudio." + Environment.UserName, out first);
                if (!first)
                {
                    IntPtr h = FindWindow(null, "Jago Wobble Studio");
                    if (h == IntPtr.Zero)
                        h = FindWindow(null, "Jago Loop Studio");
                    if (h != IntPtr.Zero)
                    {
                        ShowWindow(h, 9);
                        SetForegroundWindow(h);
                    }
                    else
                        MessageBox.Show("The studio is already open or opening. Save your work and close the earlier version before opening this one.", "Jago Wobble Studio");
                    return 0;
                }
            }

            Directory.CreateDirectory(AppRoot);
            // Versioned extraction keeps updates independent of older loaded DLLs.
            using (var own = File.OpenRead(Assembly.GetExecutingAssembly().Location))
            using (var sha = SHA256.Create())
                RuntimeRoot = Path.Combine(AppRoot, "Application", BitConverter.ToString(sha.ComputeHash(own)).Replace("-", "").Substring(0, 16));
            Directory.CreateDirectory(RuntimeRoot);
            foreach (var file in new[]
            {
                "Microsoft.Web.WebView2.Core.dll",
                "Microsoft.Web.WebView2.WinForms.dll",
                "WebView2Loader.dll",
                "index.html",
                "WebView2-LICENSE.txt",
                "WebView2-NOTICE.txt"
            }

            )
                Extract(file);
            AppDomain.CurrentDomain.AssemblyResolve += ResolveAssembly;
            Run();
        }
        catch (Exception ex)
        {
            Result = 1;
            if (IsTest)
                File.WriteAllText(Path.Combine(TestRoot, "result.txt"), "FAIL: " + ex);
            else
                MessageBox.Show("The studio could not start.\n\n" + ex.Message, "Jago Wobble Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            if (instance != null)
                instance.Dispose();
        }

        return Result;
    }

    private static void Extract(string name)
    {
        var target = Path.Combine(RuntimeRoot, name);
        using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("Studio." + name))
        {
            if (source == null)
                throw new InvalidOperationException("Missing packaged component: " + name);
            // Also checks content, rather than trusting an existing same-length file.
            byte[] data;
            using (var memory = new MemoryStream())
            {
                source.CopyTo(memory);
                data = memory.ToArray();
            }

            if (File.Exists(target) && File.ReadAllBytes(target).SequenceEqual(data))
                return;
            File.WriteAllBytes(target, data);
        }
    }

    private static Assembly ResolveAssembly(object sender, ResolveEventArgs args)
    {
        string name = new AssemblyName(args.Name).Name;
        if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms")
            return null;
        return Assembly.LoadFrom(Path.Combine(RuntimeRoot, name + ".dll"));
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Run()
    {
        CoreWebView2Environment.SetLoaderDllFolderPath(RuntimeRoot);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new StudioWindow());
    }
}
