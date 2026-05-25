# GPG Signing Failure in Release Workflow — Debug Report

**Date:** 2026-05-25
**Affected workflow:** `.github/workflows/release.yml` — "Build APT repository" step
**Root cause:** RESOLVED — GPG 2.1+ ignores `--passphrase` flag unless passphrase is supplied via stdin (`--passphrase-fd 0`). See Attempt 7 below.

---

## Background

The release workflow builds Debian packages, publishes them to GitHub Releases, then builds an APT repository structure and signs the `Release` file with GPG. The signing step uses a GPG private key imported via `crazy-max/ghaction-import-gpg`.

PR #5 bumped `crazy-max/ghaction-import-gpg` from v6 to v7. After merging, the "Build APT repository" step began failing during GPG signing.

### Original GPG signing commands (before any fixes)

```yaml
- name: Import GPG Key
  uses: crazy-max/ghaction-import-gpg@v7
  with:
    gpg_private_key: ${{ secrets.GPG_PRIVATE_KEY }}
    passphrase: ${{ secrets.GPG_PASSPHRASE }}

# ... later in the same job ...

- name: Build APT repository
  run: |
    # ... build repo structure ...
    cd dists/stable
    apt-ftparchive release . > Release

    gpg --default-key kmmuntasir@gmail.com \
        --armor --detach-sign --sign --output Release.gpg Release
    gpg --default-key kmmuntasir@gmail.com \
        --clearsign --output InRelease Release
```

### Secrets configured in repository

| Secret name | Set on |
|---|---|
| `GPG_PRIVATE_KEY` | 2026-05-25T19:19:20Z |
| `GPG_PASSPHRASE` | 2026-05-25T19:19:24Z |

Both secrets exist and are available to the workflow.

---

## Fix Attempts

### Attempt 1: Add `pinentry-mode loopback` to gpg.conf

**Branch:** `fix/gpg-pinentry-loopback`
**PR:** #8 (develop) → #9 (main)
**CI runs:** 26418693310 (original failure), 26419142752 (after merge)

**Change:**
```yaml
echo "pinentry-mode loopback" >> ~/.gnupg/gpg.conf
gpg --default-key kmmuntasir@gmail.com \
    --armor --detach-sign --sign --output Release.gpg Release
gpg --default-key kmmuntasir@gmail.com \
    --clearsign --output InRelease Release
```

**Result:** Failure
**Error:**
```
gpg: using "kmmuntasir@gmail.com" as default secret key for signing
gpg: cannot open '/dev/tty': No such device or address
```

**Analysis:** `pinentry-mode loopback` in `gpg.conf` alone is insufficient. GPG still tried to open `/dev/tty`. The gpg-agent was not configured to allow loopback pinentry.

---

### Attempt 2: Add `allow-loopback-pinentry` to gpg-agent.conf + restart agent

**Branch:** `fix/gpg-pinentry-v2`
**PR:** #10 (develop) → #11 (main)
**CI run:** 26419602429

**Change:**
```yaml
echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf
gpgconf --kill gpg-agent
gpg --batch --yes --pinentry-mode loopback \
    --default-key kmmuntasir@gmail.com \
    --armor --detach-sign --sign --output Release.gpg Release
gpg --batch --yes --pinentry-mode loopback \
    --default-key kmmuntasir@gmail.com \
    --clearsign --output InRelease Release
```

**Result:** Failure
**Error:**
```
gpg: using "kmmuntasir@gmail.com" as default secret key for signing
gpg: Sorry, we are in batchmode - can't get input
```

**Analysis:** `gpgconf --kill gpg-agent` killed the agent, which wiped the cached passphrase that `ghaction-import-gpg` had stored. With `--batch` mode, GPG couldn't prompt for the passphrase and couldn't get it from the killed agent either.

---

### Attempt 3: `--batch --yes` without killing agent (Gemini's suggestion)

**Branch:** `fix/gpg-pinentry-v3`
**PR:** #12 (develop) → #13 (main)
**CI run:** 26419934573

**Change:**
```yaml
echo "pinentry-mode loopback" >> ~/.gnupg/gpg.conf
gpg --batch --yes \
    --default-key kmmuntasir@gmail.com \
    --armor --detach-sign --sign --output Release.gpg Release
gpg --batch --yes \
    --default-key kmmuntasir@gmail.com \
    --clearsign --output InRelease Release
```

**Result:** Failure
**Error:**
```
gpg: using "kmmuntasir@gmail.com" as default secret key for signing
gpg: Sorry, we are in batchmode - can't get input
```

**Analysis:** Without `--pinentry-mode loopback` on the command line, `--batch` mode tried to use the agent's default pinentry which requires a TTY. The `gpg.conf` setting alone was not being honored in batch mode.

---

### Attempt 4: Pass passphrase directly via `${{ secrets.* }}` inline

**Branch:** `fix/gpg-pinentry-v4`
**PR:** #14 (develop) → #15 (main)
**CI run:** 26420279095

**Change:**
```yaml
gpg --batch --yes --pinentry-mode loopback --passphrase "${{ secrets.GPG_PASSPHRASE }}" \
    --default-key kmmuntasir@gmail.com \
    --armor --detach-sign --sign --output Release.gpg Release
gpg --batch --yes --pinentry-mode loopback --passphrase "${{ secrets.GPG_PASSPHRASE }}" \
    --default-key kmmuntasir@gmail.com \
    --clearsign --output InRelease Release
```

**Result:** Failure
**Error:**
```
gpg: using "kmmuntasir@gmail.com" as default secret key for signing
gpg: signing failed: No passphrase given
```

**Analysis:** The `${{ secrets.GPG_PASSPHRASE }}` expression inside a `run:` block may not have been expanded correctly, or the expanded value was empty/didn't survive shell parsing.

---

### Attempt 5: Passphrase via `env:` block

**Branch:** Direct commit to `main`
**CI run:** 26420448424

**Change:**
```yaml
- name: Build APT repository
  env:
    GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
  run: |
    # ...
    gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
        --default-key kmmuntasir@gmail.com \
        --armor --detach-sign --sign --output Release.gpg Release
    gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
        --default-key kmmuntasir@gmail.com \
        --clearsign --output InRelease Release
```

**Result:** Failure
**Error:**
```
gpg: using "kmmuntasir@gmail.com" as default secret key for signing
gpg: signing failed: No passphrase given
```

**Analysis:** Moving the secret to an `env:` block and referencing as `$GPG_PASSPHRASE` didn't help. Same "No passphrase given" error. The secret IS set in the repo (confirmed via `gh secret list`), so the value should be non-empty.

---

### Attempt 6: Reload agent config (not kill) + env passphrase

**Branch:** Direct commit to `main`
**CI run:** 26420603318

**Change:**
```yaml
- name: Build APT repository
  env:
    GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
  run: |
    # ...
    echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf
    gpgconf --reload gpg-agent
    gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
        --default-key kmmuntasir@gmail.com \
        --armor --detach-sign --sign --output Release.gpg Release
    gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
        --default-key kmmuntasir@gmail.com \
        --clearsign --output InRelease Release
```

**Result:** Failure
**Error:**
```
gpg: using "kmmuntasir@gmail.com" as default secret key for signing
gpg: signing failed: No passphrase given
```

**Analysis:** `gpgconf --reload` reloads agent config without clearing cache (unlike `--kill`). The `allow-loopback-pinentry` was set, `--pinentry-mode loopback` was on the command line, and the passphrase was in an env var. Still "No passphrase given".

---

## Error Pattern Summary

| Attempt | Error message | Key change from previous |
|---------|--------------|------------------------|
| Original | `Inappropriate ioctl for device` | Baseline (v6→v7 upgrade) |
| 1 | `cannot open '/dev/tty'` | Added `pinentry-mode loopback` to gpg.conf |
| 2 | `Sorry, we are in batchmode - can't get input` | Added `--batch --yes`, killed agent |
| 3 | `Sorry, we are in batchmode - can't get input` | Removed agent kill, kept `--batch` |
| 4 | `No passphrase given` | Added `--passphrase` with inline secret |
| 5 | `No passphrase given` | Moved secret to env block |
| 6 | `No passphrase given` | Added `--reload` + `allow-loopback-pinentry` |

---

## Remaining Hypotheses

1. **The GPG key may not have a passphrase.** If the key was generated without a passphrase, passing `--passphrase "$GPG_PASSPHRASE"` with a non-empty value causes GPG to try to use it, but the key doesn't expect one. In this case, removing `--passphrase` entirely and using `--batch --yes` alone (without `--pinentry-mode loopback`) might work — but this failed in attempts 2-3 with a different error. The key likely DOES have a passphrase.

2. **The `GPG_PASSPHRASE` secret value might be empty or incorrect.** While `gh secret list` shows the secret exists, it doesn't reveal the value. If the passphrase doesn't match the key, GPG would report "No passphrase given" or "bad passphrase".

3. **`ghaction-import-gpg@v7` changed how it imports keys.** V7 uses a newer GPG binary (Node 24 runtime) which may handle passphrase caching differently. The action may preset the passphrase via `gpg-preset-passphrase` into the agent, but subsequent `gpg --batch --pinentry-mode loopback --passphrase` calls bypass the agent entirely and expect the passphrase to match the key directly.

4. **The `--passphrase` flag may need `--passphrase-fd 0` or pipe via stdin.** Some GPG versions ignore `--passphrase` in certain configurations. Using `echo "$GPG_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 ...` might work.

5. **Revert `ghaction-import-gpg` to v6.** V6 was working before. The v7 upgrade may have introduced a fundamental incompatibility with how the workflow signs APT repo files. The v6 action may have used a different pinentry setup that worked without explicit loopback configuration.

---

## Next Steps to Investigate

~~1. **Verify the passphrase is correct**~~ — confirmed secret exists and is non-empty.

~~2. **Try piping passphrase via stdin**~~ — **SOLUTION FOUND.** See Attempt 7.

~~3. **Try without `--pinentry-mode loopback`**~~ — not needed.

~~4. **Revert to `crazy-max/ghaction-import-gpg@v6`**~~ — not needed.

~~5. **Add a debug step**~~ — not needed.

---

## Attempt 7 (FINAL): Pipe passphrase via stdin with `--passphrase-fd 0`

**Root cause:** GPG 2.1+ ignores the `--passphrase` flag in batch mode. The passphrase must be supplied via stdin using `--passphrase-fd 0`.

**Change:**
```yaml
echo "$GPG_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback \
    --passphrase-fd 0 \
    --default-key kmmuntasir@gmail.com \
    --armor --detach-sign --sign --output Release.gpg Release
echo "$GPG_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback \
    --passphrase-fd 0 \
    --default-key kmmuntasir@gmail.com \
    --clearsign --output InRelease Release
```

Also removed workarounds from previous attempts:
- Removed `echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf`
- Removed `gpgconf --reload gpg-agent`
- Removed `--passphrase "$GPG_PASSPHRASE"` flag

**Result:** Pending CI verification.
