# Test webhook endpoint

Proyecto minimo para desplegar un endpoint de prueba en Render y verificar webhooks de Meta/WhatsApp.

## Archivos

- `app.js`: endpoint Express con `GET /` para verificacion y `POST /` para registrar payloads.
- `package.json`: dependencias y scripts de ejecucion.
- `.env.example`: variables de entorno de referencia.
- `.gitignore`: evita subir dependencias locales y secretos.
- `render.yaml`: configuracion opcional para desplegar en Render.

## Comportamiento

- `GET /healthz`
  - devuelve `200` para health checks de Render
- `GET /`
  - devuelve `200` con `hub.challenge` si `hub.mode=subscribe` y `hub.verify_token` coincide con `VERIFY_TOKEN`
  - devuelve `403` en cualquier otro caso
- `POST /`
  - imprime el body JSON completo en consola
  - devuelve `200`

## Uso local

1. Instala dependencias:

```bash
npm install
```

2. Define variables de entorno:

```bash
$env:VERIFY_TOKEN="vibecode"
$env:HOST="0.0.0.0"
```

3. Ejecuta la app:

```bash
npm start
```

## Despliegue en Render

Usa estos valores al crear el servicio:

- Build command: `npm install`
- Start command: `npm start`
- Environment Variable: `VERIFY_TOKEN=<tu_token>`

Tambien puedes dejar que Render detecte `render.yaml` si subes este directorio tal cual a GitHub.

## Verificacion en Meta

En el panel de Webhooks de tu app de Meta:

- Callback URL: la URL publica de Render
- Verify token: el mismo valor de `VERIFY_TOKEN`

Si todo esta bien, Render mostrara `WEBHOOK VERIFIED` en el log.
