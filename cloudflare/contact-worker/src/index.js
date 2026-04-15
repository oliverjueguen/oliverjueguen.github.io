const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
    ...init,
  });

const parseAllowedOrigins = (value) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const getClientIp = (request) =>
  request.headers.get('CF-Connecting-IP') ||
  request.headers.get('x-forwarded-for') ||
  'unknown';

const withCors = (response, origin) => {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  response.headers.set('Vary', 'Origin');
  return response;
};

const sanitize = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

export default {
  async fetch(request, env) {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (!allowedOrigins.includes(origin)) {
        return json({ success: false, error: 'Origin not allowed.' }, { status: 403 });
      }

      return withCors(new Response(null, { status: 204 }), origin);
    }

    if (request.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed.' }, { status: 405 });
    }

    if (!allowedOrigins.includes(origin)) {
      return json({ success: false, error: 'Origin not allowed.' }, { status: 403 });
    }

    const formData = await request.formData();
    const botcheck = sanitize(formData.get('botcheck'), 200);

    if (botcheck) {
      return withCors(json({ success: true }), origin);
    }

    const name = sanitize(formData.get('name'), 120);
    const company = sanitize(formData.get('empresa'), 160);
    const email = sanitize(formData.get('email'), 200);
    const phone = sanitize(formData.get('telefono'), 20);
    const preferredContact = sanitize(formData.get('via_preferida'), 80);
    const service = sanitize(formData.get('servicio'), 120);
    const message = sanitize(formData.get('message'), 5000);

    if (!name || !email || !message) {
      return withCors(
        json({ success: false, error: 'Faltan campos obligatorios.' }, { status: 400 }),
        origin,
      );
    }

    if (!env.WEB3FORMS_ACCESS_KEY) {
      return withCors(
        json({ success: false, error: 'Falta configurar el backend del formulario.' }, { status: 500 }),
        origin,
      );
    }

    if (env.CONTACT_RATE_LIMIT) {
      const cooldownSeconds = Number(env.COOLDOWN_SECONDS || '120');
      const clientIp = getClientIp(request);
      const rateLimitKey = `contact:${clientIp}`;
      const previous = await env.CONTACT_RATE_LIMIT.get(rateLimitKey);

      if (previous) {
        return withCors(
          json(
            { success: false, error: 'Espera un poco antes de enviar otro mensaje.' },
            { status: 429 },
          ),
          origin,
        );
      }

      await env.CONTACT_RATE_LIMIT.put(rateLimitKey, '1', {
        expirationTtl: cooldownSeconds,
      });
    }

    const upstream = new FormData();
    upstream.set('access_key', env.WEB3FORMS_ACCESS_KEY);
    upstream.set('subject', 'Nuevo contacto desde oliverjueguen.net');
    upstream.set('from_name', 'oliverjueguen.net');
    upstream.set('name', name);
    upstream.set('email', email);
    upstream.set(
      'message',
      [
        `Nombre: ${name}`,
        company ? `Empresa: ${company}` : null,
        phone ? `Teléfono: ${phone}` : null,
        preferredContact ? `Vía preferida: ${preferredContact}` : null,
        service ? `Servicio: ${service}` : null,
        '',
        message,
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const upstreamResponse = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: upstream,
      headers: {
        Accept: 'application/json',
      },
    });

    const upstreamBody = await upstreamResponse.json().catch(() => ({}));

    if (!upstreamResponse.ok || !upstreamBody.success) {
      return withCors(
        json(
          {
            success: false,
            error: upstreamBody.message || 'No se pudo enviar el mensaje.',
          },
          { status: 502 },
        ),
        origin,
      );
    }

    return withCors(json({ success: true }), origin);
  },
};
