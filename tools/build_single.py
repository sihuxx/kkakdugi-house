"""단일 HTML 파일로 묶기 — 이미지를 base64로 심어서 dist/ 에 한 장으로 만든다.

    python tools/build_single.py

인터넷이 없는 곳에서 보여주거나, 파일 하나만 보내고 싶을 때 씁니다.
(글꼴만 인터넷에서 받아오고, 없으면 시스템 글꼴로 대체됩니다.)
"""
import base64, hashlib, pathlib, re, mimetypes

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT  = ROOT / "dist" / "ggakdugi-house.html"
ORDER = ["config","boot","fx","data","grow","save","auth","net","board","audio","menus","cut",
         "home","care","run","mine","catch","app"]

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
inline = f"\n(function(){{\n{js}\n}})();\n"
html = html.replace("</body>", f"<script>{inline}</script>\n</body>")

# 파일 하나로 묶으면 스크립트가 인라인이 된다 → CSP 를 풀지 않고 그 스크립트의
# 해시만 허용한다 ('unsafe-inline' 을 쓰면 XSS 방어가 통째로 무너진다)
sha = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode()
html = html.replace("script-src 'self';", f"script-src 'sha256-{sha}';")
html = html.replace("style-src 'self' https://fonts.googleapis.com 'unsafe-inline';",
                    "style-src https://fonts.googleapis.com 'unsafe-inline';")

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print(f"{OUT}  ({OUT.stat().st_size/1024:.0f} KB)")
