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
          "description": "A string containing complete and valid Asymptote code to be compiled. The server executes this code directly. Ensure necessary `import` statements (e.g., `import graph;`) and settings (e.g., `unitsize(1cm);`) are included within this code block if needed."
        },
        "outputParams": {
          "type": "object",
          "description": "Optional parameters to control the output image.",
          "properties": {
            "format": {
              "type": "string",
              "enum": ["svg", "png"],
              "description": "The desired output image format. \"svg\" for scalable vector graphics (recommended for diagrams and plots), \"png\" for raster graphics. Defaults to \"svg\" if not specified."
            },
            "renderLevel": {
              "type": "number",
              "description": "For PNG output only. Specifies the rendering quality (supersampling level for antialiasing). Higher values (e.g., 4 or 8) produce smoother images but take longer to render and result in larger files. Asymptote default is 2. This server defaults to 4 if not specified and format is \"png\". Ignored for SVG output."
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

**Client Compatibility Notes:**

*   Some MCP clients may have limitations on supported image MIME types.
*   For instance, if you are using this server with a client that does not support `image/svg+xml` (e.g., certain versions or configurations of "Cherry Studio" as reported), please ensure you request the `png` format by including `"outputParams": { "format": "png" }` in your tool call arguments. The server defaults to `svg` if no format is specified.

## Author

luorivergoddess

## License

ISC
