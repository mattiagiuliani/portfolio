# MG Universe — portfolio identity

The interface uses Mattia's supplied social portrait as its primary identity,
with a dark editorial layout and electric-blue accents. Projects precede the
personal film; anime artwork is confined to the personal section. Existing
admin-managed copy, projects and posts still arrive via server rendering/ISR.

## Assets

All runtime assets live in `frontend/portfolio/public/brand/`:

- `mattia-profile.webp`: supplied profile portrait, unchanged composition.
- `mg-universe-poster.webp`: supplied anime studio image, unchanged composition.
- `mg-logo.webp`: raster recreation of the supplied white/blue MG monogram.
- `mattia-ares.webp`: generated transparent illustration based on both references.
- `mg-universe.webm`: preferred VP9/Opus delivery for browsers and embedded previews
  without AAC support. Encoded from the original with the same three-second trim.
  The player falls back to MP4 when WebM VP9/Opus is unsupported.
- `mg-universe.mp4`: web delivery copy of the supplied episode, 50.6 seconds after removing the first three seconds,
  original framing retained and audio trimmed in sync. H.264/AAC, fast-start, 48 kHz stereo.
  Approximately 13.45 MB versus the 28.83 MB input. This is lossy web compression,
  with the opening mouth movement removed: playback starts with the avatar turned toward the monitors.
  Source files in Downloads were not modified.

PNG sources from generation remain in the tool's generated-images directory;
the selected images were copied into the workspace and converted to WebP for
delivery, preserving transparency. The logo is a reference-based raster
recreation, not a claim to possess the original vector master.

## Visual system

- Background `#05070c`; surfaces `#0b101b` / `#111a2b`.
- Primary blue `#1769ff`; readable blue text `#70a8ff`.
- Main text `#edf1f8`; secondary text `#98a6bd`.
- Geist typography, monospaced captions, restrained borders and hover responses.
- The real portrait leads the hero. The anime Mattia/Ares illustration appears
  in About, with a keyboard-accessible disclosure introducing Ares.
- MG mark appears in navigation and footer; the branded film forms a dedicated
  portrait-format window immediately after selected projects.

## Film behavior

The video does not download on initial load while its player is outside the
viewport. When at least 25% of the player enters view, it loads and loops muted.
Sound requires the explicit Sound on action; browsers can block audible autoplay.
The audio starts at 45% volume and can be muted again independently of playback.
Play/pause, seeking and opening the complete film are available.

Leaving the player or hiding the browser tab pauses playback. A manual pause
survives scrolling. Reduced-motion and data-saver preferences disable automatic
loading/playback; explicit play remains available. With JavaScript disabled the
poster and direct film link still work. There is no fabricated speech transcript.

## Asset generation provenance

Mode: built-in image_gen, with local reference paths for both source images.
Final prompts used:

### Mattia and Ares

> Use case: identity-preserve. Asset: professional personal portfolio illustration,
> actual transparent background PNG. Extract and faithfully recreate the anime
> Mattia and his tabby cat Ares from reference image 2, using reference 1 to preserve
> Mattia's real facial identity. Single beautifully rendered anime editorial
> illustration: waist-up Mattia, same voluminous brown curls, hazel eyes, small hoop
> earring, black hoodie, calm confident expression, forearms gently around sleeping
> Ares in front of him. Ares must match the brown-and-black striped fluffy tabby with
> white muzzle from reference 2. Preserve character style and recognizable likeness.
> Restrained electric blue rimlight #0866FF and natural warm skin, detailed clean
> edges. Hoodie may have the same small white-and-blue MG emblem as reference. Both
> characters fully within canvas with generous transparent margin, no crop of hair
> or cat ears/paws. Composition compact almost square, suited to a 400px website
> card. No scenery, no desk, no words, no new symbols. Genuine transparent
> background, not black or checkerboard.

### MG monogram

> Use case: background-extraction. Asset: existing MG logo for a professional
> personal portfolio navbar. Precisely extract and reproduce ONLY the flat
> geometric MG monogram visible to the left of the face in the reference photo.
> Preserve the exact reference letter silhouette and proportions: angular white
> M with diagonal upper-right arm flowing toward a separate blocky electric-blue G,
> blue #0866FF. Do not invent a new logo, no perspective, no 3D, no glow or gradients.
> Tight clean horizontal composition, logo centered and taking almost all canvas
> width with small safe padding, actual transparent PNG background. No face, no
> surrounding scene, no circle, no name, no slogans. Only the exact white-and-blue
> MG mark, crisp solid edges suitable for small-size display.

## Review and checks

`npm run verify:production` uses local fixture content and tests desktop/mobile
overflow, initial data requests, image loading, video mute/play/pause behavior,
reduced motion, keyboard activation of Ares, blog navigation and the existing
publication flow. Screenshots are written to `.next/brand-review/`; they contain
fixture projects/articles, not a snapshot of the production database.
