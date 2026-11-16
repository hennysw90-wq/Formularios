import json, urllib.request, urllib.error
KEY="AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw"
BASE="https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents"
def req(url,data=None,method="GET",token=None):
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as x: return x.status,json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}")
_,a=req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",{"returnSecureToken":True},"POST"); T=a.get("idToken")
for col in ["evaluaciones","compromisos","asignaciones","formularios"]:
    s,r=req(f"{BASE}/{col}/zz_no_existe_prueba_borrado",method="DELETE",token=T)
    print("BORRAR", col, s, r.get("error",{}).get("status",""))
