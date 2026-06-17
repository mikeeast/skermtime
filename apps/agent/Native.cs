using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace Skermtime.Agent;

[SupportedOSPlatform("windows")]
internal static class Native
{
    [DllImport("user32.dll")]
    private static extern bool LockWorkStation();

    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    public static void Lock()
    {
        try { LockWorkStation(); }
        catch { /* best effort — never crash the agent on a lock failure */ }
    }

    /// <summary>Milliseconds since the last mouse/keyboard input.</summary>
    public static long IdleMilliseconds()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref info)) return 0;
        unchecked
        {
            // GetLastInputInfo uses the 32-bit tick count; match it for wrap-safety.
            uint now = (uint)Environment.TickCount;
            return now - info.dwTime;
        }
    }
}
