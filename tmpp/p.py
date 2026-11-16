import json, urllib.request, urllib.error, time
KEY="AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw"
BASE="https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents"
def req(url,data=None,method="GET",token=None):
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
    t=time.time()
    try:
        with urllib.request.urlopen(r, timeout=30) as x: return x.status,json.loads(x.read() or b"{}"),time.time()-t
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}"),time.time()-t
    except Exception as e: return 0,{"exc":str(e)},time.time()-t
s,a,_=req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",{"returnSecureToken":True},"POST"); print("AUTH",s); T=a.get("idToken")
s,r,t=req(f"{BASE}/formularios?pageSize=50&mask.fieldPaths=nombre&mask.fieldPaths=actualizado",token=T)
print("LEER_FORMULARIOS",s,round(t,2),"docs",len(r.get("documents",[])), json.dumps(r.get("error",""))[:300])
s,r,t=req(f"{BASE}/evaluaciones?pageSize=5&mask.fieldPaths=estado",token=T)
print("LEER_EVALUACIONES",s,round(t,2),"docs",len(r.get("documents",[])), json.dumps(r.get("error",""))[:300])
s,r,t=req(f"{BASE}/__prueba_conexion/x",{"fields":{"t":{"stringValue":"ping"}}},"PATCH",T)
print("ESCRIBIR",s,round(t,2),json.dumps(r.get("error",""))[:300])
if s==200:
    s,r,t=req(f"{BASE}/__prueba_conexion/x",method="DELETE",token=T); print("BORRAR",s)
