# Hero photo

Put the landing page's hero photo here as `kottbullar.jpg`:

- Subject: köttbullar med potatismos, gräddsås och lingonsylt
- Landscape, **2400px wide or more** (variants are cropped to 16:9)
- Your own photo or one you hold a licence for. Nothing is bundled here —
  the repo ships no stand-in and the page must never hotlink one.

Then generate the served variants:

```bash
bun run images:hero
```

That writes `static/hero/kottbullar-<width>.{avif,webp,jpg}` for widths
640–2560, which is what the hero's `<picture>` references. Until the photo
exists, the hero renders its brand gradient alone — no broken image.
