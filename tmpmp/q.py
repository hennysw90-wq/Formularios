import json, urllib.request, urllib.error
KEY="AIzaSyCI8oXECFRvZLev2__iMGggeAAs4VSjDms"
BASE="https://firestore.googleapis.com/v1/projects/gestionar-mi-agenda/databases/(default)/documents"
def req(url,data=None,method="GET",token=None):
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status,json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}")
_,a=req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",{"returnSecureToken":True},"POST"); T=a["idToken"]
_,r=req(f"{BASE}/estandares?pageSize=500",token=T)
n=0
for d in r.get("documents",[]):
    nom=d["fields"].get("nombre",{}).get("stringValue","")
    if nom.startswith("MP_"):
        nuevo=nom[3:].strip()
        s,_=req(f"https://firestore.googleapis.com/v1/{d['name']}?updateMask.fieldPaths=nombre",{"fields":{"nombre":{"stringValue":nuevo}}},"PATCH",T)
        print("CAMBIO" if s==200 else f"ERROR {s}", nom, "->", nuevo); n+=1
print("TOTAL_CAMBIADOS",n)
