#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool, CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Initial check for Asymptote
exec('asy -version', (error, stdout, stderr) => {
  if (error) {
    console.error('\x1b[31m%s\x1b[0m', '-------------------------------------------------------------------');
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: Asymptote command (asy) not found or not executable.');
    console.error('\x1b[31m%s\x1b[0m', 'Please ensure Asymptote is installed and in your system PATH.');
    console.error('\x1b[31m%s\x1b[0m', 'Visit https://asymptote.sourceforge.io/ for installation instructions.');
    console.error('\x1b[31m%s\x1b[0m', '-------------------------------------------------------------------');
  } else {
    // console.error('Asymptote check successful. Version:\n' + (stdout || stderr).trim());
  }
});

interface AsyToolArguments {
  asyCode: string;
  outputParams?: {
    format?: 'svg' | 'png';
    renderLevel?: number;
  };
}

const renderGeometricImageInputSchema = {
  type: 'object' as const,
  properties: {
    asyCode: { 
      type: 'string', 
      description: 'A string containing complete and valid Asymptote code to be compiled. The server executes this code directly. Ensure necessary `import` statements (e.g., `import graph;`) and settings (e.g., `unitsize(1cm);`) are included within this code block if needed.' 
    },
    outputParams: {
      type: 'object' as const,
      description: 'Optional parameters to control the output image.',
      properties: {
        format: { 
          type: 'string', 
          enum: ['svg', 'png'], 
          description: 'The desired output image format. "svg" for scalable vector graphics (recommended for diagrams and plots), "png" for raster graphics. Defaults to "svg" if not specified.' 
        },
        renderLevel: { 
          type: 'number', 
          description: 'For PNG output only. Specifies the rendering quality (supersampling level for antialiasing). Higher values (e.g., 4 or 8) produce smoother images but take longer to render and result in larger files. Asymptote default is 2. This server defaults to 4 if not specified and format is "png". Ignored for SVG output.' 
        }
      },
      required: [] as string[],
      additionalProperties: false,
    }
  },
  required: ['asyCode'] as string[],
  additionalProperties: false,
};

class AsyGeoServer {
  private server: Server;
  private readonly serverVersion = "0.1.1"; 

  constructor() {
    this.server = new Server(
      {
        name: '@luorivergoddess/mcp-geo',
        version: this.serverVersion,
        displayName: 'Asymptote Geometry Renderer',
        description: 'Renders precise geometric images using Asymptote code.',
      },
      {
        capabilities: {
          tools: {}, 
        },
      }
    );

    this.setupRequestHandlers();
    
    this.server.onerror = (error) => console.error('[MCP SERVER ERROR]', error);
    process.on('SIGINT', async () => {
      console.error('Received SIGINT, shutting down server...');
      await this.server.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.error('Received SIGTERM, shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupRequestHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'renderGeometricImage',
          description: 'Renders an image from Asymptote code.',
          inputSchema: renderGeometricImageInputSchema,
        },
      ];
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const args = request.params.arguments as AsyToolArguments | undefined;

      if (request.params.name === 'renderGeometricImage') {
        if (!args || typeof args.asyCode !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid asyCode in arguments for renderGeometricImage tool.');
        }
        return this.handleRenderGeometricImage(args);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }
    });
  }

  private async handleRenderGeometricImage(args: AsyToolArguments): Promise<CallToolResult> {
    const { asyCode, outputParams } = args;
    const format = outputParams?.format || 'svg';
    const renderLevel = outputParams?.renderLevel || 4;

    if (asyCode.trim() === '') { 
        throw new McpError(ErrorCode.InvalidParams, 'asyCode parameter cannot be empty.');
    }

    const tempDir = os.tmpdir();
    const uniqueId = uuidv4();
    const baseOutputName = uniqueId;
    const asyFilePath = path.join(tempDir, `${baseOutputName}.asy`);
    const outputPathForAsyO = path.join(tempDir, baseOutputName);
    const actualOutputFilePath = path.join(tempDir, `${baseOutputName}.${format}`);

    let logs = '';

    try {
      await fs.writeFile(asyFilePath, asyCode, 'utf-8');

      const asyCmdArgs: string[] = ['-f', format];
      if (format === 'png') {
        asyCmdArgs.push(`-render=${renderLevel}`);
      }
      asyCmdArgs.push('-o', outputPathForAsyO, asyFilePath);
      
      const asyProcess = spawn('asy', asyCmdArgs, { cwd: tempDir });

      let processErrorStr = '';
      asyProcess.stdout.on('data', (data) => { logs += `[ASY STDOUT]: ${data.toString()}`; });
      asyProcess.stderr.on('data', (data) => { logs += `[ASY STDERR]: ${data.toString()}`; });

      const exitCode = await new Promise<number | null>((resolve, reject) => {
        asyProcess.on('error', (err) => {
          processErrorStr = `Failed to start Asymptote process: ${err.message}`;
          logs += `[PROCESS ERROR]: ${processErrorStr}\n`;
          reject(new Error(processErrorStr));
        });
        asyProcess.on('exit', (code) => resolve(code));
      });

      if (processErrorStr) {
        const message = `Failed to start Asymptote process: ${processErrorStr}. Logs: ${logs.trim()}`;
        throw new McpError(ErrorCode.InternalError, message, { originalError: processErrorStr, logs: logs.trim() });
      }

      if (exitCode !== 0) {
        logs += `[ASY EXIT CODE]: ${exitCode}\n`;
        const message = `Asymptote process exited with code ${exitCode}. Output file not found. Logs: ${logs.trim()}`;
        try {
          await fs.access(actualOutputFilePath);
        } catch (e) {
          throw new McpError(ErrorCode.InternalError, message, { logs: logs.trim() });
        }
        // If fs.access succeeded but we still consider it an error due to exitCode,
        // this part might need refinement, but usually non-zero exit means failure.
        // For now, if file exists, we proceed, but the log indicates an issue.
      }
      
      try {
        await fs.access(actualOutputFilePath);
      } catch (e) {
        const message = `Asymptote process completed (exit code ${exitCode}), but output file ${baseOutputName}.${format} was not created. Logs: ${logs.trim()}`;
        throw new McpError(ErrorCode.InternalError, message, { logs: logs.trim() });
      }

      const imageBuffer = await fs.readFile(actualOutputFilePath);
      const base64Data = imageBuffer.toString('base64');

      const imageContent: ImageContent = {
        type: 'image',
        mimeType: `image/${format === 'svg' ? 'svg+xml' : format}`,
        data: base64Data,
      };
      
      const contentParts: (ImageContent | TextContent)[] = [imageContent];

      if (logs && logs.trim() !== '') {
        const logContent: TextContent = { type: 'text', text: `Asymptote Logs:\n${logs.trim()}` };
        contentParts.push(logContent);
      }

      return {
        content: contentParts,
      };

    } catch (error: any) {
      const currentLogs = logs.trim();
      let finalMessage = `Server error: ${error.message}`;
      if (currentLogs) {
        finalMessage += `. Logs: ${currentLogs}`;
      }

      if (error instanceof McpError) {
        const errorData = error.data || {};
        // Ensure message includes current logs if not already part of error.message
        const combinedMessage = error.message.includes(currentLogs) ? error.message : `${error.message}. Current server logs: ${currentLogs}`;
        throw new McpError(error.code, combinedMessage, { ...errorData, serverLogs: currentLogs });
      }
      throw new McpError(ErrorCode.InternalError, finalMessage, { serverLogs: currentLogs });
    } finally {
      fs.unlink(asyFilePath).catch(e => console.error(`Failed to delete temp file ${asyFilePath}:`, e));
      fs.unlink(actualOutputFilePath).catch(e => { /* ignore if file wasn't created */ });
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport); 
    console.error(`@luorivergoddess/mcp-geo server (v${this.serverVersion}) running on stdio, using MCP SDK.`);
  }
}

if (require.main === module) {
  const serverInstance = new AsyGeoServer();
  serverInstance.run().catch(error => {
    console.error("Failed to run server:", error);
    process.exit(1);
  });
}
