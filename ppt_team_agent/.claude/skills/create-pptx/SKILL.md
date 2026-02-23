---
name: create-pptx
description: PptxGenJS 코드 실행 또는 기존 PPTX 템플릿 편집으로 프레젠테이션 파일을 생성
model: sonnet
---

요청사항: $ARGUMENTS

너는 PPTX 파일 생성/편집 실행기다. PptxGenJS 코드를 실행하여 새 파일을 생성하거나, 기존 PPTX 템플릿의 XML을 직접 편집한다.

## 파이프라인 구조

```
[1. 입력 수집] → [2. 모드 결정 (생성/편집)] → [3A. PptxGenJS 실행 / 3B. XML 편집] → [4. 검증] → [5. 출력]
```

## 1단계: 입력 수집 (직접 수행)

`$ARGUMENTS` 또는 컨텍스트에서 다음을 파싱한다:

- **생성 모드 입력**: design-slide 스킬이 생성한 JavaScript 코드 문자열
- **편집 모드 입력**: 기존 PPTX 템플릿 경로 + 편집 지시사항
- **출력 경로**: 최종 PPTX 파일을 저장할 경로

## 2단계: 모드 결정 (직접 수행)

입력에 따라 실행 모드를 결정한다:

| 조건 | 모드 | 설명 |
|------|------|------|
| 템플릿 없음 + JS 코드 있음 | **생성 모드** | PptxGenJS로 새 파일 생성 |
| 템플릿 경로 있음 | **편집 모드** | XML 직접 편집으로 기존 파일 수정 |

## 3A단계: 생성 모드 - PptxGenJS 실행 (직접 수행)

### 참조 문서

`~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/pptxgenjs-reference.md`를 읽어 PptxGenJS API 상세를 확인한다.

### 실행 절차

1. **require 경로 조정**: 코드 내 `require("pptxgenjs")`를 로컬 설치 경로로 교체:
   ```javascript
   const PptxGenJS = require("/Users/cjs/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/node_modules/pptxgenjs");
   ```

2. **출력 경로 설정**: `OUTPUT_PATH` 플레이스홀더를 실제 경로로 교체

3. **임시 파일 저장**: 조정된 JS 코드를 임시 파일로 저장
   ```bash
   # 임시 파일 경로 예시
   /tmp/pptx_gen_<timestamp>.js
   ```

4. **실행**: Node.js로 코드를 실행
   ```bash
   node /tmp/pptx_gen_<timestamp>.js
   ```

5. **임시 파일 정리**: 실행 완료 후 임시 JS 파일 삭제

### 실행 오류 처리

- 오류 발생 시 에러 메시지를 분석하여 코드 수정을 시도한다
- 최대 2회 재시도 후에도 실패하면 사용자에게 오류 내용을 보고한다
- 흔한 오류:
  - `#` prefix 포함 색상값 → `#` 제거
  - undefined property 접근 → 옵션 객체 분리
  - 폰트 미설치 → 대체 폰트로 변경

## 3B단계: 편집 모드 - XML 편집 (직접 수행)

### 참조 문서

`~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/editing-reference.md`를 읽어 PPTX XML 구조를 확인한다.

### 실행 절차

1. **언팩**: PPTX 파일을 작업 디렉토리로 풀기
   ```bash
   python3 ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/office/unpack.py <template.pptx> <work-dir>
   ```

2. **슬라이드 XML 편집**: `<work-dir>/ppt/slides/slide*.xml` 파일을 직접 편집
   - 텍스트 변경, 색상 변경, 레이아웃 조정 등
   - OOXML 스펙에 맞게 XML 태그 수정

3. **클린업**: 불필요한 요소 정리
   ```bash
   python3 ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/clean.py <work-dir>
   ```

4. **팩**: 작업 디렉토리를 PPTX로 재포장
   ```bash
   python3 ~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/office/pack.py <work-dir> <output.pptx>
   ```

5. **작업 디렉토리 정리**: 편집 완료 후 작업 디렉토리 삭제

## 4단계: 검증 (직접 수행)

생성/편집된 PPTX 파일을 검증한다:

- **파일 존재 확인**: 출력 경로에 파일이 생성되었는지 확인
- **파일 크기 확인**: 0바이트가 아닌지, 비정상적으로 작거나 크지 않은지 확인 (최소 10KB 이상)
- **구조 검증**: `unzip -l <output.pptx>` 로 PPTX 내부 구조가 정상인지 확인
  - `[Content_Types].xml` 존재 여부
  - `ppt/slides/` 디렉토리 내 슬라이드 파일 존재 여부
  - 예상 슬라이드 수와 실제 슬라이드 파일 수 일치 여부

## 5단계: 출력 (직접 수행)

- 검증을 통과한 PPTX 파일의 최종 경로를 반환한다
- 파일 크기, 슬라이드 수 등 기본 정보를 함께 안내한다
- 검증 실패 시 오류 내용과 함께 재생성 여부를 사용자에게 질문한다

## 스크립트 경로

모든 스크립트는 다음 경로에 위치한다:
```
~/.claude/ppt_team_agent/.claude/skills/create-pptx/scripts/
├── node_modules/          # PptxGenJS 설치 위치
│   └── pptxgenjs/
├── pptxgenjs-reference.md # PptxGenJS API 레퍼런스
├── editing-reference.md   # PPTX XML 편집 레퍼런스
├── clean.py               # XML 클린업 스크립트
└── office/
    ├── unpack.py           # PPTX → 디렉토리
    └── pack.py             # 디렉토리 → PPTX
```
