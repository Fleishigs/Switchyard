using NAudio.Wave;

namespace SwitchyardVoice.Services;

public sealed class AudioRecorder : IDisposable
{
    /// <summary>
    /// How long to wait for the driver to raise RecordingStopped before giving up and
    /// salvaging the buffered audio. A wedged or unplugged device used to hang the caller
    /// forever, leaving the app stuck on "Transcribing...".
    /// </summary>
    private static readonly TimeSpan DefaultStopTimeout = TimeSpan.FromSeconds(4);

    private readonly object _sync = new();

    private WaveInEvent? _waveIn;
    private WaveFormat? _waveFormat;
    private MemoryStream? _pcmBuffer;
    private TaskCompletionSource<byte[]?>? _stopTcs;
    private bool _disposed;
    private float _smoothedLevel;
    private int? _preferredDeviceNumber;

    // Incremented per capture session so a late callback from a session that was already
    // force-reset cannot corrupt the state of the session that replaced it.
    private int _generation;

    public bool IsRecording { get; private set; }
    public event Action<float>? AudioLevelChanged;

    public int? PreferredDeviceNumber
    {
        get
        {
            lock (_sync)
            {
                return _preferredDeviceNumber;
            }
        }
    }

    public void SetPreferredDeviceNumber(int? deviceNumber)
    {
        ThrowIfDisposed();

        lock (_sync)
        {
            if (IsRecording)
            {
                throw new InvalidOperationException("Cannot switch microphones while recording.");
            }

            if (deviceNumber is not null)
            {
                if (WaveIn.DeviceCount <= 0)
                {
                    throw new InvalidOperationException("No microphone input devices are available.");
                }

                if (deviceNumber.Value < 0 || deviceNumber.Value >= WaveIn.DeviceCount)
                {
                    throw new ArgumentOutOfRangeException(
                        nameof(deviceNumber),
                        "Selected microphone is no longer available.");
                }
            }

            _preferredDeviceNumber = deviceNumber;
        }
    }

    public static IReadOnlyList<AudioInputDeviceInfo> ListInputDevices()
    {
        var devices = new List<AudioInputDeviceInfo>();
        var count = WaveIn.DeviceCount;

        for (var i = 0; i < count; i++)
        {
            var caps = WaveIn.GetCapabilities(i);
            var name = string.IsNullOrWhiteSpace(caps.ProductName)
                ? $"Microphone {i + 1}"
                : caps.ProductName.Trim();

            devices.Add(new AudioInputDeviceInfo
            {
                DeviceNumber = i,
                ProductName = name,
                Channels = caps.Channels,
            });
        }

        return devices;
    }

    /// <summary>
    /// Opens the input device and begins capturing. Returns false if capture was already
    /// running. Throws only if the device could not be opened, and in that case the
    /// recorder is left cleanly stopped rather than half-started.
    /// </summary>
    public Task<bool> StartAsync()
    {
        ThrowIfDisposed();

        int? preferredDeviceNumber;
        lock (_sync)
        {
            if (IsRecording)
            {
                return Task.FromResult(false);
            }

            preferredDeviceNumber = _preferredDeviceNumber;
        }

        var waveIn = CreateWaveIn(preferredDeviceNumber);
        var pcmBuffer = new MemoryStream();
        _smoothedLevel = 0f;
        AudioLevelChanged?.Invoke(0f);

        // Captured so a late callback from a previous, already-torn-down session cannot
        // write into the buffers of the current one.
        int generation;

        waveIn.DataAvailable += (_, e) =>
        {
            float nextLevel;
            lock (_sync)
            {
                _pcmBuffer?.Write(e.Buffer, 0, e.BytesRecorded);
                var rawLevel = ComputeRmsLevel(e.Buffer, e.BytesRecorded);
                // Fast attack, slower release so the meter tracks loudness responsively.
                var blend = rawLevel > _smoothedLevel ? 0.6f : 0.25f;
                _smoothedLevel = (_smoothedLevel * (1f - blend)) + (rawLevel * blend);
                nextLevel = _smoothedLevel;
            }

            AudioLevelChanged?.Invoke(nextLevel);
        };

        waveIn.RecordingStopped += OnRecordingStopped;

        lock (_sync)
        {
            generation = ++_generation;
            _waveIn = waveIn;
            _waveFormat = waveIn.WaveFormat;
            _pcmBuffer = pcmBuffer;
            IsRecording = true;
        }

        try
        {
            waveIn.StartRecording();
        }
        catch
        {
            // Previously IsRecording was left true here forever: every later StartAsync
            // returned false, every StopAsync returned null, and the settings controls
            // stayed disabled - the app was bricked until restart. Roll the state back
            // so the next attempt is clean.
            lock (_sync)
            {
                if (_generation == generation)
                {
                    IsRecording = false;
                    _waveIn = null;
                    _waveFormat = null;
                    _pcmBuffer?.Dispose();
                    _pcmBuffer = null;
                }
            }

            waveIn.RecordingStopped -= OnRecordingStopped;
            try { waveIn.Dispose(); } catch { /* already failed; nothing more to do */ }

            AudioLevelChanged?.Invoke(0f);
            throw;
        }

        return Task.FromResult(true);
    }

    /// <summary>
    /// Stops capturing and returns the recorded audio as a WAV, or null if nothing was
    /// being recorded. Always completes: if the driver never raises RecordingStopped the
    /// recorder is force-reset after <paramref name="timeout"/> and whatever audio was
    /// buffered is returned, so the caller can never hang waiting on a dead device.
    /// </summary>
    public async Task<byte[]?> StopAsync(TimeSpan? timeout = null)
    {
        ThrowIfDisposed();

        WaveInEvent? waveIn;
        TaskCompletionSource<byte[]?> tcs;
        int generation;

        lock (_sync)
        {
            if (!IsRecording || _waveIn is null)
            {
                return null;
            }

            _stopTcs ??= new TaskCompletionSource<byte[]?>(TaskCreationOptions.RunContinuationsAsynchronously);
            tcs = _stopTcs;
            waveIn = _waveIn;
            generation = _generation;
        }

        try
        {
            waveIn.StopRecording();
        }
        catch
        {
            // The device may already be gone (unplugged mid-sentence). Fall through to
            // the salvage path rather than surfacing a driver error for audio we have.
            return ForceReset(generation);
        }

        var limit = timeout ?? DefaultStopTimeout;
        var finished = await Task.WhenAny(tcs.Task, Task.Delay(limit)).ConfigureAwait(false);
        if (ReferenceEquals(finished, tcs.Task))
        {
            return await tcs.Task.ConfigureAwait(false);
        }

        return ForceReset(generation);
    }

    /// <summary>
    /// Tears the current capture session down without waiting for the driver, salvaging
    /// whatever PCM was already buffered.
    /// </summary>
    private byte[]? ForceReset(int generation)
    {
        WaveInEvent? staleWaveIn;
        TaskCompletionSource<byte[]?>? tcs;
        byte[]? salvaged = null;

        lock (_sync)
        {
            if (_generation != generation)
            {
                // A newer session already replaced this one; leave it alone.
                return null;
            }

            try
            {
                if (_waveFormat is not null && _pcmBuffer is not null && _pcmBuffer.Length > 0)
                {
                    salvaged = BuildWaveFile(
                        _pcmBuffer.ToArray(),
                        _waveFormat.SampleRate,
                        _waveFormat.BitsPerSample,
                        _waveFormat.Channels);
                }
            }
            catch
            {
                salvaged = null;
            }

            staleWaveIn = _waveIn;
            tcs = _stopTcs;
            _stopTcs = null;
            _waveIn = null;
            _waveFormat = null;
            _pcmBuffer?.Dispose();
            _pcmBuffer = null;
            IsRecording = false;
        }

        if (staleWaveIn is not null)
        {
            staleWaveIn.RecordingStopped -= OnRecordingStopped;
            // Disposed outside the lock: WaveInEvent.Dispose blocks until its capture
            // thread unwinds, and that thread may itself be waiting to take _sync.
            try { staleWaveIn.Dispose(); } catch { /* best effort */ }
        }

        tcs?.TrySetResult(salvaged);
        AudioLevelChanged?.Invoke(0f);
        return salvaged;
    }

    private static WaveInEvent CreateWaveIn(int? preferredDeviceNumber)
    {
        // Push-to-talk mode means recording runs only while keys are held,
        // so this event-driven capture is very light on CPU/battery.
        if (WaveIn.DeviceCount <= 0)
        {
            throw new InvalidOperationException("No microphone input devices are available.");
        }

        var resolvedDeviceNumber = preferredDeviceNumber;
        if (resolvedDeviceNumber is null ||
            resolvedDeviceNumber.Value < 0 ||
            resolvedDeviceNumber.Value >= WaveIn.DeviceCount)
        {
            // WinMM capture defaults to the first available input device.
            resolvedDeviceNumber = 0;
        }

        var candidateSampleRates = new[] { 16000, 24000, 44100, 48000 };
        Exception? lastError = null;

        foreach (var sampleRate in candidateSampleRates)
        {
            try
            {
                return new WaveInEvent
                {
                    DeviceNumber = resolvedDeviceNumber.Value,
                    BufferMilliseconds = 50,
                    NumberOfBuffers = 3,
                    WaveFormat = new WaveFormat(sampleRate, 16, 1),
                };
            }
            catch (Exception ex)
            {
                lastError = ex;
            }
        }

        throw new InvalidOperationException("Unable to initialize microphone capture format.", lastError);
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        TaskCompletionSource<byte[]?>? tcs;
        WaveInEvent? staleWaveIn;
        byte[]? wavBytes = null;
        Exception? exception = e.Exception;

        lock (_sync)
        {
            // A force-reset (stop timeout, device unplugged, dispose) may already have
            // torn this session down. Nothing left to do, and nothing to clobber.
            if (!ReferenceEquals(sender, _waveIn))
            {
                return;
            }

            try
            {
                if (exception is null &&
                    _waveFormat is not null &&
                    _pcmBuffer is not null)
                {
                    var pcm = _pcmBuffer.ToArray();
                    wavBytes = BuildWaveFile(pcm, _waveFormat.SampleRate, _waveFormat.BitsPerSample, _waveFormat.Channels);
                }
            }
            catch (Exception ex)
            {
                exception = ex;
            }
            finally
            {
                IsRecording = false;
                tcs = _stopTcs;
                _stopTcs = null;

                staleWaveIn = _waveIn;
                _waveIn = null;
                _waveFormat = null;
                _pcmBuffer?.Dispose();
                _pcmBuffer = null;
            }
        }

        if (staleWaveIn is not null)
        {
            staleWaveIn.RecordingStopped -= OnRecordingStopped;
            // Disposed outside the lock. WaveInEvent.Dispose waits for its capture thread,
            // and DataAvailable on that thread takes _sync - holding it here risks a stall.
            try { staleWaveIn.Dispose(); } catch { /* best effort */ }
        }

        AudioLevelChanged?.Invoke(0f);

        if (tcs is null) return;

        if (exception is not null)
        {
            tcs.TrySetException(exception);
        }
        else
        {
            tcs.TrySetResult(wavBytes);
        }
    }

    private static byte[] BuildWaveFile(byte[] pcm, int sampleRate, int bitsPerSample, int channels)
    {
        var blockAlign = (short)(channels * (bitsPerSample / 8));
        var byteRate = sampleRate * blockAlign;
        var dataLength = pcm.Length;

        using var output = new MemoryStream(44 + dataLength);
        using var writer = new BinaryWriter(output);

        writer.Write("RIFF"u8.ToArray());
        writer.Write(36 + dataLength);
        writer.Write("WAVE"u8.ToArray());
        writer.Write("fmt "u8.ToArray());
        writer.Write(16); // PCM fmt chunk size
        writer.Write((short)1); // PCM
        writer.Write((short)channels);
        writer.Write(sampleRate);
        writer.Write(byteRate);
        writer.Write(blockAlign);
        writer.Write((short)bitsPerSample);
        writer.Write("data"u8.ToArray());
        writer.Write(dataLength);
        writer.Write(pcm);
        writer.Flush();

        return output.ToArray();
    }

    private static float ComputeRmsLevel(byte[] buffer, int bytesRecorded)
    {
        if (bytesRecorded < 2)
        {
            return 0f;
        }

        var sampleCount = bytesRecorded / 2;
        double sumSquares = 0;

        for (var i = 0; i + 1 < bytesRecorded; i += 2)
        {
            var sample = (short)(buffer[i] | (buffer[i + 1] << 8));
            var normalized = sample / 32768f;
            sumSquares += normalized * normalized;
        }

        var rms = Math.Sqrt(sumSquares / sampleCount);

        // Boost to a user-friendly meter range and clamp. A mild curve makes
        // normal speech sit in the mid range while loud speech clearly peaks.
        var boosted = Math.Min(1.0, Math.Pow(rms * 16.0, 0.85));
        return (float)boosted;
    }

    public void Dispose()
    {
        WaveInEvent? staleWaveIn;
        TaskCompletionSource<byte[]?>? tcs;

        lock (_sync)
        {
            if (_disposed) return;
            _disposed = true;

            _generation++;
            staleWaveIn = _waveIn;
            tcs = _stopTcs;
            _stopTcs = null;
            _waveIn = null;
            _waveFormat = null;
            _pcmBuffer?.Dispose();
            _pcmBuffer = null;
            IsRecording = false;
        }

        // Stopped and disposed outside the lock: WaveInEvent.Dispose blocks until its
        // capture thread unwinds, and DataAvailable on that thread takes _sync.
        if (staleWaveIn is not null)
        {
            staleWaveIn.RecordingStopped -= OnRecordingStopped;
            try { staleWaveIn.StopRecording(); } catch { /* ignore cleanup failures */ }
            try { staleWaveIn.Dispose(); } catch { /* ignore cleanup failures */ }
        }

        tcs?.TrySetResult(null);
        AudioLevelChanged?.Invoke(0f);
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(AudioRecorder));
        }
    }
}

public sealed class AudioInputDeviceInfo
{
    public int DeviceNumber { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public int Channels { get; init; }
}
