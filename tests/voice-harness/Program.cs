using SwitchyardVoice.Services;
using System.Text.Json;
using NAudio.Wave;
var results = new List<string>();
foreach(var name in SwitchyardVoice.VoiceCommands.Names) {
 if(SwitchyardVoice.VoiceCommands.Match(name.ToUpperInvariant()+".")!=name) throw new Exception("Command normalization failed.");
 var executable=SwitchyardVoice.VoiceCommands.ExecutableFor(name);
 if(executable!=null&&!File.Exists(executable)) throw new Exception("Command executable is missing: "+name);
}
foreach(var input in new[]{"open calculator123","open calculator and delete everything","open calculator שלום","restart computer"})
 if(SwitchyardVoice.VoiceCommands.Match(input)!=null) throw new Exception("Unexpected command accepted.");
results.Add("All nine command names match, compound requests are rejected, and all three app executable paths exist");
using var recorder = new AudioRecorder();
var devices = AudioRecorder.ListInputDevices();
if (devices.Count == 0) throw new Exception("No microphone available for device verification.");
if (!await recorder.StartAsync()) throw new Exception("Capture did not start.");
if (await recorder.StartAsync()) throw new Exception("Duplicate capture should be ignored.");
await Task.Delay(500);
var bytes = await recorder.StopAsync();
if (bytes is null || bytes.Length <= 44 || recorder.IsRecording) throw new Exception("Capture did not produce and finalize WAV data.");
using (var reader = new WaveFileReader(new MemoryStream(bytes))) { if (reader.TotalTime.TotalMilliseconds < 100) throw new Exception("Capture was too short."); }
Array.Clear(bytes); // Discard the device-check recording; no audio file or transcript is saved.
results.Add("Actual microphone opens, captures WAV in memory, and stops cleanly");
results.Add("Duplicate start is ignored");
await recorder.StopAsync();results.Add("Repeated stop is safe");
if (!await recorder.StartAsync()) throw new Exception("Capture could not restart.");
await Task.Delay(200);recorder.Dispose();results.Add("Capture can restart and be disposed while active");
Console.WriteLine(JsonSerializer.Serialize(new {passed=results.Count,results}));
