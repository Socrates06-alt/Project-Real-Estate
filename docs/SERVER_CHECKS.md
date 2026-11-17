# Server checks (live: landfinder.online)

How to check: `uptime; free -h; df -h /` and `systemctl status landfinder --no-pager | grep -E 'Memory|CPU'`.

| Date | Uptime | RAM used / total | RAM free | Swap used | App memory | Load | Response times | Disk |
|---|---|---|---|---|---|---|---|---|
| 17 Nov 2026 | 7 days | 1.1 GB / 1.9 GB | 147 MB (+ cache) | 9 MB of 2 GB | 862 MB (peak 863 MB) | 0.08 | health 0.05 s · config 0.04 s · listings 0.04 s | not checked yet |

Notes: the app's memory is mostly the meaning-search model (~0.8 GB). Fine on a 2 GB server; if swap use grows past a few hundred MB, move to 4 GB.
