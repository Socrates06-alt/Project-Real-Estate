# Put LandFinder online (AWS Lightsail, Mumbai)

About 1 hour, done once. Everything runs on one small server: the web app, the API, the SQLite database
and photos. HTTPS (the padlock) is free and automatic.

You need: a domain (e.g. `landfinder.in`), an AWS account, and a debit/credit card with online payments on.

---

## 1. Create the server (15 min)

1. Open https://lightsail.aws.amazon.com → **Create instance**.
2. Region: **Mumbai (ap-south-1)**.
3. Platform **Linux/Unix** → Blueprint **OS Only → Ubuntu 24.04 LTS**.
4. Plan: **2 GB RAM** (about $12/month).
5. Turn on **Automatic snapshots** (daily backups of the whole server).
6. Name it `landfinder` → **Create instance**.
7. **Networking** tab → **Create static IP** → attach it to `landfinder`. Note the IP (e.g. `13.233.10.20`).
8. Same tab, **IPv4 Firewall**: make sure **SSH (22), HTTP (80), HTTPS (443)** are allowed. Add HTTPS if missing.

## 2. Point your domain to the server (5 min, then wait)

At your domain seller (GoDaddy / Hostinger / Namecheap) → **DNS settings**, add:

| Type | Name | Value |
|---|---|---|
| A | `@` | your static IP |
| A | `www` | your static IP |

It can take from a few minutes to a few hours to start working. Check with https://dnschecker.org.

## 3. Open the server's terminal

In Lightsail, click your instance → **Connect using SSH**. A black terminal opens in the browser.
Everything below is typed (or pasted) there. Paste with **Ctrl+Shift+V** or right-click.

## 4. Let the server read the code from GitHub

The repo is private, so the server gets its own **read-only key**:

```bash
sudo ssh-keygen -t ed25519 -N "" -f /root/.ssh/landfinder_deploy -C landfinder-server && sudo cat /root/.ssh/landfinder_deploy.pub
```

Copy the line it prints (`ssh-ed25519 ...`). On GitHub: repo → **Settings → Deploy keys → Add deploy key** →
title `landfinder-server`, paste the key, leave **Allow write access** off → **Add key**.

## 5. Install LandFinder (10 min)

Copy the code to the server (the code from `main`):

```bash
sudo GIT_SSH_COMMAND="ssh -i /root/.ssh/landfinder_deploy -o StrictHostKeyChecking=accept-new" git clone git@github.com:Socrates06-alt/Project-Real-Estate.git /opt/landfinder
```

Run the setup (replace `landfinder.in` if your domain is different):

```bash
sudo bash /opt/landfinder/deploy/setup.sh landfinder.in
```

The first run stops and asks you to fill in the settings:

```bash
sudo nano /opt/landfinder/backend/.env
```

Fill in:

- `ADMIN_PASSWORD`, `ADMIN_PASSWORD_2`: **each founder's own password**, 12+ characters
  (e.g. `mango-river-lantern-42`). Never reuse a password from email or banking.
- `CONTACT_PHONE`, `CONTACT_WHATSAPP`: your real numbers, e.g. `+919847012345`.
- `RERA_NUMBER`: if you have one (you can add it later).

Save: **Ctrl+O**, Enter, **Ctrl+X**. Then run the setup again:

```bash
sudo bash /opt/landfinder/deploy/setup.sh landfinder.in
```

It ends with **"Done. Open https://landfinder.in"**. The server refuses to start if a password is weak or
the phone number is still the sample one; the message says what to fix.

## 6. Check it (10 min)

On your phone, open your site and test:

- [ ] Home page loads with the padlock (https)
- [ ] Sell: submit a test property with photos
- [ ] `/admin`: log in (both founders' passwords), publish the test property
- [ ] It shows on the home page; search, map, share and "Request visit" work
- [ ] Call and WhatsApp buttons open your real number
- [ ] Mark the test property **Not listed**, so buyers don't see it

Test on both an Android phone and an iPhone if you can.

---

## Every day after

**Put new changes live** (after we push code to GitHub):

```bash
sudo /opt/landfinder/deploy/update.sh
```

It backs up first, pulls the code, rebuilds and restarts. The site is down for only a few seconds.

**Backups** happen automatically:

- Daily at 2:30 am: database + photos → `/var/backups/landfinder` (last 14 days kept).
- Daily Lightsail snapshot of the whole server (step 1).

Backup now: `sudo /opt/landfinder/deploy/backup.sh` · List backups: `ls /var/backups/landfinder`

**Restore a backup** (e.g. after a mistake):

```bash
sudo /opt/landfinder/deploy/restore.sh 2026-11-20_0230
```

The current data is kept aside first, so nothing is lost. Try a restore once after launch, so you know it works.

**If something is wrong:**

| Problem | Check |
|---|---|
| Site not opening | `sudo systemctl status caddy landfinder` |
| Backend errors | `sudo journalctl -u landfinder -n 50` |
| Padlock / HTTPS error | Domain must point to the server (step 2); then `sudo systemctl restart caddy` |
| Server full or slow | Lightsail → instance → **Metrics** |

**Change a password:** edit `/opt/landfinder/backend/.env`, then `sudo systemctl restart landfinder`.
Everyone is signed out of admin.

---

## What's where on the server

| Path | What |
|---|---|
| `/opt/landfinder` | The code (from GitHub) |
| `/opt/landfinder/backend/.env` | Settings and passwords (private) |
| `/var/lib/landfinder` | **Your data**: database + photos |
| `/var/backups/landfinder` | Daily backups |
| `/etc/caddy/Caddyfile` | Web server (HTTPS) settings |

Security in place: HTTPS only, firewall (web + SSH only), admin login limited to 10 wrong tries per
15 minutes, API docs hidden, the backend reachable only through the web server, and seller originals and
the database never served publicly.
