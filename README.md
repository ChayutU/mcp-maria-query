# MariaDB MCP Server

A Model Context Protocol (MCP) server for MariaDB database interactions.

## Features

This server exposes three tools to LLM clients:
1. `list_tables`: List all tables in the connected database.
2. `describe_table`: Get the schema details (columns, types, keys) of a specified table.
3. `execute_query`: Run arbitrary SQL statements (e.g. `SELECT`, `INSERT`, `UPDATE`, `DELETE`) on the database.

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` or set them directly:
   - `DB_HOST` (default: `localhost`)
   - `DB_PORT` (default: `3306`)
   - `DB_USER` (default: `root`)
   - `DB_PASSWORD` (default: `""`)
   - `DB_DATABASE` (default: `test`)

3. Build the server:
   ```bash
   npm run build
   ```

## Configuration for Clients

To integrate with an MCP client (such as **Claude Desktop**), add the server configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mariadb": {
      "command": "node",
      "args": ["C:/Users/Admin/.gemini/antigravity/scratch/mariadb-mcp-server/build/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USER": "your_user",
        "DB_PASSWORD": "your_password",
        "DB_DATABASE": "your_database"
      }
    }
  }
}
```

Make sure to adjust the path to `build/index.js` and the connection credentials as needed.
