<#
.SYNOPSIS
Shows the Windows Common Item Dialog in folder-selection mode, with Explorer's editable address bar.
.DESCRIPTION
RETROTV_PICKER_START is passed as data, never as PowerShell/C# source. Standard output contains only the result JSON.
#>
[CmdletBinding()]
param([switch]$CompileOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

# Interface order and identifiers follow Microsoft's WinSDK ShObjIdl_core.h.
# https://learn.microsoft.com/windows/win32/api/shobjidl_core/nn-shobjidl_core-ifiledialog
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static class RetroTVFolderPicker
{
    [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileDialog
    {
        [PreserveSig] int Show(IntPtr owner);
        void SetFileTypes(uint count, IntPtr filters);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint options);
        void GetOptions(out uint options);
        void SetDefaultFolder(IShellItem folder);
        void SetFolder(IShellItem folder);
        void GetFolder(out IShellItem folder);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName(out IntPtr name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetResult(out IShellItem result);
        void AddPlace(IShellItem item, uint placement);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int result);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
    }
    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem
    {
        void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(uint type, out IntPtr name);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem item, uint hint, out int order);
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void SHCreateItemFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr context, ref Guid iid,
        [MarshalAs(UnmanagedType.Interface)] out IShellItem item);

    private const uint FOS_NOCHANGEDIR = 0x8;
    private const uint FOS_PICKFOLDERS = 0x20;
    private const uint FOS_FORCEFILESYSTEM = 0x40;
    private const uint FOS_PATHMUSTEXIST = 0x800;
    private const uint FOS_DONTADDTORECENT = 0x2000000;
    private const uint SIGDN_FILESYSPATH = 0x80058000;
    private const int CANCELLED = unchecked((int)0x800704C7);

    public static string Pick(string initialPath)
    {
        if (Thread.CurrentThread.GetApartmentState() != ApartmentState.STA)
            throw new InvalidOperationException("Folder selection requires an STA thread.");
        IFileDialog dialog = null;
        IShellItem initial = null, result = null;
        IntPtr name = IntPtr.Zero;
        try
        {
            dialog = (IFileDialog)Activator.CreateInstance(Type.GetTypeFromCLSID(
                new Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")));
            uint options;
            dialog.GetOptions(out options);
            dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM |
                FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR | FOS_DONTADDTORECENT);
            dialog.SetTitle("Retro TV - Select a folder");
            dialog.SetOkButtonLabel("Select folder");
            // A new project path may not exist yet; start at its nearest existing parent.
            if (!String.IsNullOrEmpty(initialPath) && Path.IsPathRooted(initialPath))
            {
                string folder = initialPath;
                while (!String.IsNullOrEmpty(folder) && !Directory.Exists(folder))
                    folder = Path.GetDirectoryName(folder);
                if (!String.IsNullOrEmpty(folder))
                {
                    Guid iid = typeof(IShellItem).GUID;
                    SHCreateItemFromParsingName(folder, IntPtr.Zero, ref iid, out initial);
                    dialog.SetFolder(initial);
                }
            }
            int status = dialog.Show(IntPtr.Zero);
            if (status == CANCELLED) return null;
            if (status != 0) Marshal.ThrowExceptionForHR(status);
            dialog.GetResult(out result);
            result.GetDisplayName(SIGDN_FILESYSPATH, out name);
            string selected = Marshal.PtrToStringUni(name);
            if (String.IsNullOrEmpty(selected) || !Directory.Exists(selected))
                throw new IOException("The selected folder is no longer available.");
            return selected;
        }
        finally
        {
            if (name != IntPtr.Zero) Marshal.FreeCoTaskMem(name);
            if (result != null) Marshal.ReleaseComObject(result);
            if (initial != null) Marshal.ReleaseComObject(initial);
            if (dialog != null) Marshal.ReleaseComObject(dialog);
        }
    }
}
'@
if ($CompileOnly) { return }
$selected = [RetroTVFolderPicker]::Pick($env:RETROTV_PICKER_START)
if ($null -eq $selected) {
    @{ path = ''; cancelled = $true } | ConvertTo-Json -Compress
} else {
    @{ path = $selected; cancelled = $false } | ConvertTo-Json -Compress
}
