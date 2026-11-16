import json, urllib.request, urllib.error
for proj in ["directorio-usuarios-a1ae6"]:
    url=f"https://firestore.googleapis.com/v1/projects/{proj}/databases/(default)/documents/usuarios?pageSize=1&mask.fieldPaths=rol"
    try:
        with urllib.request.urlopen(url,timeout=30) as x: print("DIR",proj,x.status)
    except urllib.error.HTTPError as e: print("DIR",proj,e.code,e.read()[:400])
