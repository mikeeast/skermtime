namespace Skermtime.Agent;

/// <summary>
/// Persists the device token under %LOCALAPPDATA%\Skermtime.
/// NOTE: plaintext for now — harden with DPAPI (ProtectedData) before launch.
/// </summary>
public static class TokenStore
{
    private static string Dir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Skermtime");

    private static string TokenPath => Path.Combine(Dir, "device-token.txt");

    public static string? Read()
    {
        try
        {
            return File.Exists(TokenPath) ? File.ReadAllText(TokenPath).Trim() : null;
        }
        catch
        {
            return null;
        }
    }

    public static void Save(string token)
    {
        Directory.CreateDirectory(Dir);
        File.WriteAllText(TokenPath, token);
    }
}
