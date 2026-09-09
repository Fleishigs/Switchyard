using System.Runtime.InteropServices;
using System.Text.Json;
using SwitchyardVoice.Native;
using SwitchyardVoice.Services;
namespace SwitchyardVoice;
static class Program
{
 [STAThread]static void Main(string[] args){
  if(args.Length>0&&args[0]=="--self-test"){
   try{if(VoiceCommands.Match("Open calculator.")!="open calculator"||VoiceCommands.Match("open calculator and delete everything")!=null)throw new Exception("Command boundary failed");
    if(args.Length==4){var text=LocalTranscriber.Transcribe(File.ReadAllBytes(args[3]),args[1],args[2],CancellationToken.None).GetAwaiter().GetResult();File.WriteAllText(Path.ChangeExtension(args[3],"transcribed.txt"),text);if(string.IsNullOrWhiteSpace(text))throw new Exception("Empty transcript");}
    Environment.ExitCode=0;
   }catch(Exception e){File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"self-test-error.txt"),e.ToString());Environment.ExitCode=1;}return;
  }
  using var mutex=new Mutex(true,(Environment.GetEnvironmentVariable("SWITCHYARD_VOICE_TEST_DATA") is null ? "Local\\SwitchyardVoice" : "Local\\SwitchyardVoiceTest"+Environment.ProcessId),out var first);if(!first)return;
  ApplicationConfiguration.Initialize();Application.Run(new VoiceWindow());
 }
}
sealed class VoiceSettings{public string Executable{get;set;}="";public string Model{get;set;}="";public bool Commands{get;set;}=false;public bool AutoPaste{get;set;}=true;}
sealed class VoiceWindow:Form
{
 readonly AudioRecorder recorder=new();GlobalHotkeyMonitor? hook;readonly NotifyIcon tray=new();
 readonly Label status=new(){AutoSize=true,Text="Ready · hold Ctrl + Shift + Space",ForeColor=Color.FromArgb(53,99,71)};
 readonly TextBox transcript=new(){Multiline=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,BorderStyle=BorderStyle.None,Font=new Font("Segoe UI",13),BackColor=Color.FromArgb(255,254,250)};
 readonly ComboBox mode=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=200};readonly CheckBox autoPaste=new(){Text="Paste into the original app",AutoSize=true,Checked=true};
 readonly Label engineLabel=new(){AutoSize=true,MaximumSize=new Size(620,0)};
 readonly Button recordButton=new(){Text="Start recording",AutoSize=true};
 readonly string folder=Environment.GetEnvironmentVariable("SWITCHYARD_VOICE_TEST_DATA")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SwitchyardVoice");
 VoiceSettings settings=new();CancellationTokenSource? operation;bool busy,exiting,starting,releasePending;IntPtr target;DateTime started;readonly System.Windows.Forms.Timer limit=new(){Interval=120000};
 public VoiceWindow(){
  Text="Switchyard Voice · local dictation";Size=new Size(760,700);MinimumSize=new Size(620,580);BackColor=Color.FromArgb(246,245,240);Font=new Font("Segoe UI",10);StartPosition=FormStartPosition.CenterScreen;
  Directory.CreateDirectory(folder);try{settings=JsonSerializer.Deserialize<VoiceSettings>(File.ReadAllText(Path.Combine(folder,"settings.json")))??new();}catch{}
  var bundled=Environment.GetEnvironmentVariable("SWITCHYARD_ENGINES")??Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"..","engines"));
  if(!File.Exists(settings.Executable)&&File.Exists(Path.Combine(bundled,"whisper","Release","whisper-cli.exe")))settings.Executable=Path.Combine(bundled,"whisper","Release","whisper-cli.exe");
  if(!File.Exists(settings.Executable)&&File.Exists(Path.Combine(bundled,"whisper","whisper-cli.exe")))settings.Executable=Path.Combine(bundled,"whisper","whisper-cli.exe");
  if(!File.Exists(settings.Model)&&File.Exists(Path.Combine(bundled,"ggml-tiny.en.bin")))settings.Model=Path.Combine(bundled,"ggml-tiny.en.bin");
  var layout=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(30),ColumnCount=1,RowCount=8};Controls.Add(layout);
  layout.RowStyles.Add(new RowStyle(SizeType.Absolute,55));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,58));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,60));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,50));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,50));layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,55));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,42));
  layout.Controls.Add(new Label{Text="Your voice. Your computer.",Font=new Font("Segoe UI",24,FontStyle.Bold),AutoSize=true});
  layout.Controls.Add(new Label{Text="Offline dictation with a small CPU model.\nHold Ctrl + Shift + Space anywhere; release to transcribe.",AutoSize=true,ForeColor=Color.DimGray});
  var engineRow=new FlowLayoutPanel{Dock=DockStyle.Fill};engineRow.Controls.Add(Button("Choose Whisper",()=>Choose(true)));engineRow.Controls.Add(Button("Choose model",()=>Choose(false)));engineRow.Controls.Add(engineLabel);layout.Controls.Add(engineRow);UpdateEngine();
  var modeRow=new FlowLayoutPanel{Dock=DockStyle.Fill};mode.Items.AddRange(new object[]{"Dictation","Windows commands"});mode.SelectedIndex=settings.Commands?1:0;mode.SelectedIndexChanged+=(_,_)=>{settings.Commands=mode.SelectedIndex==1;Save();};autoPaste.Checked=settings.AutoPaste;autoPaste.CheckedChanged+=(_,_)=>{settings.AutoPaste=autoPaste.Checked;Save();};modeRow.Controls.Add(mode);modeRow.Controls.Add(autoPaste);layout.Controls.Add(modeRow);
  var controls=new FlowLayoutPanel{Dock=DockStyle.Fill};recordButton.Click+=async(_,_)=>{if(recorder.IsRecording)await Stop();else await Start(false);};controls.Controls.Add(recordButton);controls.Controls.Add(Button("Cancel",()=>{_ = CancelRecording();}));controls.Controls.Add(Button("Copy transcript",()=>{if(transcript.Text.Length>0)Clipboard.SetText(transcript.Text);}));layout.Controls.Add(controls);
  layout.Controls.Add(transcript);layout.Controls.Add(new Label{Text="Commands: open calculator · open notepad · open file explorer\nvolume up/down · mute audio · play pause · next/previous track",AutoSize=true,ForeColor=Color.DimGray});layout.Controls.Add(status);
  tray.Icon=SystemIcons.Application;tray.Text="Switchyard Voice · Ctrl + Shift + Space";tray.Visible=true;tray.DoubleClick+=(_,_)=>{Show();WindowState=FormWindowState.Normal;Activate();};var menu=new ContextMenuStrip();menu.Items.Add("Open",null,(_,_)=>{Show();Activate();});menu.Items.Add("Exit",null,(_,_)=>{exiting=true;Close();});tray.ContextMenuStrip=menu;
  Shown+=(_,_)=>{hook=new GlobalHotkeyMonitor();hook.SetChord(new[]{KeyChord.VkControl,KeyChord.VkShift,0x20});hook.HoldStarted+=async(_,_)=>await Start(true);hook.HoldEnded+=async(_,_)=>{if(starting)releasePending=true;else await Stop();};};
  limit.Tick+=async(_,_)=>await Stop();FormClosing+=(_,e)=>{if(!exiting){e.Cancel=true;Hide();return;}operation?.Cancel();limit.Stop();hook?.Dispose();recorder.Dispose();tray.Dispose();};
 }
 Button Button(string text,Action action){var b=new Button{Text=text,AutoSize=true,FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(211,233,206),Padding=new Padding(8,4,8,4)};b.FlatAppearance.BorderSize=0;b.Click+=(_,_)=>{try{action();}catch(Exception e){status.Text=e.Message;}};return b;}
 void Choose(bool executable){using var d=new OpenFileDialog{Title=executable?"Choose whisper-cli.exe":"Choose ggml model",Filter=executable?"Executable|*.exe":"Model|*.bin"};if(d.ShowDialog()==DialogResult.OK){if(executable)settings.Executable=d.FileName;else settings.Model=d.FileName;Save();UpdateEngine();}}
 void UpdateEngine()=>engineLabel.Text=File.Exists(settings.Executable)&&File.Exists(settings.Model)?"Local engine ready · "+Path.GetFileName(settings.Model):"Choose an engine and model to begin.";
 void Save(){var temp=Path.Combine(folder,"settings.tmp");File.WriteAllText(temp,JsonSerializer.Serialize(settings));File.Move(temp,Path.Combine(folder,"settings.json"),true);}
 async Task CancelRecording(){operation?.Cancel();limit.Stop();try{if(recorder.IsRecording)await recorder.StopAsync();status.Text="Cancelled";recordButton.Text="Start recording";}catch(Exception e){status.Text=e.Message;}}
 async Task Start(bool hotkey){if(busy||starting||recorder.IsRecording)return;try{if(!File.Exists(settings.Executable)||!File.Exists(settings.Model))throw new InvalidOperationException("Choose Whisper and a model first.");starting=true;releasePending=false;target=hotkey?GetForegroundWindow():IntPtr.Zero;started=DateTime.UtcNow;if(await recorder.StartAsync()){status.Text="Listening… release the shortcut to finish";recordButton.Text="Stop recording";limit.Start();}}catch(Exception e){status.Text=e.Message;}finally{starting=false;if(releasePending)await Stop();}}
 async Task Stop(){if(busy||!recorder.IsRecording)return;busy=true;limit.Stop();recordButton.Text="Start recording";operation=new CancellationTokenSource(TimeSpan.FromMinutes(5));try{var wav=await recorder.StopAsync();if(wav==null||DateTime.UtcNow-started<TimeSpan.FromMilliseconds(350)){status.Text="Short recording ignored";return;}status.Text="Transcribing locally…";var commands=settings.Commands;var paste=settings.AutoPaste;var text=await LocalTranscriber.Transcribe(wav,settings.Executable,settings.Model,operation.Token);transcript.Text=text;await File.WriteAllTextAsync(Path.Combine(folder,"last-transcript.txt"),text);if(commands){var command=VoiceCommands.Match(text);if(command==null){status.Text="No exact command matched. Nothing executed.";return;}VoiceCommands.Execute(command);status.Text="Executed: "+command;}else if(paste&&target!=IntPtr.Zero&&target==GetForegroundWindow()&&!string.IsNullOrWhiteSpace(text)){hook?.Suspend();try{InputTextPaster.PasteText(text.Replace('\r',' ').Replace('\n',' ').Trim());status.Text="Pasted · ready for your next thought";}finally{hook?.Resume();}}else status.Text="Transcript ready · copy it above";}catch(OperationCanceledException){status.Text="Cancelled";}catch(Exception e){status.Text=e.Message;}finally{operation.Dispose();operation=null;busy=false;}}
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
}
