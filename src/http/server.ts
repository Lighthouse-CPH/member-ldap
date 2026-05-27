export function startHttpServer(port: number): Deno.HttpServer<Deno.NetAddr> {
  console.log(`[http] Health check server listening on port ${port}`);
  return Deno.serve({ port }, (_req) => {
    return new Response("OK", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  });
}
