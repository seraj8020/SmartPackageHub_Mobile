"""Build Expo/Android launcher icons from generated source art."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SRC_MAIN = Path(r"C:\Users\DELL\.cursor\projects\d-Sph\assets\sph-app-icon.jpg")
SRC_FG = Path(r"C:\Users\DELL\.cursor\projects\d-Sph\assets\sph-android-foreground.jpg")
OUT_DIR = Path(__file__).resolve().parents[1] / "assets"
NAVY = (28, 61, 90, 255)  # #1C3D5A


def to_square(src: Path, size: int) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    icon = to_square(SRC_MAIN, 1024)
    icon.save(OUT_DIR / "icon.png", "PNG")
    print("wrote icon.png", icon.size)

    # Adaptive foreground: keep package in center safe zone on navy.
    fg_src = to_square(SRC_FG, 1024)
    safe = Image.new("RGBA", (1024, 1024), NAVY)
    content_size = 640
    content = fg_src.resize((content_size, content_size), Image.Resampling.LANCZOS)
    offset = (1024 - content_size) // 2
    safe.paste(content, (offset, offset))
    safe.save(OUT_DIR / "android-icon-foreground.png", "PNG")
    print("wrote android-icon-foreground.png")

    Image.new("RGBA", (1024, 1024), NAVY).save(OUT_DIR / "android-icon-background.png", "PNG")
    print("wrote android-icon-background.png")

    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(mono)
    d.rounded_rectangle((320, 430, 704, 720), radius=36, fill=(255, 255, 255, 255))
    d.polygon([(320, 430), (420, 330), (804, 330), (704, 430)], fill=(255, 255, 255, 230))
    d.polygon([(704, 430), (804, 330), (804, 620), (704, 720)], fill=(255, 255, 255, 200))
    for i, x in enumerate(range(360, 500, 18)):
        fill = (255, 255, 255, 255) if i % 2 == 0 else (255, 255, 255, 80)
        d.rectangle((x, 500, x + 8, 660), fill=fill)
    mono.save(OUT_DIR / "android-icon-monochrome.png", "PNG")
    print("wrote android-icon-monochrome.png")

    icon.resize((192, 192), Image.Resampling.LANCZOS).save(OUT_DIR / "favicon.png", "PNG")

    splash = Image.new("RGBA", (512, 512), NAVY)
    mark = to_square(SRC_MAIN, 360)
    splash.paste(mark, ((512 - 360) // 2, (512 - 360) // 2))
    splash.save(OUT_DIR / "splash-icon.png", "PNG")
    print("wrote favicon.png and splash-icon.png")

    icon.save(OUT_DIR / "app-icon-preview.png", "PNG")
    print("done ->", OUT_DIR)


if __name__ == "__main__":
    main()
