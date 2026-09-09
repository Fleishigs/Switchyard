using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
namespace SwitchyardVoice;
public static class VoiceCommands
{
 public static readonly string[] Names={"open calculator","open notepad","open file explorer","volume up","volume down","mute audio","play pause","next track","previous track"};
 public static string Normalize(string text)=>Regex.Replace(Regex.Replace(text.Trim().ToLowerInvariant(),"[.!?,]+$",""),@"\s+"," ").Trim();
 public static string? Match(string text){var normalized=Normalize(text);return Names.FirstOrDefault(x=>x==normalized);}
 public static string? ExecutableFor(string command)=>command switch {
  "open calculator"=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"calc.exe"),
  "open notepad"=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"notepad.exe"),
  "open file explorer"=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"explorer.exe"),
  _=>null
 };
 public static void Execute(string command)
 {
  if(!Names.Contains(command))throw new InvalidOperationException("Unknown voice command.");
  var executable=ExecutableFor(command);
  if(executable!=null){Process.Start(new ProcessStartInfo(executable){UseShellExecute=true});return;}
  byte key=command switch{"volume up"=>0xAF,"volume down"=>0xAE,"mute audio"=>0xAD,"play pause"=>0xB3,"next track"=>0xB0,"previous track"=>0xB1,_=>throw new InvalidOperationException()};
  keybd_event(key,0,0,UIntPtr.Zero);keybd_event(key,0,2,UIntPtr.Zero);
 }
 [DllImport("user32.dll")]private static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
