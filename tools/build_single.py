"""단일 HTML 파일로 묶기 — 이미지를 base64로 심어서 dist/ 에 한 장으로 만든다.

    python tools/build_single.py

인터넷이 없는 곳에서 보여주거나, 파일 하나만 보내고 싶을 때 씁니다.
(글꼴만 인터넷에서 받아오고, 없으면 시스템 글꼴로 대체됩니다.)
"""
import base64, pathlib, re, mimetypes

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT  = ROOT / "dist" / "ggakdugi-house.html"
ORDER = ["boot","data","grow","save","audio","menus","cut","home","care","run","cafe","app"]

def data_uri(path):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"

html = (ROOT / "index.html").read_text(encoding="utf-8")
css  = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
js   = "\n".join((ROOT / "js" / f"{n}.js").read_text(encoding="utf-8") for n in ORDER)

for png in sorted((ROOT / "assets").glob("*.png")):
    uri = data_uri(png)
    js = js.replace(f"assets/{png.name}", uri)
    html = html.replace(f"assets/{png.name}", uri)

html = html.replace('<link rel="stylesheet" href="css/style.css">', f"<style>\n{css}\n</style>")
html = re.sub(r'\s*<!-- 순서대로 읽혀야 합니다 -->', "", html)
html = re.sub(r'\s*<script defer src="js/\w+\.js"></script>', "", html)
html = html.replace("</body>", f"<script>\n(function(){{\n{js}\n}})();\n</script>\n</body>")

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print(f"{OUT}  ({OUT.stat().st_size/1024:.0f} KB)")
