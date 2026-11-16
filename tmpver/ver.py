import json, urllib.request, urllib.error, unicodedata
KEY="AIzaSyC1iR7QlwlWhAcWSOPFKs_LIiq1PDWpc8g"
BASE="https://firestore.googleapis.com/v1/projects/directorio-usuarios-a1ae6/databases/(default)/documents"
def req(url,data=None,method="GET",token=None):
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status,json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}")
s,a=req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",{"returnSecureToken":True},"POST")
T=a.get("idToken")
us=[];tok=""
while True:
    s,r=req(f"{BASE}/usuarios?pageSize=300"+(f"&pageToken={tok}" if tok else ""),token=T)
    if s!=200: print("ERR",s,json.dumps(r)[:200]); break
    for d in r.get("documents",[]):
        f=d["fields"]; g=lambda k:(f.get(k,{}).get("stringValue") or "")
        us.append({"n":g("nombreUsuario"),"area":g("area"),"cargo":g("cargo"),"activo":f.get("activo",{}).get("booleanValue",True),"apps":[v.get("stringValue") for v in f.get("apps",{}).get("arrayValue",{}).get("values",[])]})
    tok=r.get("nextPageToken")
    if not tok: break
print("TOTAL_USUARIOS",len(us))
N=lambda t:"".join(c for c in unicodedata.normalize("NFD",t.upper()) if unicodedata.category(c)!="Mn").replace("."," ").split()
grupos={"Mantenimiento Planta A.Seca":["JAVIER VALDIVIA","RAFAEL AGUILERA","FERNANDO SALGADO MONTT","EDUARDO VEGA","RAMON GONZALEZ","DAVID PEREZ","ALVARO VALENZUELA","SEBASTIAN ORDOÑEZ","KEVIN RAMOS","ALEJANDRO VILCHES"],
"Procesos SX-EW":["ALAN BRELL","IVÁN GALLARDO","VÍCTOR VALDIVIA"],
"Procesos A.Seca":["JUAN YAÑEZ","RODRIGO NUÑEZ","DANIEL SARRICUETA"],
"Mina":["CARLOS ANGEL","LUIS GAJARDO","LUCCIANO SALAS","GABRIEL CAMPOS","MICHAEL HERRERA","JOSSUE LATAPIAT","ALEJANDRO VALENZUELA","PATRICIO CORTES","JOSE MIGUEL ROJAS","CESAR GARCIA","JORGE GALARZA","INGRID FLORES","RAUL FUENZALIDA","FELIPE ZEPEDA","CAMILA MADARIAGA","EDUARDO GUAJARDO","ERICK FRANCO","ISRAEL PARRA"]}
out={}
for g,ns in grupos.items():
    out[g]=[]
    for n in ns:
        q=N(n); exact=[u for u in us if all(t in N(u["n"]) for t in q)]
        ap=q[-1]; pos=[] if exact else [u for u in us if ap in N(u["n"]) and (q[0][:3] in " ".join(N(u["n"])) )]
        sur=[] if exact or pos else [u for u in us if ap in N(u["n"])]
        out[g].append({"buscado":n,"exacto":exact,"posible":pos,"mismo_apellido":sur[:6]})
print("RESULTADO_JSON "+json.dumps(out,ensure_ascii=False))
