import json, urllib.request, urllib.error, unicodedata, datetime
KEY="AIzaSyC1iR7QlwlWhAcWSOPFKs_LIiq1PDWpc8g"
BASE="https://firestore.googleapis.com/v1/projects/directorio-usuarios-a1ae6/databases/(default)/documents"
def req(url,data=None,method="GET",token=None):
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status,json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}")
_,a=req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",{"returnSecureToken":True},"POST"); T=a.get("idToken"); print("AUTH", "anonima" if T else "sin sesion")
docs=[];tok=""
while True:
    s,r=req(f"{BASE}/usuarios?pageSize=300"+(f"&pageToken={tok}" if tok else ""),token=T); docs+=r.get("documents",[]); tok=r.get("nextPageToken")
    if not tok: break
nm=lambda d:d["fields"].get("nombreUsuario",{}).get("stringValue","")
K=lambda t:" ".join("".join(c for c in unicodedata.normalize("NFD",t.lower()) if unicodedata.category(c)!="Mn").split())
porNombre={K(nm(d)):d for d in docs}
sinT=lambda t:"".join(c for c in unicodedata.normalize("NFD",t.lower()) if unicodedata.category(c)!="Mn" and c.isalpha())
def correo(n):
    p=n.split(); return f"{sinT(p[0])}.{sinT(p[-1])}@glencore.cl"
S=lambda v:{"stringValue":v}
nuevos=[("Javier Valdivia","Mant. A.Seca"),("Rafael Aguilera","Mant. A.Seca"),("Fernando Salgado Montt","Mant. A.Seca"),("Eduardo Vega","Mant. A.Seca"),("David Perez","Mant. A.Seca"),("Alvaro Valenzuela","Mant. A.Seca"),("Sebastian Ordoñez","Mant. A.Seca"),
("Alan Brell","Op. A.Humeda"),("Iván Gallardo","Op. A.Humeda"),("Víctor Valdivia","Op. A.Humeda"),("Rodrigo Nuñez","Op. A.Seca"),("Daniel Sarricueta","Op. A.Seca"),
("Jossue Latapiat","Op. Mina"),("Alejandro Valenzuela","Op. Mina"),("Patricio Cortes","Op. Mina"),("Jose Miguel Rojas","Op. Mina"),("Cesar Garcia","Op. Mina"),("Raul Fuenzalida","Op. Mina"),("Felipe Zepeda","Op. Mina"),("Camila Madariaga","Op. Mina"),("Eduardo Guajardo","Op. Mina")]
ahora=datetime.datetime.utcnow().isoformat(timespec="milliseconds")+"Z"
for n,area in nuevos:
    if K(n) in porNombre: print("YA_EXISTE",n); continue
    f={"nombreUsuario":S(n),"password":S("RdPTracker"),"rol":S("usuario"),"area":S(area),"cargo":S(""),"correo":S(correo(n)),"estado":S("activo"),"apps":{"arrayValue":{"values":[S("cdr")]}},"creado":S(ahora)}
    s,r=req(f"{BASE}/usuarios",{"fields":f},"POST",T); print("CREADO" if s==200 else f"ERROR {s} {json.dumps(r)[:150]}",n,area)
for n,area in [("Alejandro Vilches","Mant. A.Seca"),("Gabriel Campos","Op. Mina"),("Erick Franco","Op. Mina")]:
    d=porNombre.get(K(n))
    if not d: print("NO_ENCONTRADO",n); continue
    s,r=req(f"https://firestore.googleapis.com/v1/{d['name']}?updateMask.fieldPaths=area",{"fields":{"area":S(area)}},"PATCH",T); print("AREA" if s==200 else f"ERROR {s}",n,"->",area)
d=porNombre.get(K("Jorge Luis Galarza"))
if d:
    print("DUP_DATOS", json.dumps({k:v for k,v in d["fields"].items() if k!="password"},ensure_ascii=False))
    s,r=req(f"https://firestore.googleapis.com/v1/{d['name']}",method="DELETE",token=T); print("BORRADO" if s==200 else f"ERROR {s} {json.dumps(r)[:150]}","Jorge Luis Galarza")
s,r=req(f"{BASE}/usuarios?pageSize=300",token=T); print("TOTAL_AHORA",len(r.get("documents",[])))
