import { registerManifest, unregisterManifest } from './native-autoinstall';

const args = process.argv.slice(2);

if (args[0] === 'register') {
  registerManifest(args.slice(1))
    .then(() => {
      console.error('[MediaGrabber] Registration complete');
    })
    .catch(error => {
      console.error('[MediaGrabber] Registration failed:', error);
      process.exitCode = 1;
    });
} else if (args[0] === 'unregister') {
  unregisterManifest()
    .then(() => {
      console.error('[MediaGrabber] Unregistration complete');
    })
    .catch(error => {
      console.error('[MediaGrabber] Unregistration failed:', error);
      process.exitCode = 1;
    });
} else {
  console.log('Usage: node dist/native-autoinstall-cli.js register [extension-id...] | unregister');
  process.exitCode = 1;
}
