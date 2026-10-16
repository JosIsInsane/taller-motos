# Taller — Sistema de gestión para taller de motos

Programa de escritorio para Windows que funciona **sin internet**: trabajos, caja diaria y cierre semanal, planilla con comisiones, inventario, garantías, recibos por WhatsApp y respaldos automáticos.

## Descargar

👉 **[Descargar la última versión](https://github.com/JosIsInsane/taller-motos/releases/latest)**: bajá `Instalar-Taller-X.Y.Z.exe` y abrilo.

Una vez instalado, el programa **se actualiza solo**: revisa al abrir y cada 4 horas, descarga la versión nueva en segundo plano y muestra un aviso para reiniciar. Antes de actualizar guarda un respaldo de la base de datos.

## Publicar una actualización

1. Hacé tus cambios y probalos con `npm start` y `npm test`.
2. Subí la versión y creá la etiqueta (esto edita `package.json` y hace el commit):
   ```
   npm version patch      # 1.1.0 → 1.1.1  (arreglos)
   npm version minor      # 1.1.0 → 1.2.0  (funciones nuevas)
   ```
3. Subí todo a GitHub:
   ```
   git push --follow-tags
   ```
4. GitHub Actions corre las pruebas, arma el instalador en Windows y lo publica en **Releases** (unos 5–8 minutos; se ve en la pestaña *Actions*).
5. Los programas instalados encuentran la versión nueva solos.

## Desarrollo

| Archivo | Qué hace |
|---|---|
| `main.js` | Motor: ventana, base de datos, respaldos, PDF, WhatsApp, Excel y actualizaciones. |
| `backend.js` | Reglas del negocio: trabajos, caja, cierres, planilla, comisiones, garantías. |
| `preload.js` | Puente seguro entre la pantalla y el motor. |
| `app/` | Pantallas (`app.js`), estructura (`index.html`) y diseño (`styles.css`, `extra.css`). |
| `test/` | Pruebas automáticas (`npm test`). |
| `.github/workflows/` | Pruebas en cada push y publicación automática al crear una etiqueta `v*`. |

```
npm install        # primera vez
npm start          # abrir en modo prueba (usa la misma base de datos que el programa instalado)
npm test           # pruebas
npm run instalador # crear el instalador en tu PC sin publicarlo
```

Los datos viven en `%APPDATA%\Taller\taller.db` y los respaldos en `Documentos\Taller Respaldos` (o la carpeta elegida en el programa).
