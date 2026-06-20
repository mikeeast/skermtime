using System.Diagnostics;
using System.Text.Json;

namespace Skermtime.Agent;

// State the service publishes for the user-session overlay (state.json), and the
// foreground report the overlay publishes back (report.json). Exchanged via files
// in C:\ProgramData\Skermtime because the LocalSystem service and the child's
// session don't share %LOCALAPPDATA%.
public record MessageDto(string Id, string Body);
public record AgentState(
    int BalanceMinutes,
    bool LockNow,
    string? Reason,
    int? MinutesUntilWindow,
    MessageDto[] Messages,
    string UpdatedAt);
public record ForegroundReport(string? App, string? Title, string? At);

public static class IpcState
{
    public static string Dir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "Skermtime");

    private static string StatePath => Path.Combine(Dir, "state.json");
    private static string ReportPath => Path.Combine(Dir, "report.json");

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Create the shared dir and let the logged-in user write report.json into it.</summary>
    public static void EnsureDir()
    {
        try
        {
            Directory.CreateDirectory(Dir);
            // Grant Authenticated Users (S-1-5-11) Modify, inheriting to files. icacls
            // ships with Windows and avoids pulling in ACL assemblies in the Worker SDK.
            var psi = new ProcessStartInfo("icacls", $"\"{Dir}\" /grant *S-1-5-11:(OI)(CI)M /T")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            Process.Start(psi)?.WaitForExit(5000);
        }
        catch
        {
            /* best-effort — the overlay degrades to read-only if this fails */
        }
    }

    public static void WriteState(AgentState state)
    {
        try
        {
            File.WriteAllText(StatePath, JsonSerializer.Serialize(state, Json));
        }
        catch
        {
            /* overlay just keeps the last value */
        }
    }

    public static ForegroundReport? ReadReport()
    {
        try
        {
            if (!File.Exists(ReportPath)) return null;
            return JsonSerializer.Deserialize<ForegroundReport>(File.ReadAllText(ReportPath), Json);
        }
        catch
        {
            return null;
        }
    }
}
