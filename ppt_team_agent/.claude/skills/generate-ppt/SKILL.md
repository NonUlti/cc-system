---
name: generate-ppt
description: 소스 분석부터 디자인, PPTX 생성까지 전체 파이프라인 오케스트레이션
---

요청사항: $ARGUMENTS

너는 파이프라인 오케스트레이터다. 소스 분석부터 슬라이드 구성, 디자인, PPTX 파일 생성까지 전체 프로세스를 관리한다.

## 파이프라인 구조

```
[0. 환경 준비] → [1. 입력 수집] → [2. ppt-source-analyzer: 소스 분석] → [3. ppt-organizer: 구성] → [4. design-slide: 디자인] → [5. create-pptx: 생성] → [6. QA 검수] → [7. 최종 저장]
```

## 옵션 파싱

`$ARGUMENTS`에서 다음을 파싱한다:

- **주제**: 첫 번째 인자 (필수)
- **옵션**:
  - `--slides <N>`: 슬라이드 수 (기본: 주제에 따라 자동 결정)
  - `--style <type>`: 스타일 유형 (기본: formal)
    - `formal`: 비즈니스 보고서, 실적 발표
    - `casual`: 팀 내부 공유, 워크숍
    - `pitch`: 투자유치, 제안서
    - `educational`: 교육, 강의, 세미나
  - `--lang <lang>`: 콘텐츠 언어 (기본: 한국어)
  - `--template <path>`: 기존 PPTX 템플릿 경로 (편집 모드 활성화)
  - `--output <path>`: 출력 경로 (기본: ~/Desktop/{주제}.pptx)
  - `--no-analysis`: 소스 분석 건너뛰기 (사용자가 직접 콘텐츠 제공)
  - `--analysis-only`: 분석+구성까지만 수행 후 결과 저장
  - `--depth <level>`: 분석 깊이
    - `basic`: 핵심 개요 수준
    - `detailed`: 통계/사례 포함 (기본)
    - `comprehensive`: 심층 분석, 다각도 조사
  - `--confluence-page <ID>`: 특정 Confluence 페이지 ID (단일 문서)
  - `--confluence-tree <ID>`: 부모 페이지 ID (해당 페이지 + 하위 전체 문서)
  - `--confluence-space <key>`: Confluence 스페이스 키 (검색 범위 한정)
  - `--confluence-query <query>`: Confluence 내 검색 키워드
  - `--repo <path>`: 코드 레포지토리 경로 (반복 가능)
  - `--file <path>`: 로컬 문서/파일 경로 (반복 가능)
  - `--exclude-sections <section1,section2,...>`: 제외할 섹션명 (쉼표 구분)
    - 예: `--exclude-sections "차세대 전환 전략"` → 해당 섹션 슬라이드를 생성하지 않음
    - 소스 분석에서 해당 내용이 발견되더라도 슬라이드 구성에서 제외
    - 여러 섹션 제외: `--exclude-sections "차세대 전환 전략,향후 계획"`

### 소스 옵션 조합 규칙

| 조합 | 동작 |
|------|------|
| `--confluence-page 12345` | 해당 페이지 1개 읽어서 분석 |
| `--confluence-tree 12345` | 해당 페이지 + 하위 전체 읽어서 분석 |
| `--confluence-space TEAM --confluence-query "Q1 실적"` | 스페이스 내 검색 결과로 분석 |
| `--repo ~/projects/billing` | 코드 레포 구조 분석 |
| `--file ~/docs/spec.md` | 로컬 문서 분석 |
| 소스 옵션 조합 가능 | 여러 소스를 함께 제공하여 종합 분석 |
| 소스 없음 | AskUserQuestion으로 소스 또는 직접 콘텐츠 제공 요청 |

**사용 예시:**
```
/generate-ppt 빌링 시스템 --confluence-page 12345
/generate-ppt 번역 서비스 아키텍처 --confluence-tree 67890
/generate-ppt 멤버쉽 플로우 --repo ~/projects/membership --confluence-page 11111
/generate-ppt 인증 시스템 --file ~/docs/auth-spec.md --confluence-space TEAM --confluence-query "인증"
/generate-ppt 프로젝트 현황 --no-analysis
/generate-ppt 분기 실적 보고 --slides 15 --style formal --confluence-page 12345
/generate-ppt 교육자료 --template ~/templates/company.pptx --file ~/docs/training.md
/generate-ppt 시장분석 --analysis-only --confluence-tree 67890
/generate-ppt 멤버십 시스템 --confluence-tree 12345 --exclude-sections "차세대 전환 전략"
```

## 0단계: 환경 준비 (직접 수행)

PptxGenJS 설치 상태를 확인한다.

```bash
node -e "require('/Users/cjs/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/node_modules/pptxgenjs')"
```

- 성공 시: 다음 단계로 진행
- 실패 시: 자동 설치 실행
  ```bash
  cd ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts && npm install pptxgenjs
  ```

## 1단계: 입력 수집 (직접 수행)

`$ARGUMENTS`에서 주제와 옵션을 파싱한다.

- 주제가 없으면 AskUserQuestion으로 주제를 질문한다
- 명시되지 않은 옵션은 기본값을 사용한다
- `--template`이 지정된 경우 파일 존재 여부를 확인한다
- `--output`이 지정된 경우 디렉토리 존재 여부를 확인한다

파싱 결과를 내부 변수로 정리한다:
```
주제: {topic}
슬라이드 수: {slides}
스타일: {style}
언어: {lang}
템플릿: {template_path | null}
출력 경로: {output_path}
분석 여부: {do_analysis}
분석 깊이: {depth}
Confluence 페이지: {confluence_page | null}
Confluence 트리: {confluence_tree | null}
Confluence 스페이스: {confluence_space | null}
Confluence 검색어: {confluence_query | null}
레포 경로: {repo_paths | []}
파일 경로: {file_paths | []}
제외 섹션: {exclude_sections | []}
```

### 소스 유효성 검사

소스 옵션(`--confluence-page`, `--confluence-tree`, `--confluence-query`, `--repo`, `--file`) 중 최소 하나가 필요하다.
- 모두 없으면 AskUserQuestion으로 사용자에게 질문:
  - "분석할 소스를 알려주세요. Confluence 페이지 ID, 코드 레포 경로, 또는 로컬 파일 경로를 제공해주세요. 직접 콘텐츠를 제공하시려면 말씀해주세요."

## 2단계: ppt-source-analyzer (소스 분석)

`--no-analysis` 플래그 시 이 단계를 건너뛴다. 대신 AskUserQuestion으로 사용자에게 슬라이드에 넣을 콘텐츠를 직접 수집한다.

- `~/.claude/ppt_team_agent/.claude/agents/ppt-source-analyzer.md` 내용을 읽어서 역할 지시로 전달
- Task tool로 서브에이전트를 생성한다 (**model: `opus`** — 소스 분석 품질과 구조 파악이 중요)
- 프롬프트에 포함:
  - 주제: `{topic}`
  - 분석 깊이: `{depth}`
  - 스타일: `{style}` (발표 맥락 참고용)
  - 언어: `{lang}`
  - 소스 목록: `{confluence_page}`, `{confluence_tree}`, `{confluence_space}`, `{confluence_query}`, `{repo_paths}`, `{file_paths}` (해당 시)

- 서브에이전트 결과: 분석 마크다운 문서 (핵심 내용, 구조, 플로우, 인사이트)

## 3단계: ppt-organizer (슬라이드 구성)

`--analysis-only` 플래그 시 이 단계에서 중간 결과를 저장하고 파이프라인을 종료한다.

- `~/.claude/ppt_team_agent/.claude/agents/ppt-organizer.md` 내용을 읽어서 역할 지시로 전달
- Task tool로 서브에이전트를 생성한다 (**model: `opus`** — 내러티브 설계와 슬라이드 구성 품질이 중요)
- 프롬프트에 포함:
  - ANALYSIS: 분석 결과 전문 (2단계 출력)
  - SLIDE_COUNT: `{slides}`
  - STYLE: `{style}`
  - LANGUAGE: `{lang}`
  - EXCLUDE_SECTIONS: `{exclude_sections}` (해당 시)
- 서브에이전트 결과: 슬라이드 구성 JSON (각 슬라이드의 type, title, content, notes, color_suggestion 등)

`--analysis-only` 시 종료 처리:
- 분석 마크다운 → `~/Desktop/{주제}_분석.md`로 저장
- 슬라이드 구성 JSON → `~/Desktop/{주제}_구성.json`으로 저장
- 사용자에게 파일 경로 안내 후 종료

## 4단계: design-slide (디자인 코드 생성)

design-slide 스킬 로직을 적용한다.

1. `~/.claude/ppt_team_agent/.claude/skills/design-slide/design-guide.md`를 읽어 디자인 원칙 로드
2. 슬라이드 구성 JSON의 `color_suggestion`과 `{style}`을 기반으로 테마 결정:
   - 색상 팔레트 (주색, 보조색, 강조색) hex 코드 확정
   - 제목/본문 폰트 확정
   - 시각 모티프 결정
3. 각 슬라이드에 대해 PptxGenJS 코드를 생성:
   - 슬라이드 유형별 레이아웃 적용
   - 60-30-10 색상 비율 준수
   - 안티패턴 회피 확인
4. 완전한 실행 가능 JavaScript 코드 조립

### 코드 생성 필수 규칙

- 색상값에 `#` prefix 사용 금지 (PptxGenJS convention)
- 각 요소마다 새 options 객체 생성 (객체 재사용 금지)
- `bullet: true`로 리스트 처리
- LAYOUT_WIDE (13.33 x 7.5 인치) 기준
- 한글 폰트 직접 지정 (`fontFace: "Pretendard"` 등)

## 5단계: create-pptx (파일 생성)

create-pptx 스킬 로직을 적용한다.

### 템플릿 없는 경우 (생성 모드)

1. `~/.claude/ppt_team_agent/.claude/skills/create-pptx/pptxgenjs-reference.md`를 참조
2. 4단계 코드의 `require("pptxgenjs")` 경로를 로컬 경로로 교체:
   ```javascript
   const PptxGenJS = require("/Users/cjs/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/node_modules/pptxgenjs");
   ```
3. `OUTPUT_PATH`를 `{output_path}`로 교체
4. 임시 JS 파일로 저장 후 `node` 실행
5. 임시 파일 정리

### 템플릿 있는 경우 (편집 모드)

1. `~/.claude/ppt_team_agent/.claude/skills/create-pptx/editing-reference.md`를 참조
2. 언팩:
   ```bash
   python3 ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/office/unpack.py {template_path} /tmp/pptx_work_<timestamp>
   ```
3. 슬라이드 XML 편집 (텍스트, 색상, 레이아웃 변경)
4. 클린업:
   ```bash
   python3 ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/clean.py /tmp/pptx_work_<timestamp>
   ```
5. 팩:
   ```bash
   python3 ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/office/pack.py /tmp/pptx_work_<timestamp> {output_path}
   ```
6. 작업 디렉토리 정리

## 6단계: QA 검수 (직접 수행)

생성된 PPTX 파일을 검수한다. 문제 발견 시 수정 후 재생성을 최대 2회 반복한다.

### 기본 검증

- 파일 존재 확인
- 파일 크기 확인 (최소 10KB 이상)
- `unzip -l {output_path}` 로 내부 구조 확인:
  - `[Content_Types].xml` 존재
  - `ppt/slides/slide*.xml` 파일 수가 예상 슬라이드 수와 일치

### 썸네일 검증 (soffice 가용 시)

LibreOffice가 설치되어 있으면 썸네일을 생성하여 시각적으로 검수한다:

```bash
soffice --headless --convert-to png --outdir /tmp/pptx_preview {output_path}
```

- 생성된 이미지가 있으면 Read tool로 확인하여 레이아웃, 텍스트 가독성 등을 점검
- soffice가 없으면 이 단계를 건너뛴다

### 수정 루프

- 문제 발견 시: 4단계(코드 수정) → 5단계(재생성) → 6단계(재검수)
- 최대 2회 재시도 후에도 문제가 남으면 사용자에게 현황을 보고하고 계속 진행

## 7단계: 최종 저장 (직접 수행)

- PPTX 파일을 `{output_path}`에 저장 (기본: `~/Desktop/{주제}.pptx`)
- 부가 산출물 저장 (선택):
  - 분석 마크다운: `~/Desktop/{주제}_분석.md`
  - 슬라이드 구성 JSON: `~/Desktop/{주제}_구성.json`
- 사용자에게 최종 안내:
  - PPTX 파일 경로
  - 슬라이드 수
  - 적용된 테마/스타일
  - 부가 산출물 경로 (있는 경우)

## 모델 배정

| 컴포넌트 | 모델 | 이유 |
|----------|------|------|
| generate-ppt (오케스트레이터) | opus | 전체 흐름 제어 + QA 판단 |
| ppt-source-analyzer (소스 분석) | opus | 소스 분석 품질, 구조 파악 |
| ppt-organizer (구성) | opus | 내러티브 설계, 슬라이드 구성 품질 |
| design-slide (디자인) | sonnet | 패턴 기반 코드 생성 |
| create-pptx (생성) | sonnet | 경로 치환, 스크립트 실행 |

Task tool 호출 시 반드시 `model` 파라미터를 위 표에 맞게 지정한다.

## 에이전트/스킬 경로 요약

| 리소스 | 경로 |
|--------|------|
| ppt-source-analyzer 에이전트 | `~/.claude/ppt_team_agent/.claude/agents/ppt-source-analyzer.md` |
| ppt-organizer 에이전트 | `~/.claude/ppt_team_agent/.claude/agents/ppt-organizer.md` |
| 디자인 가이드 | `~/.claude/ppt_team_agent/.claude/skills/design-slide/design-guide.md` |
| PptxGenJS 레퍼런스 | `~/.claude/ppt_team_agent/.claude/skills/create-pptx/pptxgenjs-reference.md` |
| XML 편집 레퍼런스 | `~/.claude/ppt_team_agent/.claude/skills/create-pptx/editing-reference.md` |
| 스크립트 디렉토리 | `~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/` |
