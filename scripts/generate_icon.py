from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
assets = root / "assets"
assets.mkdir(exist_ok=True)
size = 512
image = Image.new("RGBA", (size, size), (11, 14, 20, 255))
pixels = image.load()
for y in range(size):
    for x in range(size):
        distance = ((x - 360) ** 2 + (y - 100) ** 2) ** 0.5 / 500
        glow = max(0.0, 1.0 - distance)
        pixels[x, y] = (int(15 + 45 * glow), int(18 + 35 * glow), int(29 + 70 * glow), 255)
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((28, 28, 484, 484), radius=112, outline=(111, 94, 211, 255), width=5)
for x, top, bottom, color in [
    (128, 250, 345, (87, 198, 169, 255)),
    (218, 190, 305, (87, 198, 169, 255)),
    (308, 135, 260, (157, 139, 255, 255)),
]:
    draw.line((x + 22, top - 35, x + 22, bottom + 35), fill=color, width=10)
    draw.rounded_rectangle((x, top, x + 44, bottom), radius=10, fill=color)
draw.line((120, 355, 350, 120, 396, 166), fill=(225, 220, 255, 255), width=14, joint="curve")
draw.polygon([(390, 102), (432, 92), (422, 136), (404, 152)], fill=(225, 220, 255, 255))
image.save(assets / "icon.png")
image.save(assets / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(assets / "icon.ico")
