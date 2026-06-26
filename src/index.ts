import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mariadb from "mariadb";
import dotenv from "dotenv";

dotenv.config();

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_DATABASE = process.env.DB_DATABASE || process.env.DB_NAME || "test";

// Create MariaDB connection pool
const pool = mariadb.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  connectionLimit: 5,
});

// Initialize MCP Server
const server = new Server(
  {
    name: "mariadb-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_tables",
        description: "List all tables in the connected MariaDB database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "describe_table",
        description: "Retrieve schema information (columns, types, keys) for a specific table",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "The name of the table to describe",
            },
          },
          required: ["table"],
        },
      },
      {
        name: "execute_query",
        description: "Run a read-only SQL query against the MariaDB database. Supports SELECT, SHOW, DESCRIBE, and EXPLAIN. Write operations (INSERT, UPDATE, DELETE) are rejected.",
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "The SQL statement to execute",
            },
          },
          required: ["sql"],
        },
      },
    ],
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  let conn;
  try {
    conn = await pool.getConnection();

    switch (request.params.name) {
      case "list_tables": {
        const rows = await conn.query("SHOW TABLES;");
        // Extract table names
        const tables = rows.map((row: any) => Object.values(row)[0]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ tables }, null, 2),
            },
          ],
        };
      }

      case "describe_table": {
        const table = request.params.arguments?.table;
        if (typeof table !== "string") {
          throw new Error("Missing or invalid 'table' parameter");
        }
        // Safely query the table description using positional parameter or direct formatting with backticks
        // Note: mariadb driver supports parameterized queries, but table names cannot be parameterized in standard SQL.
        // We sanitize table name by ensuring it only contains alphanumeric characters and underscores to prevent SQL injection.
        if (!/^[a-zA-Z0-9_]+$/.test(table)) {
          throw new Error("Invalid table name. Only alphanumeric characters and underscores are allowed.");
        }

        const rows = await conn.query(`DESCRIBE \`${table}\`;`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      }

      case "execute_query": {
        const sql = request.params.arguments?.sql;
        if (typeof sql !== "string") {
          throw new Error("Missing or invalid 'sql' parameter");
        }

        // Validate that query is read-only (SELECT, SHOW, DESCRIBE, EXPLAIN)
        const isReadOnly = /^\s*(select|show|describe|explain)\b/i.test(sql);
        if (!isReadOnly) {
          throw new Error("Only read-only queries (SELECT) are allowed.");
        }

        const result = await conn.query(sql);
        
        // Handle result serialization (mariadb results are array of objects for SELECT, or OkPacket object for write queries)
        // BigInt properties must be converted to strings before JSON.stringify
        const serializedResult = JSON.stringify(
          result,
          (key, value) => (typeof value === "bigint" ? value.toString() : value),
          2
        );

        return {
          content: [
            {
              type: "text",
              text: serializedResult,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: error.message || String(error) }, null, 2),
        },
      ],
      isError: true,
    };
  } finally {
    if (conn) conn.release();
  }
});

// Run server using stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MariaDB MCP server running on stdio");
