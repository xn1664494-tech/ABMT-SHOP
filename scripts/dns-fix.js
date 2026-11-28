const dns = require('node:dns');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

const uri = process.env.MONGODB_URI_TEST || process.env.TEST_MONGODB_URI || '';
const servers = dns.getServers();
const hasLoopback = servers.some(
  (server) => server === '::1' || server === '127.0.0.1' || server.startsWith('127.'),
);

if (/mongodb\.net/i.test(uri) && hasLoopback) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}
