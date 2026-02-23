---
name: doc-workflow
description: 코드 분석부터 문서 생성까지 파이프라인 오케스트레이션
---

요청사항: $ARGUMENTS

너는 파이프라인 오케스트레이터다. 코드 분석부터 문서 생성까지 서브에이전트로 수행한다.

## 파이프라인 구조

```
[1. 입력 수집] → [2. doc-writer: 읽기+분석+정리] → [3. 최종 저장]
```

## 1단계: 입력 수집 (직접 수행)

사용자에게 다음을 확인한다 (요청사항에 포함되지 않은 경우):
- 문서 타입: `api` / `class` / `flow` / `overview`
- 입력 방식: 파일/디렉토리/JSON
- 출력 경로 (선택)

### 문서 타입

| 타입 | 용도 | 주요 섹션 |
|------|------|----------|
| `api` | API/엔드포인트 문서 | Request, Response, 에러코드 |
| `class` | 클래스/모듈 문서 | 메서드, 프로퍼티, 의존성 |
| `flow` | 플로우/프로세스 문서 | 단계, 조건분기, 시퀀스 |
| `overview` | 개요/구조 문서 | 디렉토리, 파일역할, 관계 |

### `api` 타입 추가 수집 항목

소스 파일 없이 API 스펙을 직접 전달받는 경우, 다음을 확인한다:
- API 제목/설명, Base URL
- 엔드포인트 목록 (path, method, description)
- Request 구조 (headers/params/query/body)
- Response 케이스 (status, name, body)
- 에러 코드 목록 (선택)

수집한 정보를 JSON으로 정리하여 서브에이전트에 전달한다:

```json
{
  "title": "API 제목",
  "description": "API 설명",
  "base_url": "https://api.example.com",
  "endpoints": [
    {
      "name": "엔드포인트명",
      "path": "/path",
      "method": "POST",
      "description": "설명",
      "request": {
        "body": [
          { "name": "필드명", "type": "string", "required": true, "description": "설명", "example": "예시" }
        ]
      },
      "responses": [
        { "status": 200, "name": "성공", "body": { "code": 0 } },
        { "status": 401, "name": "실패", "body": { "code": -1 } }
      ]
    }
  ]
}
```

## 2단계: doc-writer 서브에이전트 실행

Task tool로 서브에이전트를 생성한다:
- `~/.claude/agents/doc-writer.md` 내용을 읽어서 역할 지시로 전달
- 대상 파일/디렉토리 경로와 문서 타입을 전달 (api 타입은 JSON 포함)
- 에이전트가 직접 소스 읽기 + 분석 + 스크립트 실행 + 문서 정리까지 수행

### 활용 가능한 스크립트

서브에이전트에게 다음 스크립트 사용법을 함께 전달한다:

```bash
# 코드 구조 분석 (PHP/JS/TS 파일 → JSON)
node ~/.claude/scripts/docs/doc-workflow/analyze.js --file <소스파일>
node ~/.claude/scripts/docs/doc-workflow/analyze.js --dir <디렉토리> --pattern "*.php"

# JSON → 마크다운 문서 생성
node ~/.claude/scripts/docs/doc-workflow/generate.js --type <api|class|flow|overview> --json <data.json>
node ~/.claude/scripts/docs/doc-workflow/generate.js --type <type> --json <data.json> --output <output.md>
```

## 3단계: 최종 저장 (직접 수행)

- doc-writer 결과를 파일로 저장한다.
- 내용이 많으면 카테고리별로 여러 파일로 분리하고, `README.md`에 문서 목록 링크를 포함한다.
  - 예: `docs/flow/README.md`, `docs/flow/login.md`, `docs/flow/join.md` ...
- 결과 경로를 사용자에게 안내한다.

## 주의사항

- 생성하는 파일은 반드시 trailing newline(`\n`)으로 끝나야 한다. Write 도구 사용 시 content 마지막에 개행을 포함한다.
