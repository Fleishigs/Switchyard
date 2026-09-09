using System.ComponentModel;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace SwitchyardVoice.Native;

public static class InputTextPaster
{
    private const int InputKeyboard = 1;
    private const uint KeyeventfUnicode = 0x0004;
    private const uint KeyeventfKeyup = 0x0002;
    private const ushort VkControl = 0x11;
    private const ushort VkV = 0x56;
    private const ushort VkReturn = 0x0D;
    private const ushort VkShift = 0x10;
    private const ushort VkMenu = 0x12;   // Alt
    private const ushort VkLWin = 0x5B;
    private const ushort VkRWin = 0x5C;

    /// <summary>
    /// How long the dictated text stays on the clipboard after Ctrl+V before the previous
    /// contents are put back. This must outlast the target app actually reading the
    /// clipboard, which is not instant: Electron apps, browsers, remote desktop and RDP
    /// clients routinely take well over 100 ms. The old 55 ms lost the paste often enough
    /// to look like the app "randomly does nothing".
    /// </summary>
    private const int ClipboardRestoreDelayMs = 260;

    /// <summary>
    /// Upper bound on how long we wait for the target app to read the clipboard before
    /// restoring anyway. Only reached when the read is never observed.
    /// </summary>
    private const int ClipboardReadMaxWaitMs = 1500;

    /// <summary>How often to sample GetOpenClipboardWindow while waiting for the read.</summary>
    private const int ClipboardReadPollMs = 10;

    /// <summary>
    /// Grace period after the target closes the clipboard. Apps commonly reopen it a
    /// second time for another format (CF_UNICODETEXT, then CF_HTML), and restoring
    /// between the two reads is exactly the bug this wait exists to prevent.
    /// </summary>
    private const int ClipboardReadSettleMs = 120;

    public static void PasteText(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return;
        }

        // Tailor formatting to the focused app before injecting anything.
        var environment = ForegroundEnvironment.Detect();
        text = NormalizeForEnvironment(text, environment);
        if (string.IsNullOrEmpty(text))
        {
            return;
        }

        // Clear any modifier the push-to-talk combo may have left down so the
        // synthesized Ctrl+V isn't polluted (e.g. by a still-down Win key).
        ReleaseModifiers();

        ClipboardSnapshot? snapshot = null;
        uint sequenceAfterSet = 0;
        var clipboardSet = false;
        var ctrlVSent = false;

        try
        {
            snapshot = CaptureClipboardSnapshot();

            RetryClipboard(() =>
            {
                Clipboard.SetText(text, TextDataFormat.UnicodeText);
                return true;
            });
            clipboardSet = true;
            sequenceAfterSet = GetClipboardSequenceNumber();

            SendCtrlV();
            ctrlVSent = true;
            WaitForTargetToReadClipboard();

            TryRestoreClipboard(snapshot, sequenceAfterSet);
        }
        catch (Exception)
        {
            // Best-effort restore on failures if we already touched clipboard.
            if (clipboardSet && snapshot is not null)
            {
                TryRestoreClipboard(snapshot, sequenceAfterSet, force: true);
            }

            // Only retype if the keystroke never went out. Falling back
            // unconditionally meant a failure *after* a successful Ctrl+V (a clipboard
            // restore error, say) typed the whole transcription a second time, so the
            // user got it twice.
            if (!ctrlVSent)
            {
                TypeUnicode(text, environment);
            }
        }
    }

    /// <summary>
    /// Waits until the app receiving Ctrl+V has actually read the clipboard, then a short
    /// settle, then returns.
    ///
    /// A fixed sleep cannot work here. Electron apps, browsers and RDP clients read the
    /// clipboard lazily - often well after 260 ms - and whatever we restore before that
    /// read is what they paste. The symptom is the user's *previous* clipboard contents
    /// landing in the target app instead of (or after) the dictated text.
    ///
    /// GetOpenClipboardWindow reports the window currently holding the clipboard open, so
    /// a foreign window appearing and then going away is the read completing. Observing it
    /// lets us restore promptly for fast apps while still giving slow ones room.
    ///
    /// The detection is deliberately only an optimisation, because it has a known blind
    /// spot: GetOpenClipboardWindow reports NULL for a reader that called OpenClipboard
    /// with a null handle, and a read can also finish inside a single poll interval.
    /// Missing it costs nothing but time - we then wait out the ceiling, which is slower
    /// to restore but never restores early. The ceiling, not the detection, is what makes
    /// this correct.
    /// </summary>
    private static void WaitForTargetToReadClipboard()
    {
        var start = Environment.TickCount64;
        var sawForeignReader = false;

        while (Environment.TickCount64 - start < ClipboardReadMaxWaitMs)
        {
            IntPtr holder;
            try
            {
                holder = GetOpenClipboardWindow();
            }
            catch
            {
                // Never let a diagnostic call break pasting; fall back to the old sleep.
                Thread.Sleep(ClipboardRestoreDelayMs);
                return;
            }

            if (holder != IntPtr.Zero)
            {
                sawForeignReader = true;
            }
            else if (sawForeignReader)
            {
                Thread.Sleep(ClipboardReadSettleMs);
                return;
            }

            Thread.Sleep(ClipboardReadPollMs);
        }
    }

    private static void ReleaseModifiers()
    {
        try
        {
            var keys = new ushort[] { VkControl, VkShift, VkMenu, VkLWin, VkRWin };
            var inputs = new Input[keys.Length];
            for (var i = 0; i < keys.Length; i++)
            {
                inputs[i] = CreateVirtualKeyInput(keys[i], keyUp: true);
            }

            SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<Input>());
        }
        catch
        {
            // Best effort; never block the paste on this.
        }
    }

    /// <summary>
    /// Adjusts dictated text for the target app. Crucially, a trailing newline is
    /// always stripped so we never accidentally "submit", and in a terminal every
    /// newline is collapsed to a space so a dictated pause can't run a command.
    /// </summary>
    private static string NormalizeForEnvironment(string text, AppEnvironmentKind env)
    {
        // Never end with a newline: that would press Enter and submit/run in most apps.
        text = text.TrimEnd('\r', '\n', ' ', '\t');

        if (env == AppEnvironmentKind.Terminal)
        {
            // A shell treats every newline as "run this line", so flatten to one line.
            text = Regex.Replace(text, @"\s*[\r\n]+\s*", " ").Trim();
        }
        else
        {
            // Keep line structure elsewhere, but use CRLF: most Windows edit
            // controls only render a line break for "\r\n". With "\n" alone the
            // newlines are dropped and a list collapses onto a single line.
            text = text.Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", "\r\n");
        }

        return text;
    }

    private static void SendCtrlV()
    {
        var inputs = new[]
        {
            CreateVirtualKeyInput(VkControl, keyUp: false),
            CreateVirtualKeyInput(VkV, keyUp: false),
            CreateVirtualKeyInput(VkV, keyUp: true),
            CreateVirtualKeyInput(VkControl, keyUp: true),
        };

        SendInputChecked(inputs, "Ctrl+V send");
    }

    /// <summary>
    /// Character-by-character injection, used only when the clipboard route could not run
    /// at all.
    /// </summary>
    private static void TypeUnicode(string text, AppEnvironmentKind environment)
    {
        var inputs = new List<Input>(text.Length * 2);
        foreach (var ch in text)
        {
            if (ch == '\r') continue;
            if (ch == '\n')
            {
                // A synthesized Enter is a real keypress, and in most apps that is a
                // *submit*, not a line break: it sends the half-finished message in a
                // chat box, runs the line in a shell, and submits the form in a browser.
                // Only a known editor gets a real Enter; everywhere else the line break
                // degrades to a space, which is recoverable in a way that a sent message
                // is not.
                if (environment == AppEnvironmentKind.Editor)
                {
                    inputs.Add(CreateVirtualKeyInput(VkReturn, keyUp: false));
                    inputs.Add(CreateVirtualKeyInput(VkReturn, keyUp: true));
                }
                else
                {
                    inputs.Add(CreateUnicodeInput(' ', keyUp: false));
                    inputs.Add(CreateUnicodeInput(' ', keyUp: true));
                }
                continue;
            }

            inputs.Add(CreateUnicodeInput(ch, keyUp: false));
            inputs.Add(CreateUnicodeInput(ch, keyUp: true));
        }

        if (inputs.Count == 0) return;

        // SendInput delivers the array atomically, but a very large batch can be
        // partially accepted when the target queue fills. Chunking keeps each call small
        // enough to succeed and makes a partial failure visible instead of silent.
        const int chunkSize = 200;
        var all = inputs.ToArray();
        for (var offset = 0; offset < all.Length; offset += chunkSize)
        {
            var count = Math.Min(chunkSize, all.Length - offset);
            var chunk = new Input[count];
            Array.Copy(all, offset, chunk, 0, count);
            SendInputChecked(chunk, $"Unicode typing fallback (chars {offset}-{offset + count})");
        }
    }

    /// <summary>
    /// Copies the clipboard's current contents into memory.
    ///
    /// The previous implementation stashed the <see cref="IDataObject"/> handed back by
    /// Clipboard.GetDataObject() and replayed it afterwards. That object is a live window
    /// onto the *owning application's* data, not a copy - once Clipboard.SetText replaces
    /// the clipboard, whether it still resolves depends on whether that owner is alive and
    /// still willing to render the format. So restoring it worked sometimes and silently
    /// wiped the user's clipboard the rest of the time. Reading the values out up front
    /// makes the restore deterministic.
    /// </summary>
    private static ClipboardSnapshot CaptureClipboardSnapshot()
    {
        var snapshot = new ClipboardSnapshot();

        try
        {
            RetryClipboard(() =>
            {
                // Read eagerly, one format at a time. A format that fails to render is
                // skipped rather than losing the whole snapshot.
                snapshot.UnicodeText = TryGet(() =>
                    Clipboard.ContainsText(TextDataFormat.UnicodeText)
                        ? Clipboard.GetText(TextDataFormat.UnicodeText)
                        : null);

                snapshot.Html = TryGet(() =>
                    Clipboard.ContainsText(TextDataFormat.Html)
                        ? Clipboard.GetText(TextDataFormat.Html)
                        : null);

                snapshot.Rtf = TryGet(() =>
                    Clipboard.ContainsText(TextDataFormat.Rtf)
                        ? Clipboard.GetText(TextDataFormat.Rtf)
                        : null);

                snapshot.FileDropList = TryGet(() =>
                {
                    if (!Clipboard.ContainsFileDropList()) return null;
                    var files = Clipboard.GetFileDropList();
                    if (files.Count == 0) return null;
                    var copy = new string[files.Count];
                    files.CopyTo(copy, 0);
                    return copy;
                });

                snapshot.Image = TryGet<Image?>(() =>
                {
                    if (!Clipboard.ContainsImage()) return null;
                    using var live = Clipboard.GetImage();
                    // Clone into our own bitmap; the clipboard's image is not ours to keep.
                    return live is null ? null : new Bitmap(live);
                });

                return true;
            });
        }
        catch
        {
            // Snapshot remains empty if the clipboard is unavailable; the restore below
            // then correctly does nothing rather than clearing the user's clipboard.
        }

        snapshot.SequenceBeforeSet = GetClipboardSequenceNumber();
        return snapshot;
    }

    private static T? TryGet<T>(Func<T?> get)
    {
        try { return get(); }
        catch { return default; }
    }

    private static void TryRestoreClipboard(ClipboardSnapshot snapshot, uint sequenceAfterSet, bool force = false)
    {
        try
        {
            // If user/app changed clipboard since we set it, don't overwrite.
            if (!force)
            {
                var currentSeq = GetClipboardSequenceNumber();
                if (currentSeq != sequenceAfterSet)
                {
                    return;
                }
            }

            if (!snapshot.HasData)
            {
                // Nothing was captured. Deliberately leave the dictated text on the
                // clipboard rather than calling Clipboard.Clear(): if the snapshot failed
                // because the clipboard was momentarily locked, clearing would destroy
                // content we simply could not read.
                return;
            }

            RetryClipboard(() =>
            {
                var data = new DataObject();

                if (snapshot.UnicodeText is not null)
                {
                    data.SetData(DataFormats.UnicodeText, snapshot.UnicodeText);
                    data.SetData(DataFormats.Text, snapshot.UnicodeText);
                }
                if (snapshot.Html is not null) data.SetData(DataFormats.Html, snapshot.Html);
                if (snapshot.Rtf is not null) data.SetData(DataFormats.Rtf, snapshot.Rtf);
                if (snapshot.FileDropList is not null)
                {
                    data.SetData(DataFormats.FileDrop, snapshot.FileDropList);
                }
                if (snapshot.Image is not null) data.SetImage(snapshot.Image);

                Clipboard.SetDataObject(data, copy: true);
                return true;
            });
        }
        catch
        {
            // Non-fatal: clipboard restore is best effort.
        }
        finally
        {
            snapshot.Dispose();
        }
    }

    private static T RetryClipboard<T>(Func<T> action, int attempts = 8)
    {
        Exception? last = null;
        for (var i = 0; i < attempts; i++)
        {
            try
            {
                return action();
            }
            catch (ExternalException ex)
            {
                last = ex;
                Thread.Sleep(8 + (i * 12));
            }
        }

        throw new InvalidOperationException("Clipboard is unavailable.", last);
    }

    private static void SendInputChecked(Input[] inputs, string operationName)
    {
        var inputSize = Marshal.SizeOf<Input>();
        var sent = SendInput((uint)inputs.Length, inputs, inputSize);
        if (sent == inputs.Length) return;

        var errorCode = Marshal.GetLastWin32Error();
        throw new Win32Exception(
            errorCode,
            $"SendInput failed ({operationName}). Win32={errorCode}, sent={sent}/{inputs.Length}, cbSize={inputSize}.");
    }

    private static Input CreateUnicodeInput(char ch, bool keyUp)
    {
        return new Input
        {
            Type = InputKeyboard,
            Union = new InputUnion
            {
                KeyboardInput = new KeybdInput
                {
                    WVk = 0,
                    WScan = ch,
                    DwFlags = KeyeventfUnicode | (keyUp ? KeyeventfKeyup : 0),
                    Time = 0,
                    DwExtraInfo = IntPtr.Zero
                }
            }
        };
    }

    private static Input CreateVirtualKeyInput(ushort vKey, bool keyUp)
    {
        return new Input
        {
            Type = InputKeyboard,
            Union = new InputUnion
            {
                KeyboardInput = new KeybdInput
                {
                    WVk = vKey,
                    WScan = 0,
                    DwFlags = keyUp ? KeyeventfKeyup : 0,
                    Time = 0,
                    DwExtraInfo = IntPtr.Zero
                }
            }
        };
    }

    /// <summary>
    /// An eagerly-read copy of the clipboard's contents. Everything here is owned by us,
    /// so restoring it does not depend on the original owning application still being
    /// alive or willing to render the format.
    /// </summary>
    private sealed class ClipboardSnapshot : IDisposable
    {
        public string? UnicodeText { get; set; }
        public string? Html { get; set; }
        public string? Rtf { get; set; }
        public string[]? FileDropList { get; set; }
        public Image? Image { get; set; }
        public uint SequenceBeforeSet { get; set; }

        public bool HasData =>
            UnicodeText is not null ||
            Html is not null ||
            Rtf is not null ||
            FileDropList is not null ||
            Image is not null;

        public void Dispose()
        {
            Image?.Dispose();
            Image = null;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Input
    {
        public int Type;
        public InputUnion Union;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)]
        public KeybdInput KeyboardInput;

        [FieldOffset(0)]
        public MouseInput MouseInput;

        [FieldOffset(0)]
        public HardwareInput HardwareInput;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeybdInput
    {
        public ushort WVk;
        public ushort WScan;
        public uint DwFlags;
        public uint Time;
        public IntPtr DwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput
    {
        public int Dx;
        public int Dy;
        public uint MouseData;
        public uint DwFlags;
        public uint Time;
        public IntPtr DwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HardwareInput
    {
        public uint UMsg;
        public ushort WParamL;
        public ushort WParamH;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, Input[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    private static extern uint GetClipboardSequenceNumber();

    [DllImport("user32.dll")]
    private static extern IntPtr GetOpenClipboardWindow();
}
