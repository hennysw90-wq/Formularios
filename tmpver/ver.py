import json, urllib.request, urllib.error
KEY="AIzaSyC1iR7QlwlWhAcWSOPFKs_LIiq1PDWpc8g"
BASE="https://firestore.googleapis.com/v1/projects/directorio-usuarios-a1ae6/databases/(default)/documents"
def req(url,data=None,method="GET",token=None):
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status,json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}")
_,a=req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",{"returnSecureToken":True},"POST")
T=a.get("idToken"); us=[]; tok=""
for col in ["usuarios","areas"]:
  tok=""
  while True:
    s,r=req(f"{BASE}/{col}?pageSize=300"+(f"&pageToken={tok}" if tok else ""),token=T)
    if s!=200: print("ERR",col,s); break
    for d in r.get("documents",[]):
        f=d["fields"]; g=lambda k:(f.get(k,{}).get("stringValue") or "")
        us.append({"col":col,"n":g("nombreUsuario") or g("nombre"),"area":g("area"),"cargo":g("cargo"),"activo":f.get("activo",{}).get("booleanValue",True)})
    tok=r.get("nextPageToken")
    if not tok: break
print("LISTA_JSON "+json.dumps(us,ensure_ascii=False))
