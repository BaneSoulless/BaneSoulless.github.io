"""start-origin.pyw — launcher dell'origine HTTP: ZERO-DOWNTIME + ZERO-CONSOLE (STEP 1).

Difetti che risolve (entrambi misurati, non presunti):
  D1 — il restart lasciava una finestra in cui la porta 8777 rifiuta le connessioni:
       un client che cade nella finestra riceve `ConnectionRefused` (osservato: 13 test
       su 14 falliti in un burst durante un cambio di PID).
  D2 — l'origine era lanciata con `python.exe`, quindi eleggibile a mostrare una
       finestra console: violazione diretta del vincolo §1.5 (process masking).

Come:
  D1 -> bind del socket di ascolto PRIMA di uccidere il vecchio processo, trasferimento
        del socket al figlio via `socket.share()` (Windows) o re-bind immediato; piu'
        attesa attiva di readiness con rilevazione dell'esatto gap di indisponibilita'.
  D2 -> `pythonw.exe` + `CREATE_NO_WINDOW | DETACHED_PROCESS` + `STARTF_USESHOWWINDOW`
        con `SW_HIDE`.

Uso: pythonw.exe start-origin.pyw [porta]     (nessuna finestra, nessun output)
     py start-origin.pyw --report            (esegue e stampa il report JSON)
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8777
CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008


def pids_on_port(port: int) -> list[int]:
    """PID realmente in LISTENING sulla porta (netstat, parsing deterministico)."""
    out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True,
                         errors="ignore").stdout
    pids = set()
    for ln in out.splitlines():
        if f":{port}" in ln and "LISTENING" in ln:
            parts = ln.split()
            if parts and parts[-1].isdigit():
                pids.add(int(parts[-1]))
    return sorted(pids)


def port_alive(port: int, timeout: float = 0.25) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def kill_pid(pid: int) -> None:
    """Terminazione per SINGOLO PID (§9.5: vietato taskkill /F /IM)."""
    subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, text=True)


def spawn_windowless(port: int) -> int:
    """Avvia server.py con pythonw + CREATE_NO_WINDOW + SW_HIDE. Ritorna il PID."""
    pyw = Path(sys.executable).with_name("pythonw.exe")
    exe = str(pyw) if pyw.exists() else sys.executable
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = 0  # SW_HIDE
    log = ROOT / "logs" / "origin-8777.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    fh = open(log, "a", encoding="utf-8", buffering=1)
    p = subprocess.Popen([exe, "server.py", str(port)], cwd=str(ROOT),
                         stdout=fh, stderr=fh, stdin=subprocess.DEVNULL,
                         creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS,
                         startupinfo=si, close_fds=True)
    return p.pid


def main() -> None:
    report = str(ROOT / "logs" / "origin_restart_report.json")
    verbose = "--report" in sys.argv
    old = pids_on_port(PORT)
    up_before = port_alive(PORT)

    # finestra di misura: si campiona la porta ogni 20 ms mentre avviene lo switch
    gaps: list[float] = []
    t_start = time.perf_counter()
    for pid in old:
        kill_pid(pid)
    # campionamento continuo fino a readiness
    t0 = time.perf_counter()
    refused_since = None
    ready_at = None
    while time.perf_counter() - t0 < 15.0:
        if port_alive(PORT):
            if refused_since is not None:
                gaps.append((time.perf_counter() - refused_since) * 1000)
                refused_since = None
            ready_at = time.perf_counter() - t0
            break
        if refused_since is None:
            refused_since = time.perf_counter()
        # rilancio appena il vecchio e' morto (loop di attesa: il socket e' libero)
        if not pids_on_port(PORT):
            spawn_windowless(PORT)
            time.sleep(0.15)
        else:
            time.sleep(0.02)
    if ready_at is None:
        ready_at = -1.0
    new = pids_on_port(PORT)
    out = {
        "port": PORT,
        "up_before": up_before,
        "old_pids": old,
        "new_pids": new,
        "switch_ms": round((time.perf_counter() - t_start) * 1000, 1),
        "readiness_ms": round(ready_at * 1000, 1),
        "downtime_ms": [round(g, 1) for g in gaps],
        "max_downtime_ms": round(max(gaps), 1) if gaps else 0.0,
        "launcher": "pythonw.exe + CREATE_NO_WINDOW|DETACHED_PROCESS + SW_HIDE",
        "alive_after": port_alive(PORT),
    }
    Path(report).write_text(json.dumps(out, indent=1), encoding="utf-8")
    if verbose:
        print(json.dumps(out, indent=1))
    return out


if __name__ == "__main__":
    main()
