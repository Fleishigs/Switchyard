namespace SwitchyardVoice.Native;

/// <summary>
/// Helpers for the push-to-talk key combination: normalizing left/right
/// modifier variants to a canonical key, and formatting keys for display.
/// </summary>
public static class KeyChord
{
    public const int VkControl = 0x11;
    public const int VkShift = 0x10;
    public const int VkMenu = 0x12;   // Alt
    public const int VkLWin = 0x5B;
    public const int VkRWin = 0x5C;

    public static readonly IReadOnlyList<int> Default = new[] { VkControl, VkLWin };

    /// <summary>Collapse left/right modifier variants so either side matches.</summary>
    public static int Normalize(int vk) => vk switch
    {
        0xA2 or 0xA3 => VkControl,  // L/R Ctrl
        0xA0 or 0xA1 => VkShift,    // L/R Shift
        0xA4 or 0xA5 => VkMenu,     // L/R Alt
        VkRWin => VkLWin,           // either Win
        _ => vk,
    };

    public static bool ContainsWin(IEnumerable<int> keys)
        => keys.Any(k => Normalize(k) == VkLWin);

    /// <summary>
    /// True if the chord contains at least one of Ctrl / Alt / Shift / Win.
    ///
    /// A chord without one is unusable: the monitor suppresses the chord keys while they
    /// are held, so binding push-to-talk to a bare letter makes that letter stop working
    /// system-wide - including in the very settings box needed to change it back.
    /// </summary>
    public static bool HasModifier(IEnumerable<int> keys)
        => keys.Select(Normalize).Any(k => k is VkControl or VkShift or VkMenu or VkLWin);

    public static string Format(IEnumerable<int> keys)
    {
        var order = new[] { VkControl, VkMenu, VkShift, VkLWin };
        var normalized = keys.Select(Normalize).Distinct().ToList();
        normalized.Sort((a, b) => Rank(a, order).CompareTo(Rank(b, order)));
        return normalized.Count == 0 ? "(none)" : string.Join(" + ", normalized.Select(Name));
    }

    private static int Rank(int vk, int[] order)
    {
        var i = Array.IndexOf(order, vk);
        return i < 0 ? 100 : i;
    }

    public static string Name(int vk) => vk switch
    {
        VkControl => "Ctrl",
        VkShift => "Shift",
        VkMenu => "Alt",
        VkLWin or VkRWin => "Win",
        0x20 => "Space",
        0x1B => "Esc",
        0x0D => "Enter",
        0x09 => "Tab",
        0x08 => "Backspace",
        0x14 => "Caps Lock",
        0x2D => "Insert",
        0x2E => "Delete",
        0x21 => "Page Up",
        0x22 => "Page Down",
        0x24 => "Home",
        0x23 => "End",
        >= 0x70 and <= 0x87 => "F" + (vk - 0x6F),       // F1..F24
        >= 0x30 and <= 0x39 => ((char)vk).ToString(),    // 0-9
        >= 0x41 and <= 0x5A => ((char)vk).ToString(),    // A-Z
        _ => $"Key 0x{vk:X2}",
    };
}
