#!/usr/bin/env node

/**
 * 코드 분석기 - 파일에서 구조 정보 추출
 * 
 * Usage:
 *   node analyze.js --file <source-file>
 *   node analyze.js --dir <source-dir> --pattern "*.php"
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' || args[i] === '-f') options.file = args[++i];
    else if (args[i] === '--dir' || args[i] === '-d') options.dir = args[++i];
    else if (args[i] === '--pattern' || args[i] === '-p') options.pattern = args[++i];
    else if (args[i] === '--type' || args[i] === '-t') options.type = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
  }
  
  return options;
}

function printHelp() {
  console.log(`
코드 분석기 - 파일에서 구조 정보 추출

Usage:
  node analyze.js --file <source-file> [--type <php|js>]
  node analyze.js --dir <source-dir> --pattern "*.php"

Options:
  -f, --file <file>       분석할 파일 경로
  -d, --dir <dir>         분석할 디렉토리
  -p, --pattern <glob>    파일 패턴 (--dir와 함께 사용)
  -t, --type <type>       파일 타입 (php, js) - 자동 감지됨
  -h, --help              도움말

Output (JSON):
  {
    "file": "파일경로",
    "type": "php|js",
    "classes": [...],
    "functions": [...],
    "constants": [...],
    "dependencies": [...]
  }

Examples:
  node analyze.js --file src/AuthService.php
  node analyze.js --dir src/services --pattern "*.php"
  `);
}

// PHP 파일 분석
function analyzePhp(content, filePath) {
  const result = {
    file: filePath,
    type: 'php',
    classes: [],
    functions: [],
    constants: [],
    dependencies: []
  };
  
  // require/include 추출
  const requireRegex = /(?:require|include)(?:_once)?\s*[\(\s]['"](.*?)['"]/g;
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    result.dependencies.push(match[1]);
  }
  
  // 클래스 추출
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
  while ((match = classRegex.exec(content)) !== null) {
    const classInfo = {
      name: match[1],
      extends: match[2] || null,
      implements: match[3] ? match[3].split(',').map(s => s.trim()) : [],
      methods: [],
      properties: []
    };
    result.classes.push(classInfo);
  }
  
  // 함수 추출 (클래스 외부)
  const funcRegex = /(?:public|private|protected|static|\s)*function\s+(\w+)\s*\((.*?)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcInfo = {
      name: match[1],
      params: match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p) : []
    };
    result.functions.push(funcInfo);
  }
  
  // 상수 추출
  const constRegex = /(?:const|define\s*\()\s*['"]*(\w+)['"]*\s*(?:=|,)\s*(.+?)(?:;|\))/g;
  while ((match = constRegex.exec(content)) !== null) {
    result.constants.push({
      name: match[1],
      value: match[2].trim()
    });
  }
  
  return result;
}

// JS 파일 분석
function analyzeJs(content, filePath) {
  const result = {
    file: filePath,
    type: 'js',
    classes: [],
    functions: [],
    exports: [],
    imports: []
  };
  
  // import 추출
  const importRegex = /import\s+(?:(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+)?['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    result.imports.push({
      named: match[1] ? match[1].split(',').map(s => s.trim()) : [],
      namespace: match[2] || null,
      default: match[3] || null,
      from: match[4]
    });
  }
  
  // require 추출
  const requireRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"](.*?)['"]\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    result.imports.push({
      named: match[1] ? match[1].split(',').map(s => s.trim()) : [],
      default: match[2] || null,
      from: match[3]
    });
  }
  
  // 클래스 추출
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
  while ((match = classRegex.exec(content)) !== null) {
    result.classes.push({
      name: match[1],
      extends: match[2] || null
    });
  }
  
  // 함수 추출
  const funcRegex = /(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    if (name) {
      result.functions.push({ name });
    }
  }
  
  // export 추출
  const exportRegex = /export\s+(?:default\s+)?(?:(?:const|let|var|function|class)\s+)?(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    result.exports.push(match[1]);
  }
  
  return result;
}

// 파일 분석
function analyzeFile(filePath, type) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = type || path.extname(filePath).slice(1);
  
  if (ext === 'php') {
    return analyzePhp(content, filePath);
  } else if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
    return analyzeJs(content, filePath);
  } else {
    console.error(`Error: Unsupported file type: ${ext}`);
    process.exit(1);
  }
}

// 디렉토리 분석
function analyzeDir(dirPath, pattern) {
  const glob = require('path');
  const results = [];
  
  const walkDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (!pattern || matchPattern(file, pattern)) {
        try {
          results.push(analyzeFile(filePath));
        } catch (e) {
          // Skip files that can't be analyzed
        }
      }
    }
  };
  
  walkDir(dirPath);
  return results;
}

// 간단한 패턴 매칭
function matchPattern(filename, pattern) {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return regex.test(filename);
}

// 메인
function main() {
  const options = parseArgs();
  
  if (!options.file && !options.dir) {
    console.error('Error: --file or --dir option is required');
    printHelp();
    process.exit(1);
  }
  
  let result;
  
  if (options.file) {
    result = analyzeFile(path.resolve(options.file), options.type);
  } else if (options.dir) {
    result = analyzeDir(path.resolve(options.dir), options.pattern || '*');
  }
  
  console.log(JSON.stringify(result, null, 2));
}

main();
