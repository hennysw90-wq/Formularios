const KEY = "AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw";
const B = "https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents";
const tok = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })).json()).idToken;
const r = await (await fetch(`${B}/formularios?pageSize=100`, { headers: { Authorization: `Bearer ${tok}` } })).json();
for (const d of r.documents || []) { const f = d.fields || {}; console.log("FORM doc", d.name.split("/").pop(), "| campo id:", f.id?.stringValue, "| nombre:", f.nombre?.stringValue, "| estado:", f.estado?.stringValue, "| qrDe:", f.qrDe?.stringValue || ""); }
