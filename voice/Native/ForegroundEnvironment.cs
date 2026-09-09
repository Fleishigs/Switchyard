using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace SwitchyardVoice.Native;

public enum AppEnvironmentKind
{
    Terminal,
    Editor,
    Browser,
    Other
}

/// <summary>
/// Best-effort classification of the currently focused app so dictated text can
/// be formatted to suit it (most importantly: never inject newlines into a shell,
/// where Enter would execute the command).
/// </summary>
public static class ForegroundEnvironment
{
    public static AppEnvironmentKind Detect()
        => Detect(out _, out _);

    public static AppEnvironmentKind Detect(out string processName, out string className)
    {
        processName = "";
        className = "";

        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return AppEnvironmentKind.Other;

        var sb = new StringBuilder(256);
        if (GetClassName(hwnd, sb, sb.Capacity) > 0)
        {
            className = sb.ToString();
        }

        GetWindowThreadProcessId(hwnd, out uint pid);
        try
        {
            using var proc = Process.GetProcessById((int)pid);
            processName = proc.ProcessName;
        }
        catch
        {
            // Process may have exited or be inaccessible; fall back to class name.
        }

        var cls = className.ToLowerInvariant();
        // Windows Terminal, legacy conhost, mintty (Git Bash/Cygwin), VTE, PuTTY.
        if (cls.Contains("cascadia") ||
            cls == "consolewindowclass" ||
            cls.Contains("mintty") ||
            cls.Contains("putty") ||
            cls.Contains("vte"))
        {
            return AppEnvironmentKind.Terminal;
        }

        var name = processName.ToLowerInvariant();
        if (TerminalProcesses.Contains(name)) return AppEnvironmentKind.Terminal;
        if (BrowserProcesses.Contains(name)) return AppEnvironmentKind.Browser;
        if (EditorProcesses.Contains(name)) return AppEnvironmentKind.Editor;
        return AppEnvironmentKind.Other;
    }

    private static readonly HashSet<string> TerminalProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "windowsterminal", "wt", "openconsole", "conhost", "cmd", "powershell", "pwsh",
        "alacritty", "wezterm", "wezterm-gui", "mintty", "putty", "kitty",
        "conemu", "conemu64", "hyper", "tabby", "cmder", "bash", "sh", "zsh",
        "nu", "fish", "wsl", "wslhost", "rxvt", "xterm",
    };

    private static readonly HashSet<string> BrowserProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "firefox", "brave", "opera", "vivaldi", "arc", "iexplore",
    };

    private static readonly HashSet<string> EditorProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "devenv", "rider64", "idea64", "pycharm64", "webstorm64", "clion64", "goland64",
        "sublime_text", "notepad++", "atom",
        // NOTE: "code"/VS Code is intentionally omitted: its integrated terminal shares
        // the same process, so we cannot tell editor vs terminal focus reliably.
    };

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
}
