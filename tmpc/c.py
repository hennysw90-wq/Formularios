# Solo lectura: cuenta usuarios por rol y cuántos tendrían que cambiar de clave. No imprime claves.
import json, urllib.request, urllib.error, unicodedata, re
DIRS={"Excelencia":("AIzaSyC1iR7QlwlWhAcWSOPFKs_LIiq1PDWpc8g","directorio-usuarios-a1ae6"),"Henny":("AIzaSyBIH6lfEKmyofzrFzLW-ypTNOvpfVhBRQQ","directorio-usuarios-dd278")}
def req(url,token=None):
    h={}
    if token: h["Authorization"]="Bearer "+token
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=30) as x: return x.status,json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}")
def clave(n):
    t="".join(c for c in unicodedata.normalize("NFD",(n or "").strip().split(" ")[0].lower()) if unicodedata.category(c)!="Mn")
    t=re.sub(r"[^a-z]","",t)
    return t[:4]+"26", len(t)
for amb,(key,proj) in DIRS.items():
    docs=[];tok=""
    while True:
        s,r=req(f"https://firestore.googleapis.com/v1/projects/{proj}/databases/(default)/documents/usuarios?pageSize=300"+(f"&pageToken={tok}" if tok else ""))
        if s!=200: print(amb,"ERR",s); break
        docs+=r.get("documents",[]); tok=r.get("nextPageToken")
        if not tok: break
    roles={}; afectados=0; ya=0; cortos=[]; distintas_default=0; pend=0
    for d in docs:
        f=d["fields"]; g=lambda k:f.get(k,{}).get("stringValue","")
        rol=g("rol") or "usuario"; roles[rol]=roles.get(rol,0)+1
        if rol in ("admin","master"): continue
        if g("estado")=="pendiente": pend+=1
        nueva,l=clave(g("nombreUsuario"))
        if l<4: cortos.append(g("nombreUsuario"))
        if g("password")==nueva: ya+=1; continue
        afectados+=1
        if g("password") not in ("RdPTracker",""): distintas_default+=1
    print(f"{amb}: total={len(docs)} roles={roles} cambiarian={afectados} ya_tienen_formato={ya} clave_personalizada_que_se_perderia={distintas_default} pendientes={pend} nombres_cortos={cortos}")
