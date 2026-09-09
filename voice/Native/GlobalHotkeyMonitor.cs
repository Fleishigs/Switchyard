using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace SwitchyardVoice.Native;

/// <summary>
/// Low-level (WH_KEYBOARD_LL) push-to-talk chord detector.
///
/// Two rules govern everything in here:
///
/// 1. The hook callback must return almost immediately. Windows silently removes a
///    low-level keyboard hook whose callback exceeds LowLevelHooksTimeout (300 ms by
///    default) and gives no notification at all - the hotkey simply stops working for
///    the rest of the process lifetime. So the callback only updates a couple of
///    fields and *posts* HoldStarted/HoldEnded to the owning thread; it never runs
///    subscriber code inline.
///
/// 2. Even a well-behaved hook can still be dropped (a slow hook elsewhere in the
///    system, session switch, UAC elevation). There is no API to ask "is my hook still
///    alive", so the hook is cheaply reinstalled on a timer, which bounds any outage to
///    <see cref="SelfHealIntervalMs"/> instead of "until the user restarts the app".
/// </summary>
public sealed class GlobalHotkeyMonitor : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmKeyUp = 0x0101;
    private const int WmSysKeyDown = 0x0104;
    private const int WmSysKeyUp = 0x0105;
    private const int LlkhfInjected = 0x10;

    private const int VkEscape = 0x1B;
    private const byte VkMask = 0xE8;        // undefined key used to swallow the Win Start-menu
    private const uint KeyeventfKeyup = 0x0002;

    private const int SelfHealIntervalMs = 20_000;

    private readonly HookProc _hookProc;
    private readonly object _hookSync = new();

    // The thread that installed the hook. A low-level hook callback is delivered on the
    // installing thread's message queue, so this is also the thread the callback runs on,
    // and the thread every state field below is touched from.
    private readonly SynchronizationContext? _ownerContext;
    private readonly int _ownerThreadId;

    private readonly System.Threading.Timer _selfHealTimer;

    private IntPtr _hookHandle;
    private bool _disposed;

    // True while deliberately unhooked for input injection, so the self-heal timer does
    // not resurrect the hook underneath the paste.
    private bool _suspended;

    // Push-to-talk chord (normalized virtual key codes that must all be held).
    private HashSet<int> _chord = new(KeyChord.Default);
    private bool _chordHasWin = KeyChord.ContainsWin(KeyChord.Default);
    private readonly HashSet<int> _downChordKeys = new();
    private bool _comboActive;

    // Capture mode: record the keys the user presses to set a new chord.
    private bool _capturing;
    private readonly HashSet<int> _captureSeen = new();
    private readonly HashSet<int> _captureDown = new();
    private Action<IReadOnlyList<int>?>? _captureCallback;

    public event EventHandler? HoldStarted;
    public event EventHandler? HoldEnded;

    /// <summary>Raised (on the owning thread) if the hook could not be reinstalled.</summary>
    public event EventHandler<string>? HookFailed;

    public GlobalHotkeyMonitor()
    {
        _hookProc = HookCallback;
        _ownerContext = SynchronizationContext.Current;
        _ownerThreadId = Environment.CurrentManagedThreadId;
        _hookHandle = InstallHook(_hookProc);

        _selfHealTimer = new System.Threading.Timer(
            _ => PostToOwner(SelfHeal),
            null,
            SelfHealIntervalMs,
            SelfHealIntervalMs);
    }

    public IReadOnlyList<int> CurrentChord => _chord.ToList();

    /// <summary>True when the hook is currently installed and listening.</summary>
    public bool IsHookAlive
    {
        get
        {
            lock (_hookSync)
            {
                return !_disposed && _hookHandle != IntPtr.Zero;
            }
        }
    }

    public void SetChord(IEnumerable<int> keys)
    {
        var normalized = keys.Select(KeyChord.Normalize).ToHashSet();
        if (normalized.Count == 0)
        {
            normalized = new HashSet<int>(KeyChord.Default);
        }

        _chord = normalized;
        _chordHasWin = normalized.Contains(KeyChord.VkLWin);
        _downChordKeys.Clear();
        _comboActive = false;
    }

    /// <summary>
    /// Enter capture mode. While capturing, every key is swallowed and the keys
    /// the user presses are recorded; the callback fires (on the owning thread) with
    /// the captured set once all keys are released, or null if cancelled (Esc).
    /// </summary>
    public void BeginCapture(Action<IReadOnlyList<int>?> callback)
    {
        _captureSeen.Clear();
        _captureDown.Clear();
        _captureCallback = callback;
        _capturing = true;
    }

    public void CancelCapture() => FinishCapture(null);

    public void Dispose()
    {
        _selfHealTimer.Dispose();

        lock (_hookSync)
        {
            if (_disposed) return;
            _disposed = true;

            if (_hookHandle != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookHandle);
                _hookHandle = IntPtr.Zero;
            }
        }
    }

    /// <summary>
    /// Temporarily removes the keyboard hook (used while injecting synthesized
    /// keystrokes so they are not serialized back through this hook, where they can
    /// be dropped or duplicated).
    /// </summary>
    public void Suspend()
    {
        lock (_hookSync)
        {
            if (_disposed) return;
            _suspended = true;

            if (_hookHandle != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookHandle);
                _hookHandle = IntPtr.Zero;
            }
        }

        _downChordKeys.Clear();
        _comboActive = false;
    }

    public void Resume()
    {
        lock (_hookSync)
        {
            if (_disposed) return;
            _suspended = false;
            if (_hookHandle != IntPtr.Zero) return;

            try
            {
                _hookHandle = InstallHook(_hookProc);
            }
            catch (Exception ex)
            {
                _hookHandle = IntPtr.Zero;
                RaiseHookFailed(ex.Message);
            }
        }
    }

    /// <summary>
    /// Reinstalls the hook if it is missing. Windows drops low-level hooks silently, so
    /// this runs periodically; it is a no-op in the normal case. Skipped mid-chord and
    /// mid-capture so an in-flight interaction is never torn in half.
    /// </summary>
    private void SelfHeal()
    {
        if (_capturing) return;

        // Break a combo that is "active" only because a key-up went missing. Without
        // this, a stuck combo would also permanently skip the reinstall below, and the
        // chord keys would stay suppressed system-wide.
        if (_comboActive && !_chord.All(IsPhysicallyDown))
        {
            _comboActive = false;
            _downChordKeys.Clear();
            PostToOwner(() => HoldEnded?.Invoke(this, EventArgs.Empty));
        }

        if (_comboActive) return;

        lock (_hookSync)
        {
            if (_disposed || _suspended) return;

            // Cheap: drop and reinstall. SetWindowsHookEx costs microseconds, and this is
            // the only reliable way to recover a hook Windows removed without telling us.
            if (_hookHandle != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookHandle);
                _hookHandle = IntPtr.Zero;
            }

            try
            {
                _hookHandle = InstallHook(_hookProc);
            }
            catch (Exception ex)
            {
                _hookHandle = IntPtr.Zero;
                RaiseHookFailed(ex.Message);
                return;
            }
        }

        _downChordKeys.Clear();
        _comboActive = false;
    }

    private static IntPtr InstallHook(HookProc hookProc)
    {
        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule;
        var moduleName = module?.ModuleName
                         ?? throw new InvalidOperationException("Unable to resolve process module.");
        var moduleHandle = GetModuleHandle(moduleName);

        var hook = SetWindowsHookEx(WhKeyboardLl, hookProc, moduleHandle, 0);
        if (hook == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Failed to install keyboard hook.");
        }

        return hook;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        var shouldSuppress = false;

        try
        {
            if (nCode >= 0)
            {
                var message = wParam.ToInt32();
                var isDown = message is WmKeyDown or WmSysKeyDown;
                var isUp = message is WmKeyUp or WmSysKeyUp;

                if (isDown || isUp)
                {
                    var hookData = Marshal.PtrToStructure<KbdLlHookStruct>(lParam);
                    if ((hookData.Flags & LlkhfInjected) == 0)
                    {
                        shouldSuppress = _capturing
                            ? HandleCapture(hookData.VkCode, isDown, isUp)
                            : HandleChord(hookData.VkCode, isDown, isUp);
                    }
                }
            }
        }
        catch
        {
            // Never throw from a low-level hook callback.
        }

        if (shouldSuppress)
        {
            return (IntPtr)1;
        }

        return CallNextHookEx(_hookHandle, nCode, wParam, lParam);
    }

    private bool HandleChord(int rawVk, bool isDown, bool isUp)
    {
        var vk = KeyChord.Normalize(rawVk);
        var isChordKey = _chord.Contains(vk);

        // Reconcile our bookkeeping against the real hardware state on every key event.
        //
        // Windows can and does swallow a key-up: focus changes, UAC elevation, RDP
        // sessions, lock screen, and our own Suspend() during paste injection all drop
        // events. The previous code trusted its own tally forever, so a single missed
        // key-up left _comboActive stuck true - and because the suppression rule is
        // "block chord keys while engaged", that meant Ctrl and Win stopped working
        // *system-wide* until the app was restarted. Reconciling here means any
        // subsequent keystroke heals it.
        foreach (var key in _chord)
        {
            // The key this event is about is authoritative from the event itself:
            // GetAsyncKeyState has not necessarily observed it yet, since a low-level
            // hook runs before the keystroke is dispatched.
            if (isChordKey && key == vk) continue;

            if (IsPhysicallyDown(key)) _downChordKeys.Add(key);
            else _downChordKeys.Remove(key);
        }

        if (isChordKey)
        {
            if (isDown) _downChordKeys.Add(vk);
            if (isUp) _downChordKeys.Remove(vk);
        }

        var allDown = _chord.Count > 0 && _downChordKeys.Count == _chord.Count;

        if (allDown && !_comboActive)
        {
            _comboActive = true;

            // Swallow the Windows Start menu that would otherwise pop when the
            // combo is released, by injecting an inert key while Win is held.
            // Must happen before any synthesized modifier release below, or a Win
            // key-up would itself open the Start menu.
            if (_chordHasWin) InjectMask();

            // The chord's first key-down was passed through before the combo completed,
            // so the focused app currently believes that modifier is held. Tell it
            // otherwise, or it stays "stuck" for the whole dictation and mangles the
            // subsequent paste.
            ReleaseLeakedChordModifiers();

            // Posted, never invoked inline: subscribers open the microphone and paint the
            // overlay, which takes far longer than the hook's 300 ms budget allows.
            PostToOwner(() => HoldStarted?.Invoke(this, EventArgs.Empty));
        }
        else if (!allDown && _comboActive)
        {
            _comboActive = false;
            PostToOwner(() => HoldEnded?.Invoke(this, EventArgs.Empty));

            // Suppress this final key-up too. The matching key-down was suppressed, so
            // letting the up through hands the focused app an unpaired key-up, which some
            // apps latch as "modifier still held".
            return isChordKey;
        }

        // Block the chord keys while engaged so they don't leak to the focused app.
        // Keys outside the chord always pass through - the user may legitimately be
        // typing while dictating, and swallowing everything would be worse.
        return isChordKey && _comboActive;
    }

    /// <summary>
    /// True if the (normalized) key is physically held right now, checking both the left
    /// and right variants of the modifier keys.
    /// </summary>
    private static bool IsPhysicallyDown(int normalizedVk)
    {
        return normalizedVk switch
        {
            KeyChord.VkControl => Down(0xA2) || Down(0xA3) || Down(KeyChord.VkControl),
            KeyChord.VkShift => Down(0xA0) || Down(0xA1) || Down(KeyChord.VkShift),
            KeyChord.VkMenu => Down(0xA4) || Down(0xA5) || Down(KeyChord.VkMenu),
            KeyChord.VkLWin => Down(KeyChord.VkLWin) || Down(KeyChord.VkRWin),
            _ => Down(normalizedVk),
        };

        static bool Down(int vk) => (GetAsyncKeyState(vk) & 0x8000) != 0;
    }

    /// <summary>
    /// Synthesizes key-up for the Ctrl/Shift/Alt keys in the chord, whose first key-down
    /// reached the focused app before the combo completed. Injected events carry
    /// LLKHF_INJECTED, so our own hook ignores them.
    ///
    /// Win is deliberately excluded: a synthesized Win key-up is exactly what pops the
    /// Start menu, and it is already handled by the inert-key mask above.
    /// </summary>
    private void ReleaseLeakedChordModifiers()
    {
        foreach (var key in _chord)
        {
            switch (key)
            {
                case KeyChord.VkControl:
                case KeyChord.VkShift:
                case KeyChord.VkMenu:
                    keybd_event((byte)key, 0, KeyeventfKeyup, UIntPtr.Zero);
                    break;
            }
        }
    }

    private bool HandleCapture(int rawVk, bool isDown, bool isUp)
    {
        if (rawVk == VkEscape)
        {
            if (isDown) FinishCapture(null);
            return true;
        }

        var vk = KeyChord.Normalize(rawVk);
        if (isDown)
        {
            _captureSeen.Add(vk);
            _captureDown.Add(vk);
        }
        if (isUp)
        {
            _captureDown.Remove(vk);
            if (_captureDown.Count == 0 && _captureSeen.Count > 0)
            {
                FinishCapture(_captureSeen.ToList());
            }
        }

        // Swallow everything while capturing so keys don't reach other apps.
        return true;
    }

    private void FinishCapture(IReadOnlyList<int>? result)
    {
        if (!_capturing) return;

        var callback = _captureCallback;
        _capturing = false;
        _captureCallback = null;
        _captureSeen.Clear();
        _captureDown.Clear();

        if (callback is null) return;
        PostToOwner(() => callback(result));
    }

    /// <summary>
    /// Queues work onto the thread that owns the hook. Used so nothing substantial ever
    /// runs inside the hook callback itself.
    /// </summary>
    private void PostToOwner(Action action)
    {
        if (_ownerContext is not null)
        {
            _ownerContext.Post(_ => action(), null);
            return;
        }

        if (Environment.CurrentManagedThreadId == _ownerThreadId)
        {
            action();
            return;
        }

        ThreadPool.QueueUserWorkItem(_ => action());
    }

    private void RaiseHookFailed(string message)
        => PostToOwner(() => HookFailed?.Invoke(this, message));

    private static void InjectMask()
    {
        keybd_event(VkMask, 0, 0, UIntPtr.Zero);
        keybd_event(VkMask, 0, KeyeventfKeyup, UIntPtr.Zero);
    }

    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct KbdLlHookStruct
    {
        public int VkCode;
        public int ScanCode;
        public int Flags;
        public int Time;
        public IntPtr DwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);
}
