import { NextRequest, NextResponse } from 'next/server';
import { executeMCPTool } from '@/lib/mcp-tools';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, arguments: args, userToken } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Tool name is required' },
        { status: 400 }
      );
    }

    const result = await executeMCPTool({
      name,
      arguments: args || {},
      userToken,
    });

    // 解析结果文本
    let resultData: unknown = null;
    if (result.content && result.content.length > 0) {
      const textContent = result.content[0].text;
      if (textContent) {
        try {
          resultData = JSON.parse(textContent);
        } catch {
          resultData = textContent;
        }
      }
    }

    return NextResponse.json({
      success: !result.isError,
      data: resultData,
      isError: result.isError,
    });
  } catch (error) {
    console.error('Error executing MCP tool:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute tool',
      },
      { status: 500 }
    );
  }
}
