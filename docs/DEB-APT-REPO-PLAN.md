# Plan: Host APT Repository on GitHub Pages

Host WhatsLNX DEB packages as an APT repository on GitHub Pages. AppImage stays on GitHub Releases (unchanged). Users install/upgrade DEB via `apt` instead of manual `dpkg -i`.

## Current State

- DEB + AppImage built via `electron-builder` (`npm run build`)
- Release workflow (`.github/workflows/release.yml`) publishes both to GitHub Releases on push to `main`
- No GitHub Pages configured yet
- No GPG signing key for APT repo

## Target State

- **AppImage**: GitHub Releases (unchanged, auto-update works)
- **DEB**: APT repository on GitHub Pages (`kmmuntasir.github.io/WhatsLNX`)
- Users run `apt install whatslnx` after one-time repo setup
- New versions auto-available via `apt upgrade`

---

## Task Classification

Tasks fall into three categories:

| Category | Symbol | Meaning |
|----------|--------|---------|
| **MANUAL** | `👤` | You must do this yourself (interactive, passphrase entry, decisions) |
| **CLI-AUTOMATED** | `🖥️` | AI agent can do this via `gh` CLI or git commands |
| **CODE CHANGE** | `📝` | Edit project files (workflow, README) |

---

## Phase 1: GPG Key Setup

### Step 1.1 — Generate GPG key pair `👤 MANUAL`

Interactive process. You must choose passphrase and enter it.

```bash
gpg --full-generate-key
```

Choose:
- Kind: RSA and RSA (default)
- Key size: 4096
- Expiration: 0 (no expiry)
- Real name: `WhatsLNX Release Key`
- Email: `kmmuntasir@gmail.com`
- Passphrase: strong, memorable — **save this, you'll need it**

### Step 1.2 — Export keys `👤 MANUAL`

```bash
# Private key (for CI signing)
gpg --armor --export-secret-keys kmmuntasir@gmail.com > private.key

# Public key (for repo + user verification)
gpg --armor --export kmmuntasir@gmail.com > public.key
```

### Step 1.3 — Commit public key to repo `🖥️ CLI-AUTOMATED`

```bash
mv public.key whatslnx-archive-keyring.gpg
git add whatslnx-archive-keyring.gpg
git commit -m "Add APT repository public key"
```

Can also be done via agent editing the file and committing.

### Step 1.4 — Add GitHub repository secrets `🖥️ CLI-AUTOMATED`

**Old way (manual):** Go to Settings > Secrets and variables > Actions > New repository secret.

**New way (`gh` CLI):**

```bash
# Set GPG private key (reads from file, preserves newlines)
gh secret set GPG_PRIVATE_KEY < private.key

# Set passphrase (prompted securely, not echoed)
gh secret set GPG_PASSPHRASE
# Then type/paste your passphrase at the prompt

# Verify secrets exist (values hidden)
gh secret list
```

Expected output:
```
GPG_PASSPHRASE   Updated 2026-05-26
GPG_PRIVATE_KEY  Updated 2026-05-26
```

**After secrets are saved**, securely delete the private key:

```bash
shred -u private.key
```

---

## Phase 2: GitHub Pages Configuration

### Step 2.1 — Enable GitHub Pages `🖥️ CLI-AUTOMATED`

**Old way (manual):** Go to repo Settings > Pages > Source > GitHub Actions.

**New way (`gh` API):**

```bash
# Check current Pages status
gh api repos/kmmuntasir/WhatsLNX/pages 2>/dev/null || echo "Pages not enabled"

# Enable GitHub Pages with GitHub Actions as the source
gh api repos/kmmuntasir/WhatsLNX/pages \
  --method POST \
  -f build_type=workflow \
  --silent

# Verify it's enabled
gh api repos/kmmuntasir/WhatsLNX/pages --jq '.build_type'
# Expected: "workflow"
```

If the repo hasn't had Pages enabled before, you may need to activate it first:

```bash
# First-time activation (creates Pages site)
gh api repos/kmmuntasir/WhatsLNX/pages \
  --method POST \
  -f source.branch=main \
  -f source.path=/ \
  --silent

# Then switch to Actions-only deployment
gh api repos/kmmuntasir/WhatsLNX/pages \
  --method PUT \
  -f build_type=workflow \
  --silent
```

### Step 2.2 — Verify Pages permissions `🖥️ CLI-AUTOMATED`

```bash
# Check if GitHub Pages is accessible
gh api repos/kmmuntasir/WhatsLNX/pages --jq '.html_url'
# Expected: https://kmmuntasir.github.io/WhatsLNX/
```

---

## Phase 3: Update Release Workflow `📝 CODE CHANGE`

### Step 3.1 — Modify `.github/workflows/release.yml`

Current workflow builds and publishes to GitHub Releases. Add APT repo deployment steps after the build.

**Key changes:**

1. Add `pages: write` and `id-token: write` permissions
2. After `npm run build`, add steps to:
   - Import GPG key
   - Checkout existing `gh-pages` branch (preserve previous packages)
   - Move new `.deb` into APT repo structure (`pool/main/`)
   - Run `dpkg-scanpackages` to generate `Packages` file
   - Run `apt-ftparchive release` to generate `Release` file
   - GPG-sign `Release` → `Release.gpg` + `InRelease`
   - Deploy to GitHub Pages

**APT repo directory structure:**

```
gh-pages branch root:
├── whatslnx-archive-keyring.gpg
├── pool/
│   └── main/
│       ├── whatslnx_0.1.0_amd64.deb
│       └── whatslnx_0.1.1_amd64.deb   # accumulates over time
└── dists/
    └── stable/
        └── main/
            └── binary-amd64/
                ├── Packages
                ├── Packages.gz
                ├── Release
                ├── Release.gpg
                └── InRelease
```

**Strategy for preserving old packages:** Checkout `gh-pages` branch first, copy new `.deb` into existing `pool/main/`, regenerate metadata. This lets `apt` see all published versions and users can pin if needed.

### Step 3.2 — Updated workflow

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - name: Build and publish to GitHub Releases
        run: npm run build -- --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Import GPG Key
        uses: crazy-max/ghaction-import-gpg@v6
        with:
          gpg_private_key: ${{ secrets.GPG_PRIVATE_KEY }}
          passphrase: ${{ secrets.GPG_PASSPHRASE }}

      - name: Checkout gh-pages branch
        uses: actions/checkout@v6
        with:
          ref: gh-pages
          path: gh-pages
        continue-on-error: true  # branch may not exist on first run

      - name: Build APT repository
        run: |
          # Initialize structure (preserve existing if present)
          mkdir -p apt-repo/pool/main
          mkdir -p apt-repo/dists/stable/main/binary-amd64

          # Copy existing packages from gh-pages (if any)
          if [ -d gh-pages/pool/main ]; then
            cp gh-pages/pool/main/*.deb apt-repo/pool/main/ 2>/dev/null || true
          fi

          # Copy public key
          cp whatslnx-archive-keyring.gpg apt-repo/

          # Copy new .deb (overwrite if same version)
          cp dist/*.deb apt-repo/pool/main/

          # Generate Packages
          cd apt-repo
          dpkg-scanpackages --arch amd64 pool/ > dists/stable/main/binary-amd64/Packages
          gzip -kf dists/stable/main/binary-amd64/Packages

          # Generate Release
          cd dists/stable
          apt-ftparchive release . > Release

          # Sign Release
          gpg --default-key kmmuntasir@gmail.com \
              --armor --detach-sign --sign --output Release.gpg Release
          gpg --default-key kmmuntasir@gmail.com \
              --clearsign --output InRelease Release

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./apt-repo
          publish_branch: gh-pages
```

> **Note:** Using `peaceiris/actions-gh-pages` instead of the official Pages actions because it handles the `gh-pages` branch natively and preserves history.

---

## Phase 4: Update README.md `📝 CODE CHANGE`

### Step 4.1 — Update DEB install instructions

Replace the current manual `dpkg` instructions with APT repo setup:

```markdown
### DEB (Ubuntu/Debian/Linux Mint)

**One-time setup:**
```bash
# Add the repository signing key
curl -fsSL https://kmmuntasir.github.io/WhatsLNX/whatslnx-archive-keyring.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/whatslnx-archive-keyring.gpg

# Add the repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/whatslnx-archive-keyring.gpg] \
  https://kmmuntasir.github.io/WhatsLNX stable main" \
  | sudo tee /etc/apt/sources.list.d/whatslnx.list

# Update package index
sudo apt update
```

**Install:**
```bash
sudo apt install whatslnx
```

**Upgrade (when new versions are published):**
```bash
sudo apt update && sudo apt upgrade whatslnx
```

**Uninstall:**
```bash
sudo apt remove whatslnx

# Optional: remove the repository
sudo rm /etc/apt/sources.list.d/whatslnx.list
sudo rm /usr/share/keyrings/whatslnx-archive-keyring.gpg
sudo apt update
```
```

### Step 4.2 — Keep AppImage section unchanged

AppImage still downloads from GitHub Releases. No changes needed.

### Step 4.3 — Update auto-update note

Current: "Auto-Update — AppImage releases update automatically (via GitHub Releases)"

Keep as-is. DEB updates via `apt upgrade`, AppImage via electron-updater.

---

## Phase 5: electron-builder.yml — No Changes Needed

AppImage and DEB targets stay as-is. The release workflow handles publishing to both GitHub Releases (AppImage) and GitHub Pages (DEB). The `publish` config continues to work for AppImage auto-updates.

---

## Phase 6: Verify End-to-End `🖥️ CLI-AUTOMATED`

### Step 6.1 — Monitor the workflow run

After merging to `main`, watch the release workflow:

```bash
# List recent workflow runs
gh run list --workflow=release.yml --limit 3

# Watch the latest run in real-time
gh run watch

# Check if deployment succeeded
gh run view --log-failed  # show failed steps only
```

### Step 6.2 — Verify GitHub Pages deployment

```bash
# Check Pages deployment status
gh api repos/kmmuntasir/WhatsLNX/pages/deployments --jq '.[0] | {status: .status, created_at: .created_at}'

# Verify the APT repo files are accessible
curl -sI https://kmmuntasir.github.io/WhatsLNX/dists/stable/main/binary-amd64/Packages
# Expected: HTTP 200

curl -sI https://kmmuntasir.github.io/WhatsLNX/whatslnx-archive-keyring.gpg
# Expected: HTTP 200

# Check InRelease signature
curl -sL https://kmmuntasir.github.io/WhatsLNX/dists/stable/InRelease | gpg --verify
# Expected: Good signature from "WhatsLNX Release Key"
```

### Step 6.3 — Verify DEB is in the Packages index

```bash
# Download and inspect Packages file
curl -sL https://kmmuntasir.github.io/WhatsLNX/dists/stable/main/binary-amd64/Packages

# Should contain entry like:
# Package: whatslnx
# Version: 0.1.0
# Architecture: amd64
# ...
```

### Step 6.4 — Test install on clean system `👤 MANUAL`

Requires a real Ubuntu/Debian system or container:

```bash
# One-time repo setup
curl -fsSL https://kmmuntasir.github.io/WhatsLNX/whatslnx-archive-keyring.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/whatslnx-archive-keyring.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/whatslnx-archive-keyring.gpg] \
  https://kmmuntasir.github.io/WhatsLNX stable main" \
  | sudo tee /etc/apt/sources.list.d/whatslnx.list

sudo apt update
sudo apt install whatslnx
```

### Step 6.5 — Test upgrade flow `👤 MANUAL`

1. Install version N
2. Push new version to `main` (triggers release workflow)
3. `gh run watch` to wait for completion
4. `sudo apt update && sudo apt upgrade whatslnx`
5. Confirm version N+1 is installed

---

## Execution Order (Summary)

| # | Task | Type | Depends On | Tool |
|---|------|------|------------|------|
| 1 | Generate GPG key pair | `👤` Manual | — | `gpg` |
| 2 | Export keys | `👤` Manual | 1 | `gpg` |
| 3 | Commit public key to repo | `🖥️` CLI | 2 | `git` |
| 4 | Set GitHub secrets | `🖥️` CLI | 2 | `gh secret set` |
| 5 | Delete local private key | `🖥️` CLI | 4 | `shred` |
| 6 | Enable GitHub Pages | `🖥️` CLI | — | `gh api` |
| 7 | Update `release.yml` with APT repo steps | `📝` Code | 3, 4, 6 | editor |
| 8 | Update `README.md` with APT instructions | `📝` Code | 7 | editor |
| 9 | Commit and merge to `main` | `🖥️` CLI | 7, 8 | `git` |
| 10 | Monitor workflow run | `🖥️` CLI | 9 | `gh run watch` |
| 11 | Verify Pages deployment | `🖥️` CLI | 10 | `gh api` + `curl` |
| 12 | Test install on clean system | `👤` Manual | 11 | `apt` |
| 13 | Test upgrade flow | `👤` Manual | 12 | `apt` + `gh` |

---

## `gh` CLI Quick Reference

Commands used in this plan:

| Command | Purpose |
|---------|---------|
| `gh secret set NAME < file` | Set repo secret from file contents |
| `gh secret set NAME` | Set repo secret (prompted interactively) |
| `gh secret list` | List repo secret names |
| `gh api repos/OWNER/REPO/pages --method POST -f build_type=workflow` | Enable Pages with Actions source |
| `gh api repos/OWNER/REPO/pages --jq '.html_url'` | Check Pages URL |
| `gh api repos/OWNER/REPO/pages/deployments` | Check deployment status |
| `gh run list --workflow=release.yml --limit 3` | List recent workflow runs |
| `gh run watch` | Watch latest run in real-time |
| `gh run view --log-failed` | Show failed step logs |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| GPG key compromised | Key is repo-specific. Rotate: generate new key, `gh secret set` to update, repo metadata regenerates on next release. |
| GitHub Pages downtime | Rare. APT retries on `apt update`. Users can still download `.deb` directly from GitHub Releases. |
| Large `.deb` files (~90MB) filling repo | GitHub Pages has 1GB soft limit. ~10 versions = ~900MB. Add cleanup step to keep last N versions in `pool/main/`. |
| `apt-ftparchive` not available in CI | It's in `apt-utils`, pre-installed on `ubuntu-latest`. Fallback: `dpkg-scanpackages` alone (works but no `Release` file signing). |
| First deployment — no `gh-pages` branch yet | `continue-on-error: true` on checkout step handles this. Fresh structure created. |

---

## Future Improvements (Out of Scope)

- **ARM64 support**: Add `arm64` build target, create `binary-arm64` in dists
- **Automatic old version cleanup**: Keep only last 3 `.deb` files in `pool/main/`
- **Repository metadata CDN**: GitHub Pages already uses Fastly CDN
- **APT pinning docs**: Document how users can pin specific versions
- **Release signing verification**: Add `gpg --verify` step to CI for sanity check
