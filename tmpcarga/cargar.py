# Carga única al Portal EO (gestionar-mi-agenda): 39 estándares "En proceso de carga" + 2 gerencias.
# Solo crea lo que no existe (no sobrescribe nada).
import json, os, urllib.request, urllib.error
KEY = "AIzaSyCI8oXECFRvZLev2__iMGggeAAs4VSjDms"
BASE = "https://firestore.googleapis.com/v1/projects/gestionar-mi-agenda/databases/(default)/documents"
def req(url, data=None, method="GET", token=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
_, a = req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}", {"returnSecureToken": True}, "POST")
T = a["idToken"]
val = lambda v: {"arrayValue": {"values": [{"stringValue": x} for x in v]}} if isinstance(v, list) else {"stringValue": v}
datos = json.load(open("tmpcarga/carga.json"))
creados = existian = 0
for d in datos["estandares"]:
    campos = {k: val(v) for k, v in d.items() if k != "id"}
    s, r = req(f"{BASE}/estandares/{d['id']}?currentDocument.exists=false", {"fields": campos}, "PATCH", T)
    if s == 200: creados += 1
    elif s in (400, 409) and "exist" in json.dumps(r).lower(): existian += 1
    else: print("ERROR", d["codigo"], s, json.dumps(r)[:300])
print(f"ESTANDARES creados={creados} ya_existian={existian}")
s, r = req(f"{BASE}/gerenciasEst?pageSize=100", token=T)
actuales = {doc["fields"]["nombre"]["stringValue"].lower(): doc for doc in r.get("documents", [])}
for g in datos["gerencias"]:
    ex = actuales.get(g["nombre"].lower())
    if ex:
        prev = [v["stringValue"] for v in ex["fields"].get("areas", {}).get("arrayValue", {}).get("values", [])]
        areas = sorted(set(prev) | set(g["areas"]))
        s, r = req(f"https://firestore.googleapis.com/v1/{ex['name']}?updateMask.fieldPaths=areas", {"fields": {"areas": val(areas)}}, "PATCH", T)
        print("GERENCIA actualizada", g["nombre"], areas, s)
    else:
        gid = "ger_carga_" + g["nombre"].lower().replace(" ", "_").replace("-", "_")
        s, r = req(f"{BASE}/gerenciasEst/{gid}?currentDocument.exists=false", {"fields": {"nombre": val(g["nombre"]), "areas": val(g["areas"])}}, "PATCH", T)
        print("GERENCIA creada", g["nombre"], g["areas"], s, "" if s == 200 else json.dumps(r)[:200])
s, r = req(f"{BASE}/estandares?pageSize=500", token=T)
docs = r.get("documents", [])
print("TOTAL_ESTANDARES", len(docs), "EN_PROCESO", sum(1 for x in docs if x["fields"].get("estado", {}).get("stringValue") == "En proceso de carga"))
