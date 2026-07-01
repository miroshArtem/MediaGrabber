// Native Messaging Host
// Reads length-prefixed JSON from stdin, writes to stdout.
// Bridges stdin/stdout to the bidirectional RPC.

import rpc from './rpc';

let msgBacklog: Buffer = Buffer.alloc(0);

function Send(message: any): void {
  const msgBuf = Buffer.from(JSON.stringify(message), 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(msgBuf.length, 0);
  process.stdout.write(lenBuf);
  process.stdout.write(msgBuf);
}

function processInput(chunk: Buffer): void {
  msgBacklog = Buffer.concat([msgBacklog, chunk]);
  while (msgBacklog.length >= 4) {
    const msgLength = msgBacklog.readUInt32LE(0);
    if (msgBacklog.length < msgLength + 4) return;
    if (msgLength === 0) return;
    try {
      const msgString = msgBacklog.toString('utf8', 4, msgLength + 4);
      const msgObject = JSON.parse(msgString);
      rpc.receive(msgObject);
    } catch (err) {
      console.error('[NativeMessaging] Could not read message:', err);
    }
    msgBacklog = msgBacklog.slice(msgLength + 4);
  }
}

rpc.setPost(Send);
process.stdin.on('data', processInput);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.error('[MediaGrabber CoApp] Native messaging host started');
