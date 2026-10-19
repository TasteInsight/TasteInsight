"""Apply the deployment adapter to the pinned upstream server."""
from pathlib import Path

web = Path('/app/web.py')
source = web.read_text()
# The bundled UI has no consumer for the generic remote proxy; keep it outside the admin origin.
for marker in ('from apis.proxy import router as proxy_router\n', 'api_router.include_router(proxy_router)\n'):
    assert marker in source
    source = source.replace(marker, '', 1)
marker = '# CORS配置'
assert marker in source
web.write_text(source.replace(marker, 'from prefix_adapter import configure\nconfigure(app)\n\n' + marker, 1))

main = Path('/app/main.py')
source = main.read_text()
marker = 'uvicorn.run("web:app", host='
assert marker in source
source = source.replace(marker, 'uvicorn.run("web:app", root_path=os.environ.get("WERSS_PUBLIC_PATH", "/werss/").rstrip("/"), host=', 1)
# Upstream startup diagnostics print the entire process environment, including credentials.
marker = '    print("环境变量:")\n    for k,v in os.environ.items():\n        print(f"{k}={v}")'
assert marker in source
main.write_text(source.replace(marker, '', 1))

article = Path('/app/views/article_detail.py')
source = article.read_text()
marker = 'raw_content = article.content'
assert marker in source
article.write_text('from nh3 import clean as sanitize_article_html\n' + source.replace(marker, 'raw_content = sanitize_article_html(article.content or "")', 1))
