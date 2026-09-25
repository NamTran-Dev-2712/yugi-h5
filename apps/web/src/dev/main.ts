import { mountSandboxPage } from './sandbox-page';

const root = document.getElementById('sandbox-root');
if (!root) throw new Error('sandbox.html has no #sandbox-root');
mountSandboxPage(root);
