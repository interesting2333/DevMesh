import http from 'node:http';
import net from 'node:net';

const targetHost = '127.0.0.1';
const targetPort = Number(process.env.DEVMESH_TARGET_PORT ?? 3210);
const port = Number(process.argv[2] ?? 3211);
const targetOrigin = `http://${targetHost}:${targetPort}`;

function sanitize(headers) {
  const next = { ...headers };
  delete next.cookie;
  next.host = `${targetHost}:${targetPort}`;
  if (next.origin !== undefined) next.origin = targetOrigin;
  if (typeof next.referer === 'string') next.referer = next.referer.replace(`http://127.0.0.1:${port}`, targetOrigin);
  return next;
}

const server = http.createServer((request, response) => {
  if (!request.url || request.url === '/') {
    response.writeHead(302, { location: '/api/v1/workbench/view' });
    response.end();
    return;
  }
  const upstream = http.request({ host: targetHost, port: targetPort, path: request.url, method: request.method, headers: sanitize(request.headers) }, answer => {
    response.writeHead(answer.statusCode ?? 502, answer.headers);
    answer.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'PREVIEW_PROXY_FAILED' }));
  });
  request.pipe(upstream);
});

server.on('upgrade', (request, socket, head) => {
  const upstream = net.connect(targetPort, targetHost, () => {
    const headers = sanitize(request.headers);
    const lines = [`${request.method} ${request.url} HTTP/1.1`];
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      lines.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }
    lines.push('', '');
    upstream.write(lines.join('\r\n'));
    if (head) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(port, targetHost, () => {
  process.stdout.write(JSON.stringify({ event: 'preview-proxy-ready', url: `http://127.0.0.1:${port}/` }) + '\n');
});