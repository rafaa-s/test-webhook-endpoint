# Test webhook endpoint

Proyecto base para:

- verificar webhooks de Meta/WhatsApp
- probar payloads entrantes
- levantar una UI local tipo chat en `/chat`
- usar Ollama como motor de respuesta con Gemma 4

## Archivos

- `app.js`: servidor Express con verificacion de webhook, API local y puente a Ollama.
- `package.json`: dependencias y scripts de ejecucion.
- `.env.example`: variables de entorno de referencia.
- `.gitignore`: evita subir dependencias locales y secretos.
- `render.yaml`: configuracion opcional para desplegar en Render.
- `public/`: UI local de chat.

## Comportamiento

- `GET /healthz`
  - devuelve `200` para health checks de Render
- `GET /chat`
  - sirve una UI local tipo chat
- `GET /api/local-chat/config`
  - devuelve el modelo configurado y estado de Ollama
- `GET /api/local-chat/state`
  - devuelve el historial local en memoria de una sesion
- `POST /api/local-chat/message`
  - toma el mensaje de la UI, construye un payload tipo WhatsApp y lo procesa con la misma capa del webhook
- `POST /api/local-chat/reset`
  - limpia una sesion local
- `GET /`
  - devuelve `200` con `hub.challenge` si `hub.mode=subscribe` y `hub.verify_token` coincide con `VERIFY_TOKEN`
  - devuelve `403` en cualquier otro caso
- `POST /`
  - imprime el body JSON completo en consola
  - opcionalmente puede procesar mensajes entrantes si `PROCESS_INBOUND_WEBHOOKS=true`
  - opcionalmente puede reenviar el webhook completo a otra URL si `FORWARD_WEBHOOK_URL` esta definido

## Uso local

1. Instala dependencias:

```bash
npm install
```

2. Define variables de entorno:

```bash
$env:VERIFY_TOKEN="vibecode"
$env:HOST="0.0.0.0"
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434/api"
$env:OLLAMA_MODEL="gemma4:e4b"
$env:FORWARD_WEBHOOK_URL="https://tu-url-publica/api/webhook/meta"
```

3. Asegurate de tener Ollama corriendo localmente.

Ejemplo:

```bash
ollama serve
ollama pull gemma4:e4b
```

Tambien puedes usar `gemma4` si tu maquina soporta el modelo mas pesado.

4. Ejecuta la app:

```bash
npm start
```

5. Abre la UI local:

```text
http://127.0.0.1:3000/chat
```

## Despliegue en Render

Usa estos valores al crear el servicio:

- Build command: `npm install`
- Start command: `npm start`
- Environment Variable: `VERIFY_TOKEN=<tu_token>`
- Environment Variable: `FORWARD_WEBHOOK_URL=<url_publica_destino>` si quieres reenviar a otra app

Tambien puedes dejar que Render detecte `render.yaml` si subes este directorio tal cual a GitHub.

## Verificacion en Meta

En el panel de Webhooks de tu app de Meta:

- Callback URL: la URL publica de Render
- Verify token: el mismo valor de `VERIFY_TOKEN`

Si todo esta bien, Render mostrara `WEBHOOK VERIFIED` en el log.

## Notas

- La UI local funciona en memoria; al reiniciar el servidor se pierde el historial.
- El endpoint local no envia mensajes a WhatsApp; solo reutiliza la forma del payload para probar el flujo.
- Si Ollama no esta corriendo, la UI te mostrara el error del backend.
- Render no puede reenviar a `http://localhost:3000` directamente. Si tu app Next corre local, necesitas una URL publica temporal, por ejemplo con Cloudflare Tunnel o ngrok, y usar esa URL en `FORWARD_WEBHOOK_URL`.
