---
name: design-slide
description: 슬라이드 구성 JSON을 받아 디자인 원칙을 적용하여 스타일링된 PptxGenJS 코드를 생성
model: sonnet
---

요청사항: $ARGUMENTS

너는 슬라이드 디자인 코드 생성기다. 슬라이드 구성 JSON을 받아 디자인 원칙을 적용하여 PptxGenJS JavaScript 코드를 생성한다.

## 파이프라인 구조

```
[1. 입력 수집] → [2. 디자인 가이드 로드] → [3. 테마 결정] → [4. 슬라이드별 디자인 코드 생성] → [5. 코드 출력]
```

## 1단계: 입력 수집 (직접 수행)

`$ARGUMENTS` 또는 컨텍스트에서 슬라이드 구성 JSON을 파싱한다.

- ppt-organizer가 생성한 JSON 구조를 입력으로 받는다
- JSON에는 각 슬라이드의 `type`, `title`, `content`, `notes` 등이 포함되어 있다
- `color_suggestion` 필드에서 색상 방향 힌트를 읽는다
- JSON이 없으면 AskUserQuestion으로 슬라이드 내용을 수집한다

## 2단계: 디자인 가이드 로드 (직접 수행)

`~/.claude/ppt_team_agent/.claude/skills/design-slide/design-guide.md`를 읽어 디자인 원칙을 로드한다.

- 색상 팔레트, 타이포그래피 위계, 레이아웃 원칙, 안티패턴 목록을 참조한다
- 가이드의 내용을 코드 생성 시 모든 결정의 근거로 사용한다

## 3단계: 테마 결정 (직접 수행)

입력 JSON의 `color_suggestion`과 주제 분석을 기반으로 구체적인 테마를 확정한다.

- **색상 팔레트 선택**: design-guide.md의 테마별 팔레트에서 선택하거나, 주제에 맞는 커스텀 팔레트 생성
  - 반드시 60-30-10 비율의 3색(주색, 보조색, 강조색)을 hex 코드로 확정
- **폰트 확정**: 제목 폰트, 본문 폰트를 각각 지정
- **시각 모티프**: 슬라이드 전체에 반복할 디자인 요소 결정 (색상 블록, 사선, 원형 등)

## 4단계: 슬라이드별 디자인 코드 생성 (직접 수행)

각 슬라이드에 대해 PptxGenJS API 코드를 생성한다.

### PptxGenJS 코드 규칙

- **색상값에 `#` prefix 사용 금지**: PptxGenJS는 `"FF6B6B"` 형식을 사용한다 (`"#FF6B6B"` 아님)
- **각 요소마다 새 options 객체 생성**: 객체를 재사용하면 이전 속성이 잔존하므로, 매번 새 객체를 만든다
- **리스트 처리**: `bullet: true` 옵션으로 불릿 처리
- **슬라이드 크기**: LAYOUT_WIDE 기준 (13.33 x 7.5 인치)
- **한글 폰트 직접 지정**: `fontFace: "Pretendard"` 또는 `fontFace: "Noto Sans KR"` 등 명시적 지정
- **단위**: 위치와 크기는 인치(inch) 단위

### 슬라이드 유형별 코드 생성 가이드

각 슬라이드의 `type`에 따라 다른 레이아웃을 적용한다:

#### 표지 (cover)
```javascript
let slide = pptx.addSlide();
// 배경색: 주색 또는 보조색으로 전면 채움
slide.background = { color: "보조색" };
// 제목: 40-54pt, 대담한 배치
slide.addText("제목", { x: 0.8, y: 2.0, w: 11.0, h: 1.5, fontSize: 48, fontFace: "Pretendard", bold: true, color: "FFFFFF" });
// 서브타이틀
slide.addText("부제목", { x: 0.8, y: 3.8, w: 8.0, h: 0.8, fontSize: 20, fontFace: "Pretendard", color: "CCCCCC" });
```

#### 목차 (toc)
- 좌측 번호 + 우측 제목 리스트 또는 그리드 카드형
- 각 항목에 색상 코딩 적용

#### 콘텐츠 (content)
- 상단 제목(28-36pt) + 하단 본문(18-24pt)
- 텍스트와 시각 영역 분리 (좌우 분할 또는 상하 분할)
- 불릿은 `bullet: true` + `bulletOptions` 활용

#### 데이터 (data)
- 핵심 수치를 대형 텍스트로 강조
- 차트가 있으면 PptxGenJS 차트 API 활용
- 데이터 라벨 최소화

#### 비교 (comparison)
- 좌우 2분할 또는 표 형식
- 대비되는 색상으로 구분

#### 마무리 (closing)
- 핵심 메시지 중앙 대형 배치
- CTA 또는 연락처 하단

### 공통 코드 구조

```javascript
const PptxGenJS = require("pptxgenjs");
const pptx = new PptxGenJS();

pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 인치

// === 슬라이드 1: 표지 ===
{
  let slide = pptx.addSlide();
  // ... 요소 배치
}

// === 슬라이드 2: 목차 ===
{
  let slide = pptx.addSlide();
  // ... 요소 배치
}

// ... 이하 슬라이드별 반복

pptx.writeFile({ fileName: "OUTPUT_PATH" });
```

## 5단계: 코드 출력 (직접 수행)

생성된 PptxGenJS JavaScript 코드를 완전한 실행 가능 형태로 출력한다.

- `require("pptxgenjs")` 경로는 create-pptx 스킬에서 조정하므로 기본 형태로 출력
- `OUTPUT_PATH`는 플레이스홀더로 남기거나 인자로 전달받은 경로를 사용
- 코드 전체를 문자열로 반환하여 create-pptx 스킬이 실행할 수 있도록 한다

## 주의사항

- 코드 생성 시 design-guide.md의 안티패턴을 반드시 확인하여 회피한다
- 모든 슬라이드가 동일한 레이아웃이 되지 않도록 2-3가지 레이아웃을 번갈아 사용한다
- 텍스트 밀도 40% 이하를 유지한다
- 한 슬라이드에 불릿 5개를 초과하지 않는다
- 이 스킬은 코드만 생성한다. 파일 생성은 create-pptx 스킬이 담당한다.
