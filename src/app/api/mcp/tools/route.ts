import { NextResponse } from 'next/server';
import { getMCPTools } from '@/lib/mcp-tools';

export async function GET() {
  try {
    const tools = getMCPTools();
    return NextResponse.json({
      success: true,
      data: {
        tools,
        count: tools.length,
      },
    });
  } catch (error) {
    console.error('Error fetching MCP tools:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tools',
      },
      { status: 500 }
    );
  }
}
