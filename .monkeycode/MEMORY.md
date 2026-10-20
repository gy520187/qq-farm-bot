# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-10-20
- Context: Discovered by Agent while fixing pre-existing core test failures after bumping the default client version and analyzing a milk-tea activity HAR capture
- Category: Build Methods / Troubleshooting & Debugging
- Instructions:
  - core 的测试基线依赖 protobufjs 编码行为：`core/package-lock.json`（npm）锁定 `protobufjs@8.6.5`，而根目录 pnpm workspace 的 `core/pnpm-lock.yaml` 锁定 `protobufjs@8.0.0`，两者对 proto3 默认值字段的编码不同（8.0.0 会输出额外零值字段）。
  - 运行 `cd core && npm test` 前必须用 `npm ci --no-audit --no-fund` 安装 core 依赖；不要用根目录 `pnpm install -r` 重装 core 依赖，否则 `test/network-protocol.test.js` 的登录/心跳逐字节断言会因 protobufjs 版本变为 8.0.0 而失败。
  - `web` 的依赖用 `pnpm -C web install` 或根目录 `pnpm install -r` 安装；`web/package-lock.json` 已过期，在 web 目录执行 `npm ci` 会因缺少 `marked@18.1.1` 而失败。