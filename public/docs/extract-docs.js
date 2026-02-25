/**
 * Script to extract API documentation from HTML and generate JSON
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const jsonPath = path.join(__dirname, 'api-docs.json');

const html = fs.readFileSync(htmlPath, 'utf-8');

// Extract title
const titleMatch = html.match(/<title>([^<]+)<\/title>/);
const title = titleMatch ? titleMatch[1] : 'API Documentation';

// Extract introduction
const introMatch = html.match(/<section id="introduction">[\s\S]*?<p>([^<]+)<\/p>/);
const intro = introMatch ? introMatch[1] : '';

// Extract authentication info
const authMatch = html.match(/<section id="authentication">[\s\S]*?<p>([\s\S]*?)<\/p>/);
const auth = authMatch ? authMatch[1].replace(/<[^>]+>/g, '').trim() : '';

// Extract response format
const responseFormatMatch = html.match(/<section id="response-format">[\s\S]*?<pre><code class="language-json">([\s\S]*?)<\/code><\/pre>/);
const responseFormat = responseFormatMatch ? responseFormatMatch[1].trim() : '';

// Extract status codes
const statusCodes = [];
const statusCodeRegex = /<tr>\s*<td>(\d+)<\/td>\s*<td>([^<]+)<\/td>/g;
let match;
while ((match = statusCodeRegex.exec(html)) !== null) {
    statusCodes.push({ code: match[1], description: match[2].trim() });
}

// Extract REST API endpoints
const restApis = [];
const apiEndpointRegex = /<div class="api-endpoint">[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<p>([^<]*)<\/p>/g;
while ((match = apiEndpointRegex.exec(html)) !== null) {
    const endpoint = {
        method: match[1].split(' ')[0],
        path: match[1].split(' ').slice(1).join(' '),
        description: match[2].trim()
    };

    // Extract parameters table
    const paramMatch = html.substring(match.index).match(/<table>[\s\S]*?<\/table>/);
    if (paramMatch) {
        endpoint.parameters = [];
        const paramRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/g;
        let paramMatch2;
        while ((paramMatch2 = paramRegex.exec(paramMatch[0])) !== null) {
            endpoint.parameters.push({
                name: paramMatch2[1].trim(),
                type: paramMatch2[2].trim(),
                required: paramMatch2[3].replace(/<[^>]+>/g, '').trim(),
                description: paramMatch2[4].replace(/<[^>]+>/g, '').trim()
            });
        }
    }

    // Extract request example
    const reqExampleMatch = html.substring(match.index).match(/<h4>Request Example<\/h4>[\s\S]*?<pre><code class="language-(?:bash|json)">([\s\S]*?)<\/code><\/pre>/);
    if (reqExampleMatch) {
        endpoint.requestExample = reqExampleMatch[1].trim();
    }

    // Extract response example
    const resExampleMatch = html.substring(match.index).match(/<h4>Response Example<\/h4>[\s\S]*?<pre><code class="language-json">([\s\S]*?)<\/code><\/pre>/);
    if (resExampleMatch) {
        endpoint.responseExample = resExampleMatch[1].trim();
    }

    restApis.push(endpoint);
}

// Extract MCP tools
const mcpTools = [];
const mcpToolRegex = /<h4>([^<]+) - ([^<]+)<\/h4>[\s\S]*?<p>([^<]*)<\/p>/g;
while ((match = mcpToolRegex.exec(html)) !== null) {
    const tool = {
        name: match[2].trim(),
        fullName: match[1].trim(),
        description: match[3].trim()
    };

    // Find the tool section and extract input schema
    const toolSectionStart = match.index;
    const toolSection = html.substring(toolSectionStart, toolSectionStart + 5000);

    const inputSchemaMatch = toolSection.match(/<h5>Input Schema<\/h5>[\s\S]*?<pre><code class="language-json">([\s\S]*?)<\/code><\/pre>/);
    if (inputSchemaMatch) {
        tool.inputSchema = inputSchemaMatch[1].trim();
    }

    const outputSchemaMatch = toolSection.match(/<h5>Response<\/h5>[\s\S]*?<pre><code class="language-json">([\s\S]*?)<\/code><\/pre>/);
    if (outputSchemaMatch) {
        tool.outputSchema = outputSchemaMatch[1].trim();
    }

    mcpTools.push(tool);
}

// Build final JSON structure
const apiDocs = {
    info: {
        title: title,
        version: "1.0.0",
        description: intro,
        authentication: auth,
        baseUrl: "http://localhost:3000"
    },
    responseFormat: responseFormat,
    statusCodes: statusCodes,
    restApis: restApis,
    mcpTools: mcpTools
};

// Write JSON file
fs.writeFileSync(jsonPath, JSON.stringify(apiDocs, null, 2), 'utf-8');

console.log(`API documentation extracted to ${jsonPath}`);
console.log(`- REST APIs: ${restApis.length}`);
console.log(`- MCP Tools: ${mcpTools.length}`);
console.log(`- Status Codes: ${statusCodes.length}`);
