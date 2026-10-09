const MODELO = 'claude-haiku-4-5-20251001';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { ahora, entrega } = req.body || {};
  if (typeof ahora !== 'string' || typeof entrega !== 'string') {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) {
    return res.status(503).json({ error: 'IA no configurada' });
  }

  const prompt = `Eres un asistente de organización académica para un estudiante universitario.
Hora actual del estudiante: ${ahora}
Fecha y hora de entrega del pendiente: ${entrega}

Propón UN bloque de trabajo entre la hora actual y la entrega, en un momento libre que no afecte sus descansos:
- Preferiblemente la pausa del mediodía (12:00-14:00) o el tiempo después de clases (17:00-19:00).
- Nunca entre 22:00 y 08:00.
- El bloque debe terminar antes de la entrega.
- Duración entre 30 y 60 minutos.

Responde únicamente con un JSON con esta forma, sin texto adicional:
{"fecha":"YYYY-MM-DD","inicio":"HH:MM","fin":"HH:MM","motivo":"frase corta en español"}`;

  try {
    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!respuesta.ok) {
      return res.status(502).json({ error: 'La IA no respondió' });
    }

    const datos = await respuesta.json();
    const texto = datos.content?.[0]?.text ?? '';
    const coincidencia = texto.match(/\{[\s\S]*\}/);
    const sugerencia = JSON.parse(coincidencia ? coincidencia[0] : '{}');

    const valida =
      /^\d{4}-\d{2}-\d{2}$/.test(sugerencia.fecha) &&
      /^\d{2}:\d{2}$/.test(sugerencia.inicio) &&
      /^\d{2}:\d{2}$/.test(sugerencia.fin) &&
      typeof sugerencia.motivo === 'string';
    if (!valida) {
      return res.status(502).json({ error: 'Respuesta de IA inválida' });
    }

    return res.status(200).json({
      fecha: sugerencia.fecha,
      inicio: sugerencia.inicio,
      fin: sugerencia.fin,
      motivo: sugerencia.motivo.slice(0, 120)
    });
  } catch {
    return res.status(502).json({ error: 'Sugerencia no disponible' });
  }
};
