#!/usr/bin/env node

/**
 * API Documentation Generator
 * JSON 설정 파일을 기반으로 표준화된 마크다운 API 문서를 생성합니다.
 * 
 * Usage:
 *   node generate-api-doc.js --config <config.json>
 *   node generate-api-doc.js --config <config.json> --output <output.md>
 */

const fs = require('fs');
const path = require('path');

// CLI 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      options.config = args[++i];
    } else if (args[i] === '--output' || args[i] === '-o') {
      options.output = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
API Documentation Generator

Usage:
  node generate-api-doc.js --config <config.json> [--output <output.md>]

Options:
  -c, --config <file>   JSON configuration file (required)
  -o, --output <file>   Output markdown file (optional, defaults to stdout)
  -h, --help            Show this help message

Examples:
  node generate-api-doc.js --config api-login.json
  node generate-api-doc.js --config api-login.json --output docs/LOGIN_API.md
  `);
}

// 마크다운 생성 함수들
function formatValue(value) {
  if (value === null || value === undefined) return '`null`';
  if (typeof value === 'string') return `\`"${value}"\``;
  if (typeof value === 'boolean') return `\`${value}\``;
  if (typeof value === 'number') return `\`${value}\``;
  if (Array.isArray(value)) return `\`[...]\``;
  if (typeof value === 'object') return `\`{...}\``;
  return `\`${value}\``;
}

function generateParamTable(params, title) {
  if (!params || params.length === 0) return '';
  
  let md = `#### ${title}\n\n`;
  md += '| 필드 | 타입 | 필수 | 설명 | 예시 |\n';
  md += '|------|------|------|------|------|\n';
  
  for (const param of params) {
    const required = param.required ? '✓' : '○';
    const example = param.example !== undefined ? formatValue(param.example) : '-';
    const encrypted = param.encrypted ? ' (암호화)' : '';
    md += `| \`${param.name}\` | ${param.type} | ${required} | ${param.description}${encrypted} | ${example} |\n`;
  }
  
  md += '\n';
  return md;
}

function generateResponseSection(responses) {
  if (!responses || responses.length === 0) return '';
  
  let md = '### Response Cases\n\n';
  
  for (const response of responses) {
    const isSuccess = response.status >= 200 && response.status < 300;
    const icon = isSuccess ? '✅' : '❌';
    const statusText = response.description ? ` - ${response.description}` : '';
    
    md += `#### ${icon} ${response.name} (${response.status})${statusText}\n\n`;
    md += '```json\n';
    md += JSON.stringify(response.body, null, 2);
    md += '\n```\n\n';
  }
  
  return md;
}

function generateEndpointSection(endpoint, index) {
  let md = `## ${index}. ${endpoint.name}\n\n`;
  md += `**엔드포인트**: \`${endpoint.method} ${endpoint.path}\`\n\n`;
  
  if (endpoint.description) {
    md += `${endpoint.description}\n\n`;
  }
  
  // Request 섹션
  const hasRequest = endpoint.request && (
    (endpoint.request.headers && endpoint.request.headers.length > 0) ||
    (endpoint.request.params && endpoint.request.params.length > 0) ||
    (endpoint.request.query && endpoint.request.query.length > 0) ||
    (endpoint.request.body && endpoint.request.body.length > 0)
  );
  
  if (hasRequest) {
    md += '### Request\n\n';
    
    if (endpoint.request.headers && endpoint.request.headers.length > 0) {
      md += generateParamTable(endpoint.request.headers, 'Headers');
    }
    
    if (endpoint.request.params && endpoint.request.params.length > 0) {
      md += generateParamTable(endpoint.request.params, 'Path Parameters');
    }
    
    if (endpoint.request.query && endpoint.request.query.length > 0) {
      md += generateParamTable(endpoint.request.query, 'Query Parameters');
    }
    
    if (endpoint.request.body && endpoint.request.body.length > 0) {
      md += generateParamTable(endpoint.request.body, 'Body');
    }
  }
  
  // Request Example
  if (endpoint.request_example) {
    md += '### Request Example\n\n';
    md += '```json\n';
    md += JSON.stringify(endpoint.request_example, null, 2);
    md += '\n```\n\n';
  }
  
  // Response 섹션
  md += generateResponseSection(endpoint.responses);
  
  // Notes
  if (endpoint.notes && endpoint.notes.length > 0) {
    md += '### 참고사항\n\n';
    for (const note of endpoint.notes) {
      md += `- ${note}\n`;
    }
    md += '\n';
  }
  
  md += '---\n\n';
  
  return md;
}

function generateDocument(config) {
  let md = `# ${config.title}\n\n`;
  
  // 내용/설명
  if (config.description) {
    md += `## 내용\n${config.description}\n\n`;
    md += '---\n\n';
  }
  
  // 시스템 정보
  if (config.system_info) {
    md += '## 시스템 정보\n\n';
    for (const [key, value] of Object.entries(config.system_info)) {
      md += `- **${key}**: ${value}\n`;
    }
    md += '\n---\n\n';
  }
  
  // Base URL
  if (config.base_url) {
    md += `## Base URL\n\n\`${config.base_url}\`\n\n---\n\n`;
  }
  
  // 엔드포인트들
  if (config.endpoints && config.endpoints.length > 0) {
    md += '## 엔드포인트\n\n';
    
    // 목차
    for (let i = 0; i < config.endpoints.length; i++) {
      const ep = config.endpoints[i];
      md += `${i + 1}. [${ep.name}](#${i + 1}-${ep.name.toLowerCase().replace(/\s+/g, '-')})\n`;
    }
    md += '\n---\n\n';
    
    // 각 엔드포인트 상세
    for (let i = 0; i < config.endpoints.length; i++) {
      md += generateEndpointSection(config.endpoints[i], i + 1);
    }
  }
  
  // 에러 코드
  if (config.error_codes && config.error_codes.length > 0) {
    md += '## 에러 코드\n\n';
    md += '| 코드 | 이름 | 설명 |\n';
    md += '|------|------|------|\n';
    for (const err of config.error_codes) {
      md += `| ${err.code} | \`${err.name}\` | ${err.description} |\n`;
    }
    md += '\n---\n\n';
  }
  
  // 추가 참고사항
  if (config.notes && config.notes.length > 0) {
    md += '## 참고사항\n\n';
    for (let i = 0; i < config.notes.length; i++) {
      md += `${i + 1}. ${config.notes[i]}\n`;
    }
    md += '\n';
  }
  
  return md;
}

// 메인 실행
function main() {
  const options = parseArgs();
  
  if (!options.config) {
    console.error('Error: --config option is required');
    printHelp();
    process.exit(1);
  }
  
  // 설정 파일 읽기
  const configPath = path.resolve(options.config);
  
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }
  
  let config;
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
  } catch (e) {
    console.error(`Error: Failed to parse config file: ${e.message}`);
    process.exit(1);
  }
  
  // 마크다운 생성
  const markdown = generateDocument(config);
  
  // 출력
  if (options.output) {
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`✅ Document generated: ${outputPath}`);
  } else {
    console.log(markdown);
  }
}

main();
