# Contact Worker

Cloudflare Worker para recibir el formulario de contacto, validar origen y reenviar el mensaje a Web3Forms sin exponer la `access_key` en el HTML público.

## Qué hace

- Acepta `POST` desde tu web.
- Valida el `Origin` contra una lista permitida.
- Usa un honeypot (`botcheck`).
- Aplica un cooldown por IP usando Cloudflare KV.
- Reenvía el mensaje a Web3Forms con la key guardada como secreto.

## Antes de desplegar

1. Instala Wrangler:

```bash
npm install -g wrangler
```

2. Crea un namespace KV:

```bash
wrangler kv namespace create CONTACT_RATE_LIMIT
```

3. Copia el `id` que te devuelva Cloudflare y sustitúyelo en [wrangler.toml](./wrangler.toml).

4. Guarda la key de Web3Forms como secreto:

```bash
wrangler secret put WEB3FORMS_ACCESS_KEY
```

5. Despliega el Worker:

```bash
wrangler deploy
```

## URL del endpoint

Después del deploy tendrás una URL tipo:

```txt
https://contact-api.<tu-subdominio>.workers.dev
```

Pon esa URL en la variable de entorno pública del frontend:

```txt
PUBLIC_CONTACT_API_URL=https://contact-api.<tu-subdominio>.workers.dev
```

Si publicas con GitHub Pages, puedes guardarla en tu `.env.production` local antes de hacer build o en el flujo de build que uses.
