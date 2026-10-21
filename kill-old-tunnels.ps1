# Termina TUTTI i tunnel cloudflared esistenti.
# FM-06: al restart-site.sh il tunnel nuovo viene creato DOPO il kill, quindi
# nessun processo cloudflared pre-esistente deve sopravvivere (l'URL vecchio e'
# comunque invalidato dal nuovo tunnel). pkill MSYS non vede i processi Windows
# nativi: qui kill per PID singolo via CIM.
$procs = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'"
if ($procs) {
    $procs | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
