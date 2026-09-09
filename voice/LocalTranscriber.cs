using System.Diagnostics;
namespace SwitchyardVoice;
public static class LocalTranscriber
{
 public static async Task<string> Transcribe(byte[] wav,string executable,string model,CancellationToken token)
 {
  if(!File.Exists(executable)||!File.Exists(model))throw new InvalidOperationException("Choose a whisper-cli executable and a local ggml model first.");
  var folder=Path.Combine(Path.GetTempPath(),"SwitchyardVoice",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(folder);
  try{
   var input=Path.Combine(folder,"recording.wav");var output=Path.Combine(folder,"transcript");await File.WriteAllBytesAsync(input,wav,token);
   var info=new ProcessStartInfo(executable){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
   foreach(var arg in new[]{"-m",model,"-f",input,"-otxt","-of",output,"-nt","-t",Math.Clamp(Environment.ProcessorCount/2,1,4).ToString()})info.ArgumentList.Add(arg);
   using var process=Process.Start(info)??throw new InvalidOperationException("Unable to start Whisper.");
   var stdout=process.StandardOutput.ReadToEndAsync(token);var stderr=process.StandardError.ReadToEndAsync(token);
   using var cancel=token.Register(()=>{try{process.Kill(true);}catch{}});
   await process.WaitForExitAsync(token);await stdout;var errors=await stderr;
   if(process.ExitCode!=0)throw new InvalidOperationException(errors.Length>1500?errors[^1500..]:errors);
   return (await File.ReadAllTextAsync(output+".txt",token)).Trim();
  }finally{try{Directory.Delete(folder,true);}catch{}}
 }
}
