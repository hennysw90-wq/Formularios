const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const nombre of ["Cristian Oliva", "Hernan Cerda"]) {
    const p = await b.newPage({ viewport: { width: 420, height: 1600 } });
    p.on("pageerror", (e) => console.log("PAGEERR", e.message));
    await p.goto("https://formularioseocmlb.web.app/?formulario=f_mv9l6hdq4x8t", { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(4000);
    console.log("QR-INICIO", nombre, "::", (await p.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 300));
    const inp = p.locator("input").first();
    if (!(await inp.count())) { await p.close(); continue; }
    await inp.fill(nombre, { timeout: 8000 }); await p.waitForTimeout(800);
    await inp.press("Enter"); await p.waitForTimeout(1500);
    const cont = p.getByRole("button", { name: "Continuar" });
    if (await cont.count()) { await cont.click(); await p.waitForTimeout(5000); }
    const txt = (await p.locator("body").innerText()).replace(/\n+/g, " | ");
    console.log("QR", nombre, "::", txt.slice(0, 1400));
    await p.close();
  }
  await b.close();
})();
