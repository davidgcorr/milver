# Milver release outputs

`npm run outputs` generates `outputs/releases/v<version>/` for the checked-out commit.
`npm run outputs:current` generates the general product set in `outputs/current-state/`.
Open either folder's `index.html` to browse and download media. Requires FFmpeg on PATH and an isolated Chromium installation (`npx playwright install chromium`).

Each bundle contains:

- `posts/x.md`, `posts/reddit.md`, `posts/linkedin.md`: English copy drafts. Never auto-posted.
- `media/`: 1600×900 landscape PNGs, 1080×1080 square PNGs, 1200×627 LinkedIn PNGs, source SVGs, 1280×720 real browser screenshots, raw WebM captures, 640×360 looping GIFs and 1280×720 H.264 MP4s at 30 fps.
- `examples/`: editable JSON projects loaded into the real app for the recordings.
- `release.md`, `alt-text.md`, `manifest.json`: notes, accessibility descriptions, source SHA, version and media SHA-256 checksums.

Videos are genuine Chromium screen recordings of the running Milver app, including sandboxed JavaScript renderers. Before saving a clip, the recorder changes an input from 2 to 3 to 5 and checks that an imported ES module updates the connected output from 4 to 6 to 10. It then performs feature-specific UI interactions: editing a curve, changing a Bézier outline, inspecting module source, or opening the complete project JSON. Startup/loading frames are trimmed. GIFs are converted from those same recordings, never from synthesized diagram frames. Recordings and runtime assertions are documented in `manifest.recordings`; a failed live output check fails the job instead of substituting an illustration.

Static editorial illustrations remain available separately. The offline HTML gallery is rendered using the repository’s actual shadcn Card, Button and Badge components, with a black/white/gray light/dark palette and copy buttons for drafts. X gets a concise product hook and demo; Reddit gets useful context and a specific feedback question; LinkedIn gets a practical story and insight. Release numbers, commit IDs and maintenance subjects stay in the provenance files, not the social posts. No reach or engagement is fabricated or guaranteed. Drafts are never auto-posted.

Versions are `<package major>.<package minor>.<package patch + first-parent commit count>`. Every additional commit on main increases the patch version. No bump commits are written back. Release tags identify the exact source SHA, and an existing tag is never moved to another commit.

The **Release outputs** workflow runs after a successful production build and tests, generates one bundle per new first-parent commit (including multi-commit pushes), and attaches a ZIP to a GitHub Release. The newest release includes a separate general current-state ZIP. CI artifacts are retained for 90 days; published Release ZIPs remain available until explicitly deleted. Reruns replace the same commit's files instead of creating duplicate tags. Generated binary media is ignored by Git, keeping application history small.

If media generation fails, the app deployment remains successful and the output job fails visibly. No social-network credentials or paid AI services are required. The media job installs Chromium in CI. Local capture uses a fresh browser profile and temporary local server; it never accesses your normal Chrome profile. Browser recordings capture the actual running UI; only the optional still illustrations use the SVG export renderer.

Optional: `npm run outputs -- --stills-only` for a fast image-only local preview. CI always generates the full bundle.
