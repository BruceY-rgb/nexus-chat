'use client';

import { useState, useEffect } from 'react';

interface Tool {
  name: string;
  description: string;
  parameters: {
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface ExecutionResult {
  success: boolean;
  data?: unknown;
  isError?: boolean;
  error?: string;
}

export default function MCPTestPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [arguments_, setArguments] = useState<string>('{}');
  const [userToken, setUserToken] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/mcp/tools')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.tools) {
          setTools(data.data.tools);
          if (data.data.tools.length > 0) {
            setSelectedTool(data.data.tools[0].name);
          }
        }
      })
      .catch(console.error);
  }, []);

  const executeTool = async () => {
    setLoading(true);
    setResult('');

    try {
      const args = JSON.parse(arguments_);
      const response = await fetch('/api/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTool,
          arguments: args,
          userToken: userToken || undefined,
        }),
      });

      const data: ExecutionResult = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedToolInfo = tools.find((t) => t.name === selectedTool);

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>MCP Tool Test Page</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Use this page to test tools provided by the MCP server.
        <a href="/mcp-test.md" target="_blank" style={{ marginLeft: '10px', color: '#0070f3' }}>
          View detailed instructions
        </a>
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Select Tool:
        </label>
        <select
          value={selectedTool}
          onChange={(e) => setSelectedTool(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '14px',
            color: '#333 !important',
            background: '#fff !important',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          {tools.map((tool) => (
            <option key={tool.name} value={tool.name}>
              {tool.name} - {tool.description.substring(0, 50)}...
            </option>
          ))}
        </select>
      </div>

      {selectedToolInfo && (
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>{selectedToolInfo.name}</h3>
          <p style={{ color: '#333' }}>{selectedToolInfo.description}</p>
          <details>
            <summary style={{ color: '#333' }}>Parameters</summary>
            <pre style={{ fontSize: '12px', color: '#333' }}>
              {JSON.stringify(selectedToolInfo.parameters, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Tool Parameters (JSON):
        </label>
        <textarea
          value={arguments_}
          onChange={(e) => setArguments(e.target.value)}
          style={{
            width: '100%',
            height: '100px',
            padding: '8px',
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#333 !important',
            background: '#fff !important',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          User Token (Optional):
        </label>
        <input
          type="text"
          value={userToken}
          onChange={(e) => setUserToken(e.target.value)}
          placeholder="Token obtained after login"
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '14px',
            color: '#333 !important',
            background: '#fff !important',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <button
        onClick={executeTool}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          background: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Executing...' : 'Execute Tool'}
      </button>

      {result && (
        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Execution Result:
          </label>
          <pre
            style={{
              padding: '15px',
              background: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '400px',
              fontSize: '13px',
            }}
          >
            {result}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '40px', padding: '15px', background: '#e8f4fd', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSelectedTool('register');
              setArguments(
                JSON.stringify(
                  {
                    email: 'test@example.com',
                    password: '123456',
                    name: 'Test User',
                  },
                  null,
                  2
                )
              );
            }}
            style={{
              padding: '8px 15px',
              fontSize: '14px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Fill Register Params
          </button>
          <button
            onClick={() => {
              setSelectedTool('login');
              setArguments(
                JSON.stringify(
                  {
                    email: 'test@example.com',
                    password: '123456',
                  },
                  null,
                  2
                )
              );
            }}
            style={{
              padding: '8px 15px',
              fontSize: '14px',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Fill Login Params
          </button>
          <button
            onClick={() => {
              setSelectedTool('list_channels');
              setArguments('{}');
            }}
            style={{
              padding: '8px 15px',
              fontSize: '14px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Fill Get Channels
          </button>
        </div>
      </div>
    </div>
  );
}
