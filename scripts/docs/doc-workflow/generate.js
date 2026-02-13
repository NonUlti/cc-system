#!/usr/bin/env node

/**
 * 문서 생성기 - JSON → 마크다운 (타입별 형식 내장)
 * 
 * Usage:
 *   node generate.js --type api --json <data.json>
 *   node generate.js --type class --json <data.json>
 *   echo '{}' | node generate.js --type api --stdin
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' || args[i] === '-t') options.type = args[++i];
    else if (args[i] === '--json' || args[i] === '-j') options.json = args[++i];
    else if (args[i] === '--stdin') options.stdin = true;
    else if (args[i] === '--output' || args[i] === '-o') options.output = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
  }
  
  return options;
}

function printHelp() {
  console.log(`
문서 생성기 - JSON → 마크다운

Usage:
  node generate.js --type <type> --json <data.json>
  node generate.js --type <type> --stdin
  node generate.js --type <type> --json <data.json> --output <output.md>

Options:
  -t, --type <type>     문서 타입 (api, class, flow, overview)
  -j, --json <file>     JSON 데이터 파일
  --stdin               stdin으로 JSON 입력
  -o, --output <file>   출력 파일 (없으면 stdout)
  -h, --help            도움말

Document Types:
  api       - API/엔드포인트 문서
  class     - 클래스/모듈 문서
  flow      - 플로우/프로세스 문서
  overview  - 개요/구조 문서

JSON Schema (--type api):
  {
    "title": "API 제목",
    "description": "설명",
    "endpoints": [
      {
        "name": "엔드포인트명",
        "method": "POST",
        "path": "/path",
        "request": { "params": [...] },
        "responses": [{ "status": 200, "name": "성공", "body": {} }]
      }
    ]
  }

JSON Schema (--type class):
  {
    "title": "클래스명",
    "description": "설명",
    "methods": [
      { "name": "메서드명", "params": [...], "returns": "타입", "description": "설명" }
    ],
    "properties": [
      { "name": "프로퍼티명", "type": "타입", "description": "설명" }
    ]
  }

JSON Schema (--type flow):
  {
    "title": "플로우 제목",
    "description": "설명",
    "steps": [
      { "name": "단계명", "description": "설명", "conditions": [...] }
    ]
  }

JSON Schema (--type overview):
  {
    "title": "개요 제목",
    "description": "설명",
    "structure": [
      { "path": "경로", "description": "설명" }
    ],
    "components": [
      { "name": "컴포넌트명", "role": "역할", "dependencies": [...] }
    ]
  }
  `);
}

// ==================== 공통 유틸 ====================

function formatValue(value) {
  if (value === null || value === undefined) return '`null`';
  if (typeof value === 'string') return `\`"${value}"\``;
  if (typeof value === 'boolean') return `\`${value}\``;
  if (typeof value === 'number') return `\`${value}\``;
  return `\`${JSON.stringify(value)}\``;
}

function generateTable(headers, rows) {
  let md = '| ' + headers.join(' | ') + ' |\n';
  md += '|' + headers.map(() => '------').join('|') + '|\n';
  for (const row of rows) {
    md += '| ' + row.join(' | ') + ' |\n';
  }
  return md;
}

// ==================== API 문서 ====================

function generateApiDoc(data) {
  let md = `# ${data.title}\n\n`;
  
  if (data.description) {
    md += `## 내용\n${data.description}\n\n---\n\n`;
  }
  
  if (data.base_url) {
    md += `## Base URL\n\n\`${data.base_url}\`\n\n---\n\n`;
  }
  
  if (data.endpoints && data.endpoints.length > 0) {
    for (let i = 0; i < data.endpoints.length; i++) {
      const ep = data.endpoints[i];
      md += `## ${i + 1}. ${ep.name}\n\n`;
      md += `**엔드포인트**: \`${ep.method} ${ep.path}\`\n\n`;
      
      if (ep.description) md += `${ep.description}\n\n`;
      
      // Request
      if (ep.request) {
        const sections = ['headers', 'params', 'query', 'body'];
        const titles = ['Headers', 'Path Parameters', 'Query Parameters', 'Body'];
        
        for (let j = 0; j < sections.length; j++) {
          const params = ep.request[sections[j]];
          if (params && params.length > 0) {
            md += `### ${titles[j]}\n\n`;
            md += generateTable(
              ['필드', '타입', '필수', '설명', '예시'],
              params.map(p => [
                `\`${p.name}\``,
                p.type || '-',
                p.required ? '✓' : '○',
                p.description || '-',
                p.example !== undefined ? formatValue(p.example) : '-'
              ])
            );
            md += '\n';
          }
        }
      }
      
      // Response
      if (ep.responses && ep.responses.length > 0) {
        md += '### Response\n\n';
        for (const res of ep.responses) {
          const isSuccess = res.status >= 200 && res.status < 300;
          const icon = isSuccess ? '✅' : '❌';
          md += `#### ${icon} ${res.name} (${res.status})\n\n`;
          md += '```json\n' + JSON.stringify(res.body, null, 2) + '\n```\n\n';
        }
      }
      
      md += '---\n\n';
    }
  }
  
  // Error Codes
  if (data.error_codes && data.error_codes.length > 0) {
    md += '## 에러 코드\n\n';
    md += generateTable(
      ['코드', '이름', '설명'],
      data.error_codes.map(e => [e.code, `\`${e.name}\``, e.description])
    );
    md += '\n';
  }
  
  return md;
}

// ==================== Class 문서 ====================

function generateClassDoc(data) {
  let md = `# ${data.title}\n\n`;
  
  if (data.description) {
    md += `## 내용\n${data.description}\n\n---\n\n`;
  }
  
  if (data.file) {
    md += `## 소스 위치\n\n\`${data.file}\`\n\n---\n\n`;
  }
  
  // Properties
  if (data.properties && data.properties.length > 0) {
    md += '## 프로퍼티\n\n';
    md += generateTable(
      ['이름', '타입', '설명'],
      data.properties.map(p => [`\`${p.name}\``, p.type || '-', p.description || '-'])
    );
    md += '\n---\n\n';
  }
  
  // Methods
  if (data.methods && data.methods.length > 0) {
    md += '## 메서드\n\n';
    
    for (const method of data.methods) {
      md += `### ${method.name}\n\n`;
      
      if (method.description) md += `${method.description}\n\n`;
      
      // Signature
      const params = method.params ? method.params.map(p => 
        typeof p === 'string' ? p : `${p.name}: ${p.type || 'any'}`
      ).join(', ') : '';
      const returns = method.returns || 'void';
      md += `\`\`\`\n${method.name}(${params}): ${returns}\n\`\`\`\n\n`;
      
      // Parameters
      if (method.params && method.params.length > 0 && typeof method.params[0] === 'object') {
        md += '**파라미터**\n\n';
        md += generateTable(
          ['이름', '타입', '필수', '설명'],
          method.params.map(p => [
            `\`${p.name}\``,
            p.type || '-',
            p.required ? '✓' : '○',
            p.description || '-'
          ])
        );
        md += '\n';
      }
      
      // Return
      if (method.returns_description) {
        md += `**반환값**: ${method.returns_description}\n\n`;
      }
    }
    md += '---\n\n';
  }
  
  // Dependencies
  if (data.dependencies && data.dependencies.length > 0) {
    md += '## 의존성\n\n';
    for (const dep of data.dependencies) {
      md += `- \`${dep}\`\n`;
    }
    md += '\n';
  }
  
  return md;
}

// ==================== Flow 문서 ====================

function generateFlowDoc(data) {
  let md = `# ${data.title}\n\n`;
  
  if (data.description) {
    md += `## 내용\n${data.description}\n\n---\n\n`;
  }
  
  // Steps
  if (data.steps && data.steps.length > 0) {
    md += '## 플로우\n\n';
    
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      md += `### ${i + 1}. ${step.name}\n\n`;
      
      if (step.description) md += `${step.description}\n\n`;
      
      if (step.conditions && step.conditions.length > 0) {
        md += '**조건 분기**\n\n';
        for (const cond of step.conditions) {
          md += `- **${cond.condition}**: ${cond.action}\n`;
        }
        md += '\n';
      }
      
      if (step.api) {
        md += `**API**: \`${step.api}\`\n\n`;
      }
      
      if (step.next) {
        md += `**다음 단계**: ${step.next}\n\n`;
      }
    }
    md += '---\n\n';
  }
  
  // Diagram (Mermaid)
  if (data.diagram) {
    md += '## 다이어그램\n\n';
    md += '```mermaid\n' + data.diagram + '\n```\n\n';
  }
  
  return md;
}

// ==================== Overview 문서 ====================

function generateOverviewDoc(data) {
  let md = `# ${data.title}\n\n`;
  
  if (data.description) {
    md += `## 내용\n${data.description}\n\n---\n\n`;
  }
  
  // Structure
  if (data.structure && data.structure.length > 0) {
    md += '## 디렉토리 구조\n\n```\n';
    for (const item of data.structure) {
      md += `${item.path}\n`;
    }
    md += '```\n\n';
    
    // Description table
    const withDesc = data.structure.filter(s => s.description);
    if (withDesc.length > 0) {
      md += generateTable(
        ['경로', '설명'],
        withDesc.map(s => [`\`${s.path}\``, s.description])
      );
      md += '\n';
    }
    md += '---\n\n';
  }
  
  // Components
  if (data.components && data.components.length > 0) {
    md += '## 주요 컴포넌트\n\n';
    md += generateTable(
      ['컴포넌트', '역할', '의존성'],
      data.components.map(c => [
        `\`${c.name}\``,
        c.role || '-',
        c.dependencies ? c.dependencies.map(d => `\`${d}\``).join(', ') : '-'
      ])
    );
    md += '\n---\n\n';
  }
  
  // Files
  if (data.files && data.files.length > 0) {
    md += '## 파일별 역할\n\n';
    md += generateTable(
      ['파일', '역할', '관련 API'],
      data.files.map(f => [
        `\`${f.name}\``,
        f.role || '-',
        f.api || '-'
      ])
    );
    md += '\n';
  }
  
  return md;
}

// ==================== 메인 ====================

async function main() {
  const options = parseArgs();
  
  if (!options.type) {
    console.error('Error: --type option is required');
    printHelp();
    process.exit(1);
  }
  
  if (!options.json && !options.stdin) {
    console.error('Error: --json or --stdin option is required');
    printHelp();
    process.exit(1);
  }
  
  // JSON 읽기
  let data;
  
  if (options.stdin) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    data = JSON.parse(Buffer.concat(chunks).toString());
  } else {
    const jsonPath = path.resolve(options.json);
    if (!fs.existsSync(jsonPath)) {
      console.error(`Error: JSON file not found: ${jsonPath}`);
      process.exit(1);
    }
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }
  
  // 마크다운 생성
  let markdown;
  
  switch (options.type) {
    case 'api':
      markdown = generateApiDoc(data);
      break;
    case 'class':
      markdown = generateClassDoc(data);
      break;
    case 'flow':
      markdown = generateFlowDoc(data);
      break;
    case 'overview':
      markdown = generateOverviewDoc(data);
      break;
    default:
      console.error(`Error: Unknown type: ${options.type}`);
      console.error('Available types: api, class, flow, overview');
      process.exit(1);
  }
  
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
