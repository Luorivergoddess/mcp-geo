# @luorivergoddess/mcp-geo

An MCP (Model Context Protocol) server for generating precise geometric images using Asymptote.
This server allows AI models compatible with MCP to request image generation by providing Asymptote code.

## Prerequisites

Before using this server, please ensure you have the following installed:

1.  **Node.js**: Version 16.x or higher is recommended. You can download it from [nodejs.org](https://nodejs.org/).
2.  **Asymptote**: This is a critical dependency. The `asy` command-line tool must be installed and accessible in your system's PATH.
    *   Visit the [Asymptote official website](https://asymptote.sourceforge.io/) for download and detailed installation instructions.
    *   Common installation methods:
        *   **macOS (via Homebrew):** `brew install asymptote`
        *   **Debian/Ubuntu Linux:** `sudo apt-get install asymptote`
        *   **Windows:** Often installed as part of TeX distributions like MiKTeX or TeX Live. Ensure the Asymptote `bin` directory is added to your PATH.
    *   The server will attempt to check for `asy -version` on startup and print an error if it's not found.

## Installation

To install this package globally (if you intend to run `connect` command directly) or as a dependency in another project:

```bash
npm install @luorivergoddess/mcp-geo
```

If you've cloned the repository and want to run it locally for development:
1. Clone the repository.
2. Install dependencies: `npm install`
3. Build the project: `npm run build`

## Usage

### Starting the Server

Once the package is installed (e.g., globally or linked locally), you can start the MCP server using the `connect` command provided by this package. This command is intended to be invoked by an MCP client.

```bash
npx @luorivergoddess/mcp-geo connect
```

Or, if you have cloned the repository and built it:
```bash
node dist/cli.js
```

The server will start and listen for JSON-RPC messages on stdin/stdout, using the `@modelcontextprotocol/sdk`.

### MCP Client Integration

Configure your MCP-compatible client (e.g., VS Code with Copilot Agent Mode, Claude Desktop) to use this server. This usually involves telling the client how to start the server, which would be the `npx @luorivergoddess/mcp-geo connect` command.

### Available Tool: `renderGeometricImage`

The server exposes one primary tool:

*   **Name:** `renderGeometricImage`
*   **Description:** Renders an image from Asymptote code.
*   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "asyCode": {
          "type": "string",
          "description": "The Asymptote code to execute."
        },
        "outputParams": {
          "type": "object",
          "properties": {
            "format": {
              "type": "string",
              "enum": ["svg", "png"],
              "description": "Output format (svg or png). Default: svg."
            },
            "renderLevel": {
              "type": "number",
              "description": "Render level for PNG (e.g., 4 for 4x antialiasing). Default: 4."
            }
          }
        }
      },
      "required": ["asyCode"]
    }
    ```
*   **Output:**
    The tool returns a `CallToolResult` containing an array of content parts.
    *   If successful, it includes an `ImageContent` part with:
        *   `type: "image"`
        *   `mimeType: "image/svg+xml"` or `"image/png"`
        *   `data: "<base64_encoded_image_data>"`
    *   It may also include a `TextContent` part with logs from Asymptote.
    *   If an error occurs, it throws an `McpError`.

**Example `renderGeometricImage` call (JSON for `arguments` field):**
```json
{
  "asyCode": "draw(unitsquare); fill(unitsquare, lightblue);",
  "outputParams": {
    "format": "png",
    "renderLevel": 4
  }
}
```

## Author

luorivergoddess

## License

ISC
