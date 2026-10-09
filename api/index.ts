// Vercel Node.js function: expose the Express app without opening a TCP listener.
import { app } from '../server/src/index';
export default app;
