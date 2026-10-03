Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Check if airmesh.exe is already running
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'airmesh.exe'")
If colProcesses.Count > 0 Then
    MsgBox "AirMesh zaten arka planda çalışıyor!", 64, "AirMesh Aktif"
    WScript.Quit
End If

' Run airmesh.exe completely hidden (window style 0)
WshShell.Run "airmesh.exe", 0, False

WScript.Sleep 1000

' Open default browser to local dashboard
WshShell.Run "http://localhost:8080", 1, False

MsgBox "🚀 AirMesh arka planda başarıyla başlatıldı!" & vbCrLf & vbCrLf & _
       "• Web Arayüzü tarayıcınızda açıldı." & vbCrLf & _
       "• Telefondan dosya yüklendiğinde Windows masaüstü bildirimi gelecektir." & vbCrLf & _
       "• Durdurmak için 'AirMesh_Durdur.bat' dosyasını çalıştırabilirsiniz.", 64, "AirMesh Başlatıldı"
