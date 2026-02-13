#!/usr/bin/env node
/**
 * JSON → draw.io XML 변환 스크립트
 *
 * 사용법:
 *   node generate-drawio.js --input <input.json> --output <output.drawio>
 *   echo '<json>' | node generate-drawio.js --output <output.drawio>
 *
 * JSON 형식:
 * {
 *   "pages": [
 *     {
 *       "name": "페이지 이름",
 *       "direction": "vertical" | "horizontal",   // 기본: vertical
 *       "nodes": [
 *         { "id": "1", "label": "텍스트", "type": "process" }
 *       ],
 *       "edges": [
 *         { "from": "1", "to": "2", "label": "라벨(선택)", "style": "dashed(선택)" }
 *       ]
 *     }
 *   ]
 * }
 *
 * 노드 type: process | decision | start | end | error
 */

const fs = require('fs');
const path = require('path');

// --- 스타일 프리셋 ---
const STYLES = {
  process:  'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;',
  decision: 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;',
  start:    'ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;',
  end:      'ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;',
  error:    'rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;',
};

const SIZES = {
  process:  { w: 160, h: 40 },
  decision: { w: 140, h: 70 },
  start:    { w: 140, h: 40 },
  end:      { w: 140, h: 40 },
  error:    { w: 160, h: 40 },
};

const EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;';
const EDGE_DASHED = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;';

const GAP_V = 80;
const GAP_H = 200;

// --- 레이아웃 ---
function layoutNodes(nodes, edges, direction) {
  const positions = {};
  const children = {};
  const parents = {};

  edges.forEach(e => {
    if (!children[e.from]) children[e.from] = [];
    children[e.from].push(e.to);
    if (!parents[e.to]) parents[e.to] = [];
    parents[e.to].push(e.from);
  });

  // BFS로 레벨 할당
  const roots = nodes.filter(n => !parents[n.id] || parents[n.id].length === 0);
  if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0]);

  const levels = {};
  const visited = new Set();
  const queue = roots.map(r => ({ id: r.id, level: 0 }));
  roots.forEach(r => { visited.add(r.id); levels[r.id] = 0; });

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    const kids = children[id] || [];
    kids.forEach(kid => {
      if (!visited.has(kid)) {
        visited.add(kid);
        levels[kid] = level + 1;
        queue.push({ id: kid, level: level + 1 });
      }
    });
  }

  // 방문되지 않은 노드 처리
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      levels[n.id] = 0;
    }
  });

  // 레벨별 노드 그룹핑
  const levelGroups = {};
  nodes.forEach(n => {
    const lv = levels[n.id] || 0;
    if (!levelGroups[lv]) levelGroups[lv] = [];
    levelGroups[lv].push(n);
  });

  const isVertical = direction !== 'horizontal';

  Object.keys(levelGroups).sort((a, b) => a - b).forEach(lv => {
    const group = levelGroups[lv];
    const lvNum = parseInt(lv);
    group.forEach((node, idx) => {
      const size = SIZES[node.type] || SIZES.process;
      const totalWidth = group.length * size.w + (group.length - 1) * (isVertical ? GAP_H : GAP_V);
      const offset = -totalWidth / 2 + idx * (size.w + (isVertical ? GAP_H : GAP_V));

      if (isVertical) {
        positions[node.id] = {
          x: 400 + offset,
          y: 40 + lvNum * (size.h + GAP_V),
        };
      } else {
        positions[node.id] = {
          x: 40 + lvNum * (size.w + GAP_H),
          y: 300 + offset,
        };
      }
    });
  });

  return positions;
}

// --- XML 생성 ---
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generatePage(page, pageIndex) {
  const dir = page.direction || 'vertical';
  const positions = layoutNodes(page.nodes || [], page.edges || [], dir);
  const cells = [];
  let cellId = 2; // 0, 1은 root

  const idMap = {};

  // 노드 생성
  (page.nodes || []).forEach(node => {
    const id = cellId++;
    idMap[node.id] = id;
    const size = SIZES[node.type] || SIZES.process;
    const style = STYLES[node.type] || STYLES.process;
    const pos = positions[node.id] || { x: 0, y: 0 };

    cells.push(
      `        <mxCell id="${id}" value="${escapeXml(node.label)}" style="${style}" vertex="1" parent="1">` +
      `\n          <mxGeometry x="${pos.x}" y="${pos.y}" width="${size.w}" height="${size.h}" as="geometry" />` +
      `\n        </mxCell>`
    );
  });

  // 엣지 생성
  (page.edges || []).forEach(edge => {
    const id = cellId++;
    const src = idMap[edge.from];
    const tgt = idMap[edge.to];
    if (src === undefined || tgt === undefined) return;

    const style = edge.style === 'dashed' ? EDGE_DASHED : EDGE_STYLE;
    const label = edge.label ? ` value="${escapeXml(edge.label)}"` : '';

    cells.push(
      `        <mxCell id="${id}"${label} style="${style}" edge="1" source="${src}" target="${tgt}" parent="1">` +
      `\n          <mxGeometry relative="1" as="geometry" />` +
      `\n        </mxCell>`
    );
  });

  const name = escapeXml(page.name || `Page-${pageIndex + 1}`);
  return `  <diagram id="page${pageIndex}" name="${name}">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

function generate(data) {
  const pages = (data.pages || []).map((p, i) => generatePage(p, i));
  return `<mxfile host="app.diagrams.net">\n${pages.join('\n')}\n</mxfile>\n`;
}

// --- CLI ---
function main() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let outputFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputFile = args[++i];
    if (args[i] === '--output' && args[i + 1]) outputFile = args[++i];
  }

  let jsonStr;
  if (inputFile) {
    jsonStr = fs.readFileSync(inputFile, 'utf8');
  } else if (!process.stdin.isTTY) {
    jsonStr = fs.readFileSync('/dev/stdin', 'utf8');
  } else {
    console.error('Usage: node generate-drawio.js --input <file.json> --output <file.drawio>');
    console.error('   or: echo \'{"pages":[...]}\' | node generate-drawio.js --output <file.drawio>');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON 파싱 오류:', e.message);
    process.exit(1);
  }

  const xml = generate(data);

  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, xml, 'utf8');
    console.log(`생성 완료: ${outputFile}`);
  } else {
    process.stdout.write(xml);
  }
}

main();
