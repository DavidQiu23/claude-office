import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createApp, portInUseMessage } from './app.js';

const { port } = loadConfig();
const app = createApp({ staticDir: join(dirname(fileURLToPath(import.meta.url)), '..', 'web') });

app.server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(portInUseMessage(port));
    process.exit(1);
  }
  throw err;
});
app.server.listen(port, '127.0.0.1', () => console.log(`Claude Office 已啟動：http://127.0.0.1:${port}`));
setInterval(app.sweepNow, 60_000);
