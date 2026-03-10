---
name: load-context
description: 이전 세션의 작업 내역을 메모리 파일에서 읽어와 현재 세션에 컨텍스트를 복원함
triggers:
  - "컨텍스트 로드"
  - "이전 작업 확인"
  - "작업 내역 불러오기"
  - "load context"
argument-hint: "[프로젝트명]"
---

# Load Context Skill

## Purpose

이전 세션에서 저장한 작업 컨텍스트를 읽어와 현재 세션에서 끊김 없이 이어갈 수 있게 한다.

## When to Activate

- 사용자가 "컨텍스트 로드해줘", "이전 작업 확인", "작업 내역 불러와줘" 등을 요청할 때
- 새 세션 시작 시 이전 작업을 이어가려 할 때

## Workflow

1. **프로젝트 식별**: 인자로 프로젝트명이 주어지면 해당 프로젝트, 없으면 현재 작업 디렉토리에서 추론
2. **MEMORY.md 읽기**: `~/.claude/projects/-Users-apple/memory/MEMORY.md` 읽기
3. **work-log 파일 읽기**: `~/.claude/projects/-Users-apple/memory/{project}-work-log.md` 읽기
4. **컨텍스트 요약 표시**: 아래 형식으로 사용자에게 표시

```markdown
## 프로젝트: {프로젝트명}

### 마지막 작업 ({날짜}, {상태})
{요약}

### 주요 변경 사항
- {파일/모듈}: {변경 내용}
- ...

### 알려진 이슈 / 다음 작업 후보
- {이슈 또는 TODO}

### 프로젝트 정보
- 경로: {경로}
- 스택: {기술 스택}
- 빌드 검증: {빌드 명령어}
```

5. **관련 파일 확인**: work-log에 언급된 주요 파일이 여전히 존재하는지 빠르게 확인
6. **작업 제안**: 알려진 이슈나 다음 작업 후보를 기반으로 이어갈 작업을 제안

## Rules

- work-log 파일이 없으면 MEMORY.md만으로 요약하고, 파일이 없다는 것을 알린다
- 프로젝트명을 추론할 수 없으면 사용자에게 물어본다
- 코드를 수정하지 않는다 — 읽기 전용 작업
- git log도 참고하여 최근 커밋 이력을 보여준다 (프로젝트 디렉토리가 존재하는 경우)

## File Locations

- MEMORY.md: `~/.claude/projects/-Users-apple/memory/MEMORY.md`
- Work logs: `~/.claude/projects/-Users-apple/memory/{project}-work-log.md`

## Example

```
User: 컨텍스트 로드해줘 keysoundlab