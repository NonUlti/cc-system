#!/usr/bin/env node

/**
 * API 문서 포맷터 - 마크다운 조각 생성
 * 
 * Usage:
 *   node format-api.js --type request --params "userId:string:Y:사용자ID,password:string:Y:비밀번호"
 *   node format-api.js --type response --json '{"code":0,"message":"SUCCESS"}'
 *   node format-api.js --type response --json '{"code":-1001,"message":"ERROR"}' --status 401 --name "실패"
 */

const args = process.argv.slice(2);

function parseArgs() {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type') options.type = args[++i];
    else if (args[i] === '--params') options.params = args[++i];
    else if (args[i] === '--json') options.json = args[++i];
    else if (args[i] === '--status') options.status = args[++i];
    else if (args[i] === '--name') options.name = args[++i];
    else if (args[i] === '--help') { printHelp(); process.exit(0); }
  }
  return options;
}

function printHelp() {
  console.log(`
API 문서 포맷터

Usage:
  # Request 파라미터 테이블 생성
  node format-api.js --type request --params "필드:타입:필수:설명:예시,..."
  
  # Response JSON 블록 생성  
  node format-api.js --type response --json '{"code":0}' --status 200 --name "성공"

Examples:
  node format-api.js --type request --params "userId:string:Y:사용자 ID:user123,password:string:Y:비밀번호"
  node format-api.js --type response --json '{"code":0,"msg":"SUCCESS"}' --status 200 --name "성공"
  `);
}

// Request 파라미터 테이블 생성
function formatRequest(paramsStr) {
  const rows = paramsStr.split(',').map(p => {
    const [name, type, required, desc, example] = p.split(':');
    const req = required === 'Y' ? '✓' : '○';
    const ex = example ? `\`"${example}"\`` : '-';
    return `| \`${name}\` | ${type} | ${req} | ${desc} | ${ex} |`;
  });
  
  return `| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
${rows.join('\n')}`;
}

// Response JSON 블록 생성
function formatResponse(jsonStr, status = 200, name = '성공') {
  const isSuccess = status >= 200 && status < 300;
  const icon = isSuccess ? '✅' : '❌';
  let formatted;
  
  try {
    formatted = JSON.stringify(JSON.parse(jsonStr), null, 2);
  } catch {
    formatted = jsonStr;
  }
  
  return `#### ${icon} ${name} (${status})

\`\`\`json
${formatted}
\`\`\``;
}

// 메인
const opts = parseArgs();

if (opts.type === 'request' && opts.params) {
  console.log(formatRequest(opts.params));
} else if (opts.type === 'response' && opts.json) {
  console.log(formatResponse(opts.json, opts.status || 200, opts.name || '성공'));
} else {
  printHelp();
}
