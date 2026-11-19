// Transcribe audio con OpenAI (respaldo para navegadores sin reconocimiento de voz).
// La clave vive en .env (local) o en las variables de Netlify (producción).
export default async (req) => {
  const entrada = await req.formData();
  const salida = new FormData();
  const archivo = entrada.get("file"); // conserva el nombre y formato (webm, ogg o mp4)
  salida.append("file", archivo, archivo.name || "voz.webm");
  salida.append("model", "gpt-4o-mini-transcribe");
  salida.append("language", "es");

  const respuesta = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: salida,
  });

  return new Response(await respuesta.text(), {
    status: respuesta.status,
    headers: { "Content-Type": "application/json" },
  });
};
