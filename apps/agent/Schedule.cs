namespace Skermtime.Agent;

/// <summary>
/// Offline mirror of the server's lib/agent/policy.ts. Windows are minutes-from-local-midnight
/// + ISO weekdays (1=Mon..7=Sun); a window wraps past midnight when EndMin &lt;= StartMin.
/// </summary>
public static class Schedule
{
    public static bool InWindow(IReadOnlyList<ApiClient.ScheduleWindow> windows, int dow, int minute)
    {
        foreach (var w in windows)
        {
            bool wraps = w.EndMin <= w.StartMin;
            if (wraps)
            {
                int prev = dow == 1 ? 7 : dow - 1;
                if ((Array.IndexOf(w.Days, dow) >= 0 && minute >= w.StartMin) ||
                    (Array.IndexOf(w.Days, prev) >= 0 && minute < w.EndMin))
                    return true;
            }
            else if (Array.IndexOf(w.Days, dow) >= 0 && minute >= w.StartMin && minute < w.EndMin)
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>Advance a (weekday, minute-of-day) pair by elapsed minutes, rolling days over.</summary>
    public static (int Dow, int Minute) Advance(int dow, int minute, int elapsedMinutes)
    {
        int total = minute + Math.Max(0, elapsedMinutes);
        int dayShift = total / (24 * 60);
        int newMinute = total % (24 * 60);
        int newDow = ((dow - 1 + dayShift) % 7) + 1;
        return (newDow, newMinute);
    }
}
