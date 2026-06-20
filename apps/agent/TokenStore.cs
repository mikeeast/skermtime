using System.Security.Cryptography;
using System.Text;

namespace Skermtime.Agent;

/// <summary>
/// Persists the device token under C:\ProgramData\Skermtime, encrypted with DPAPI
/// (CurrentUser scope = the LocalSystem service account, so only the service can
/// read it even though the file is machine-readable). Migrates the old plaintext
/// %LOCALAPPDATA% token on first run.
/// </summary>
public static class TokenStore
{
    private static string TokenPath => Path.Combine(IpcState.Dir, "device-token.dat");

    private static string LegacyPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Skermtime",
        "device-token.txt");

    public static string? Read()
    {
        try
        {
            if (File.Exists(TokenPath))
            {
                var blob = File.ReadAllBytes(TokenPath);
                var clear = ProtectedData.Unprotect(blob, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(clear).Trim();
            }
            // One-time migration of the old plaintext token.
            if (File.Exists(LegacyPath))
            {
                var token = File.ReadAllText(LegacyPath).Trim();
                if (!string.IsNullOrWhiteSpace(token))
                {
                    Save(token);
                    try { File.Delete(LegacyPath); } catch { /* best-effort */ }
                    return token;
                }
            }
            return null;
        }
        catch
        {
            return null;
        }
    }

    public static void Save(string token)
    {
        Directory.CreateDirectory(IpcState.Dir);
        var blob = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(TokenPath, blob);
    }
}
