// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
using System;
using System.IO;
using System.Reflection;

internal static class DesktopScripts
{
    internal static string Read(string name)
    {
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Studio.Scripts." + name))
        {
            if (stream == null)
                throw new InvalidOperationException("Missing desktop script: " + name);
            using (var reader = new StreamReader(stream))
                return reader.ReadToEnd();
        }
    }
}
