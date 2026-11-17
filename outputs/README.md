# Milver release outputs

`npm run outputs` generates `outputs/releases/v<version>/` for the checked-out commit.
`npm run outputs:current` generates the general product set in `outputs/current-state/`.
Open either folder's `index.html` to browse and download media. Requires FFmpeg on PATH.

Each bundle contains:

- `posts/x.md`, `posts/reddit.md`, `posts/linkedin.md`: English copy drafts. Never auto-posted.
- `media/`: 1600×900 landscape PNGs, 1080×1080 square PNGs, 1200×627 LinkedIn PNGs, source SVGs, 640×360 looping GIFs and 1280×720 H.264 MP4s.
- `examples/`: editable JSON projects used by the real Milver diagram renderer.
- `release.md`, `alt-text.md`, `manifest.json`: notes, accessibility descriptions, source SHA, version and media SHA-256 checksums.

Videos are four seconds long. Animated particles illustrate connections, not computed results. These are renderer-generated product illustrations, not browser screenshots. The current-state set covers the editor, arrows, shapes, JavaScript modules and JSON backups. Release sets use changed paths to choose related scenes and quote the actual commit subject; maintenance releases are identified as such. Review drafts before posting.

Versions are `<package major>.<package minor>.<package patch + first-parent commit count>`. Every additional commit on main increases the patch version. No bump commits are written back. Release tags identify the exact source SHA, and an existing tag is never moved to another commit.

The **Release outputs** workflow runs after a successful production build and tests, generates one bundle per new first-parent commit (including multi-commit pushes), and attaches a ZIP to a GitHub Release. The newest release includes a separate general current-state ZIP. CI artifacts are retained for 90 days; published Release ZIPs remain available until explicitly deleted. Reruns replace the same commit's files instead of creating duplicate tags. Generated binary media is ignored by Git, keeping application history small.

If media generation fails, the app deployment remains successful and the output job fails visibly. No social-network credentials or paid AI services are required. All current images and animations use the same SVG path, shape, port and arrow implementation as the app's export system.

Optional: `npm run outputs -- --stills-only` for a fast image-only local preview. CI always generates the full bundle.
