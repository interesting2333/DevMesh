$previewDatasetTest = Get-CimInstance Win32_Process -Filter "ProcessId = 38388"
if ($null -eq $previewDatasetTest -or $previewDatasetTest.Name -ne 'node.exe' -or $previewDatasetTest.CommandLine -notmatch 'tests[\\/]dataset-consumer\.test\.mjs') { throw 'Expected exact dataset test process is absent; refusing to stop another process.' }
$previewDatasetTest | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json -Compress
Stop-Process -Id $previewDatasetTest.ProcessId -Force
