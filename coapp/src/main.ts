// MediaGrabber CoApp — Main Entry Point
// Loads native-messaging (stdin/stdout bridge), then converter and downloads
// (which register their own RPC handlers at module scope), then registers
// app-level handlers.

import './native-messaging';
import './converter';
import './ytdlp';
import './downloads';
import rpc from './rpc';
import * as os from 'os';
import * as path from 'path';

rpc.listen({
  ping: (arg: any) => arg,

  info: () => ({
    version: '1.1.0',
    platform: process.platform,
    arch: process.arch,
    home: os.homedir() || process.env.HOME || process.env.USERPROFILE || '',
    downloadDir: path.join(os.homedir() || process.env.HOME || process.env.USERPROFILE || '', 'Downloads')
  }),

  quit: () => {
    setTimeout(() => process.exit(0), 100);
  }
});

console.error('[MediaGrabber CoApp] Ready');

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
