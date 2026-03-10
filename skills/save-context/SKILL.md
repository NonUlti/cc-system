---
name: save-context
description: 현재 세션의 작업 내역을 메모리 파일에 저장하여 다음 세션에서 이어갈 수 있게 함
triggers:
  - "컨텍스트 저장"
  - "세션 저장"
  - "작업 내역 저장"
  - "save context"
argument-hint: "[프로젝트명]"
---

# Save Context Skill

## Purpose

세션 종료 전 현재 작업 컨텍스트를 메모리 파일에 저장하여, 다음 세션에서 끊김 없이 이어갈 수 있게 한다.

## When to Activate

- 사용자가 "컨텍스트 저장해줘", "세션 저장", "작업 내역 저장" 등을 요청할 때
- 큰 작업이 완료된 후 세션을 마무리할 때

## Workflow

1. **프로젝트 식별**: 현재 작업 디렉토리 또는 사용자 지정 프로젝트 확인
2. **MEMORY.md 읽기**: `~/.claude/projects/-Users-apple/memory/MEMORY.md` 확인
3. **작업 이력 파일 확인**: 프로젝트별 work-log 파일 존재 여부 확인 (예: `{project}-work-log.md`)
4. **이번 세션 요약 작성**: 아래 형식으로 정리

```markdown
## {날짜}: {작업 제목} ({상태})

{1-2줄 요약}

### 변경 사항
- {파일/모듈}: {변경 내용}
- ...

### 알려진 이슈 / 다음 작업 후보
- {이슈 또는 TODO}
```

5. **work-log 파일 업데이트**: 기존 내용 유지하면서 새 세션 내역 추가 (최신이 위로)
6. **MEMORY.md 갱신**: 프로젝트 정보가 변경된 경우에만 업데이트
7. **완료 보고**: 저장된 내용 요약 표시

## Rules

- 이미 커밋된 변경사항은 git log에서 확인 가능하므로, 커밋 메시지를 중복 나열하지 않는다
- 미커밋 변경사항이 있으면 명시적으로 언급한다
- work-log에는 **무엇을 했는지**(what)와 **현재 상태**(status)를 중심으로 작성한다
- 코드 상세는 적지 않는다 — git diff로 확인 가능
- MEMORY.md는 200줄 이내로 유지 (truncation 방지)

## File Locations

- MEMORY.md: `~/.claude/projects/-Users-apple/memory/MEMORY.md`
- Work logs: `~/.claude/projects/-Users-apple/memory/{project}-work-log.md`

## Example

```
User: 컨텍스트 저장해줘