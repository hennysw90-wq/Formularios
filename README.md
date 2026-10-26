# CdR · Diálogo de Desempeño — ambiente Henny

Esta es la app **CdR (Confirmación de Rol)** corriendo en el ambiente de
pruebas Henny, en el lugar donde antes estaba Formularios. Sirve de base para
probar e incorporar mejoras antes de llevarlas a Excelencia.

- **App:** https://formularioseo.web.app
- **Código de origen:** `excelencia-oems/CdR`, commit `5211a1c` (v0.1.0)
- **Versión en Henny:** v0.1.1 (solo cambian las conexiones, ver abajo)

## Conexiones (todas de Henny)

| Para qué | Proyecto Firebase | Archivo |
|---|---|---|
| Datos de la CdR | `formularios-7f89a` | `src/firebase.js` |
| Usuarios y acceso | `directorio-usuarios-dd278` | `src/firebaseDirectorio.js` |
| Catálogo de reuniones (solo lectura) | `asistenciatracker` | `src/firebaseAsistencia.js` |

Nada apunta a proyectos de Excelencia.

## Qué se cambió respecto del código de Excelencia

1. **Conexiones** a los tres proyectos de Henny.
2. **Colecciones con prefijo `cdr`** (`cdrFormularios`, `cdrEvaluaciones`,
   `cdrAsignaciones`): en `formularios-7f89a` ya existe la colección
   `formularios` con los datos de la app anterior, y la CdR usa ese mismo
   nombre. Con el prefijo conviven sin pisarse y no se pierde nada.
3. **QR:** la dirección fija de los enlaces pasa a ser la de Henny
   (`src/enlaces.js`); antes mandaba a `cdr-reuniones.web.app`.
4. **Acceso:** en el directorio, la app se identifica como `formularios`
   (el mismo chip que ya existía en las otras apps de Henny). Mantiene la
   regla estricta de la CdR: entra el Master y quien tenga el chip marcado;
   las cuentas antiguas sin campo `apps` no entran por defecto.
5. **Login anónimo opcional:** si no está habilitado en el proyecto, la app
   sigue funcionando (las reglas de Henny no exigen sesión).
6. **Reglas:** se corrige que una CdR enviada no se pudiera anular (las
   reglas originales bloqueaban cualquier cambio a una enviada, incluida la
   anulación que la propia app ofrece).

## Asignaciones (v0.2.0)

Igual que en la app Formularios, **un formulario no está atado a reuniones**.
Todo se configura en **Estadísticas → Plan de evaluadores → Asignaciones**:
cada asignación es *formulario + reunión + líderes a evaluar + evaluadores*,
y cada evaluador tiene su propia **cantidad**, **frecuencia** (al día, a la
semana, a la quincena, al mes, una sola vez) y fecha **"controlar desde"**.

- Las asignaciones viven en la colección `cdrAsignaciones` (`tipo: "asignacion"`).
- Al evaluar, las reuniones y líderes que se ofrecen salen de las asignaciones
  de esa persona (`proyectarFormulario` en `src/asignaciones.js`); el motor de
  evaluación de la CdR no cambió.
- Cada evaluador ve en Inicio y en Mis CdR **sus asignaciones**: cuántas lleva
  en el periodo, cuántas le faltan y un botón para hacer la CdR con la reunión
  ya puesta. Mientras evalúa y al enviar, ve el avance de esa asignación.
- **Cumplimiento** por persona y mes, con estados *cumplido / al día /
  atrasado / no cumplido*. El periodo en curso nunca cuenta en contra hasta que
  termina.
- Reemplaza al plan de "meta mensual" de la CdR original.

## Puesta en marcha

Publicar las reglas de `firestore.rules` en la consola de Firebase del
proyecto `formularios-7f89a` (Firestore → Reglas). El deploy del sitio es
automático al hacer push a `main`.

```bash
npm install
npm run dev
```
