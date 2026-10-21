import http from 'node:http';
import { createHandler, readConfig } from './proxy.mjs';

const config = readConfig();
const server = http.createServer({ requestTimeout: 45000, headersTimeout: 10000 }, createHandler(config));
server.maxHeadersCount = 30;
server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => {
  console.log('Private Vision proxy listening. Put HTTPS in front of this service for headset use.');
});
