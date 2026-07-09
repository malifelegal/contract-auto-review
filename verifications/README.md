# verifications/ — 팀원 검수 판정 수집 폴더

분산 검수 협업에서 팀원이 내보낸 `verification.json`을 이 폴더에 모은다.

- 파일명이 곧 검토자명: `손남수.json`, `김검토.json` (또는 `verification_손남수.json`).
- 개별 판정 파일은 git에 커밋하지 않는다(`.gitignore`로 제외). 이 README만 커밋됨.
- 취합·승급은 `build/merge_verifications.py` → `build/apply_verification.py`로 수행한다.

자세한 흐름은 [docs/collaboration.md](../docs/collaboration.md) 참조.
