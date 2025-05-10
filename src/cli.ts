#!/usr/bin/env node

import path from 'path';
import { execFileSync } from 'child_process';

try {
  // Ensure the server is run from the compiled 'dist' directory
  // __dirname will be 'c:/Users/proto/Desktop/asy-geo/src' when running ts-node
  // or 'c:/Users/proto/Desktop/asy-geo/dist' when running the compiled cli.js
  // We want to execute dist/server.js
  
  // Construct the path to server.js relative to the current file (cli.js in dist)
  // If __dirname is .../dist, then server.js is in the same directory.
  // If this script is somehow run directly from src via ts-node (not intended for 'connect'),
  // this path would be wrong, but 'connect' in package.json points to dist/cli.js.
  const serverScriptPath = path.join(__dirname, 'server.js');

  // Execute server.js using Node.js
  // stdio: 'inherit' allows the server to use stdin/stdout for JSON-RPC communication
  execFileSync(process.execPath, [serverScriptPath], { stdio: 'inherit' });

} catch (error) {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
}
