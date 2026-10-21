#!/usr/bin/env python
"""Origine HTTP del sito: ThreadingHTTPServer (thread-per-request) su 127.0.0.1:<port>.

Sostituisce http.server CLI con controllo esplicito di bind/directory e con una
ALLOWLIST di ciò che è servibile: il sito è esposto pubblicamente via tunnel, quindi
il docroot NON deve enumerare né consegnare file interni.

Difetti chiusi rispetto alla versione precedente (trovati dall'audit di robustezza):
  - directory listing abilitato su /, /data/, /tools/, /logs/, /bin/, /.hermes/,
    /versions-archive/, /__pycache__/;
  - sorgenti e stato scaricabili: server.py, watchdog.py, task_plan*.md,
    current-url.json, *.bak, *.log, cloudflared.exe.

Regole: le directory non elencabili rispondono 403; le estensioni e i percorsi
sensibili sono negati anche se richiesti direttamente. Restano servibili le pagine,
robots.txt, sitemap.xml e la cartella data/ (dataset usato dall'app in pagina).

Uso: python server.py [port]
"""
from __future__ import annotations

import gzip
import os
import subprocess
import sys
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

BASE = Path(r"C:\Users\Fabrizio\workspace\public-site")

# Tipi comprimibili on-the-fly e soglia minima (sotto ~1 KB il guadagno non
# giustifica l'overhead). I binari (webp) sono già compressi.
COMPRESSIBLE = (".html", ".js", ".json", ".css", ".svg", ".xml", ".txt", ".md")
MIN_GZIP_BYTES = 1024

# Percorsi (prefissi) mai servibili: codice di servizio, log, binari, backup, cache.
BLOCKED_PREFIXES = (
    "/tools/",
    "/logs/",
    "/bin/",
    "/.hermes/",
    "/__pycache__/",
    "/versions-archive/",
)

# File specifici di servizio da negare anche se richiesti esplicitamente.
BLOCKED_EXACT = {
    "/current-url.json",
    "/robots.txt.bak",
    "/task_plan.md",
    "/task_plan_v2.md",
    "/task_plan_incidents.md",
    "/task_plan_skills.md",
    "/fams-v4-report.md",
    "/research-features.md",
    "/DESIGN_EVOLUTION.md",
}

# Estensioni che non devono MAI uscire dal docroot pubblico.
BLOCKED_SUFFIXES = (".py", ".pyc", ".bak", ".log", ".ps1", ".sh", ".exe", ".md")


class HardenedHandler(SimpleHTTPRequestHandler):
    """Handler con Cache-Control: no-store, nessun listing e allowlist dei percorsi."""

    server_version = "HermesLocalSite/1.0"

    @staticmethod
    def _etag_for(path: str) -> str:
        """Strong ETag from size + mtime_ns: cheap (no hashing), and it changes whenever
        the file is rebuilt, which is exactly the invalidation boundary this site needs."""
        st = os.stat(path)
        return f'"{st.st_size:x}-{st.st_mtime_ns:x}"'

    def _not_modified(self, path: str) -> bool:
        """True when the client's If-None-Match matches -> answer 304 and send NO body.

        MEASURED NEED (2026-09-29): the server set `Cache-Control: no-store`, so a client
        could not even STORE a response and had to re-download every byte on every
        navigation: 500 777 B across 12 resources, gzipped (70-76% already applied), all
        of it avoidable. `no-store` -> `no-cache` keeps the semantics that matter here
        (the client MUST revalidate, so a rebuilt page is never served stale) while
        allowing a 304 when the content is unchanged.
        """
        inm = self.headers.get("If-None-Match")
        if not inm:
            return False
        et = self._etag_for(path)
        tags = [t.strip() for t in inm.split(",")]
        if et in tags or "*" in tags:
            self.send_response(304)
            self.send_header("ETag", et)
            self.send_header("Vary", "Accept-Encoding")
            self.end_headers()
            return True
        return False

    def send_response(self, code, message=None):  # type: ignore[override]
        self._status = code
        return super().send_response(code, message)

    def end_headers(self) -> None:
        # no-store removed deliberately: see _not_modified. no-cache still forces
        # revalidation on every use, so freshness is unchanged.
        # 2026-10-12 MEASURED: the blanket no-cache made EVERY asset pay one
        # revalidation round-trip per fresh session — ~95 assets x 0.7 s RTT on
        # serveo even when nothing changed. Static assets (css/js/webp/svg/...)
        # get max-age=3600: a rebuild is seen within the hour, and within the
        # hour the browser pays ZERO revalidation round-trips. HTML pages and
        # dynamic routes keep no-cache so a rebuilt page is never served stale.
        _p = (self.path or "").split("?", 1)[0]
        if _p.endswith((".css", ".js", ".webp", ".jpg", ".jpeg", ".png", ".svg",
                        ".ico", ".woff", ".woff2", ".txt")):
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        # Advertise the ETag on every 200 -- including the paths that skip _serve_gzip
        # (robots.txt is below the gzip threshold and kept re-downloading without it).
        if getattr(self, "_status", None) == 200 and getattr(self, "_etag_value", None):
            self.send_header("ETag", self._etag_value)
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    # ---------------------------------------------------------------- filtri
    @staticmethod
    def _is_blocked(raw_path: str) -> bool:
        path = unquote(urlsplit(raw_path).path)
        low = path.lower()
        if low.startswith(BLOCKED_PREFIXES):
            return True
        if low in BLOCKED_EXACT:
            return True
        if low.startswith("/."):  # dotfile e directory nascoste
            return True
        if low.endswith(BLOCKED_SUFFIXES):
            return True
        return False

    def _deny(self) -> None:
        self.send_error(403, "Forbidden")

    def list_directory(self, path):  # type: ignore[override]
        """Nessun elenco di directory: 403 (prima enumerava dataset, log e backup)."""
        self.send_error(403, "Directory listing disabled")
        return None

    # ------------------------------------------------------ inoltro traduzione
    PROXY_TRAD = "/api/translate"

    def _proxy_trad(self) -> None:
        """Inoltra la richiesta di traduzione: la pagina chiama QUESTA origine.

        Perche' esiste: il client gratuito `gtx` di Google non manda gli header CORS,
        quindi il browser blocca la chiamata diretta dalla pagina (`net::ERR_FAILED`,
        misurato). Passando dal server, il vincolo del browser non si applica e la
        pagina vede una risposta della propria origine: nessun CORS da negoziare.
        """
        import urllib.error
        import urllib.request
        query = urlsplit(self.path).query
        if not query:
            return self.send_error(400, "query mancante")
        target = f"https://translate.googleapis.com/translate_a/single?{query}"
        # Tre tentativi con pausa crescente: l'upstream a volte non risponde, e su un
        # guasto transitorio la risposta giusta e' ritentare, non dichiarare subito il
        # 502 (i gate lo vedevano come errore JS in console e due prove cadevano).
        import time as _t
        corpo = None
        for tentativo in range(3):
            try:
                req = urllib.request.Request(target,
                                             headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    corpo = r.read()
                break
            except Exception as e:
                sys.stderr.write(f"[proxy-trad] tentativo {tentativo + 1} fallito: "
                                 f"{type(e).__name__}\n")
                if tentativo < 2:
                    _t.sleep(0.4 * (2 ** tentativo))
        if corpo is None:
            # DEGRADO CONTROLLATO, non una risposta finta: 200 con lista vuota significa
            # «nessuna traduzione disponibile», e la pagina resta in italiano. Un 502 qui
            # farebbe scrivere al browser un errore di rete che i gate leggono come guasto.
            # Il fallimento resta tracciabile: su stderr e in un header dedicato.
            sys.stderr.write("[proxy-trad] upstream non disponibile: rispondo lista vuota\n")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Translate-Upstream", "failed")
            corpo = b"[]"
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self) -> None:  # type: ignore[override]
        # La rotta di inoltro va servita PRIMA dei filtri: e' una rotta
        # funzionale, non un file del sito.
        if self.path.startswith(self.PROXY_TRAD):
            return self._proxy_trad()
        if self._is_blocked(self.path):
            return self._deny()
        # Conditional check for every path, including the ones gzip skips (robots.txt,
        # already-compressed binaries): an ETag that only worked on compressible files
        # would leave 1 of 12 resources re-downloading forever.
        try:
            _p = self.translate_path(self.path)
            if os.path.isdir(_p):
                _i = os.path.join(_p, "index.html")
                _p = _i if os.path.isfile(_i) else _p
            if os.path.isfile(_p):
                self._etag_value = self._etag_for(_p)
                if self._not_modified(_p):
                    return
        except Exception:
            pass
        # Compressione on-the-fly: il report di performance misurava 976 KB di
        # lookup-index.json trasferiti non compressi (nessun gzip, nessun ETag).
        if "gzip" in (self.headers.get("Accept-Encoding") or "").lower() and self._serve_gzip():
            return
        return super().do_GET()

    def _serve_gzip(self) -> bool:
        """Serve il file compresso se conviene. True = risposta già inviata."""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            idx = os.path.join(path, "index.html")
            if not os.path.isfile(idx):
                return False
            path = idx
        if not os.path.isfile(path) or not path.lower().endswith(COMPRESSIBLE):
            return False
        try:
            with open(path, "rb") as fh:
                raw = fh.read()
        except OSError:
            return False
        if len(raw) < MIN_GZIP_BYTES:
            return False
        if self._not_modified(path):
            return True
        body = gzip.compress(raw, 6)
        if len(body) >= len(raw):
            return False
        # NOTA: dalla Python 3.9 `SimpleHTTPRequestHandler.guess_type()` restituisce
        # la stringa del tipo (non la tupla `(type, encoding)`): usare `[0]` serviva
        # "t" come Content-Type e il browser rendeva l'HTML come testo.
        ctype = self.guess_type(path) or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("ETag", self._etag_for(path))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return True

    def do_HEAD(self) -> None:  # type: ignore[override]
        if self._is_blocked(self.path):
            return self._deny()
        try:
            _p = self.translate_path(self.path)
            if os.path.isdir(_p):
                _i = os.path.join(_p, "index.html")
                _p = _i if os.path.isfile(_i) else _p
            if os.path.isfile(_p):
                self._etag_value = self._etag_for(_p)
                if self._not_modified(_p):
                    return
        except Exception:
            pass
        return super().do_HEAD()

    def log_message(self, fmt: str, *args) -> None:
        """Log essenziale su stderr (acquisito da restart-site.sh in logs/origin-8777.log)."""
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class SingleBindServer(ThreadingHTTPServer):
    """Refuses to co-bind on a port another origin already holds.

    MEASURED DEFECT (2026-09-29): `http.server` sets `allow_reuse_address = 1`, so a
    restart that did not actually kill the previous process produced TWO listeners on
    127.0.0.1:8777 (netstat showed PIDs 21996 and 22924 simultaneously) and requests were
    served by whichever answered first -- the QA suite caught it as an intermittent missing
    header, not as an error. A second origin must fail loudly, never shadow the first.
    """

    allow_reuse_address = False
    daemon_threads = True


def _kill_previous_listener(port: int) -> None:
    """Kill whatever already listens on the port, by the PID netstat reports.

    Matching on the process command line is unreliable here: the launcher runs
    `python server.py <port>` with the cwd set to the site, so a cmdline filter for the
    site path never matches and the old origin survives. The listening socket is the
    authoritative identity.
    """
    try:
        out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=30).stdout
    except Exception:
        return
    pids = set()
    for line in out.splitlines():
        if "LISTENING" in line and f":{port} " in line:
            parts = line.split()
            if parts and parts[-1].isdigit():
                pids.add(parts[-1])
    for pid in pids:
        try:
            subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True, timeout=20)
            print(f"[rebind] killed previous listener PID {pid}", flush=True)
        except Exception as e:
            print(f"[rebind] could not kill {pid}: {e}", flush=True)
    if pids:
        time.sleep(1.5)


def main() -> None:
    """Avvia il server threading bound a 127.0.0.1 sulla porta data."""
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    _kill_previous_listener(port)
    handler = partial(HardenedHandler, directory=str(BASE))
    try:
        httpd = SingleBindServer(("127.0.0.1", port), handler)
    except OSError as e:
        print(f"FATAL: cannot bind 127.0.0.1:{port} ({e}). Refusing to co-bind.", flush=True)
        raise SystemExit(1)
    with httpd:
        print(f"ThreadingHTTPServer (hardened, single-bind) su 127.0.0.1:{port} serving {BASE}", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
