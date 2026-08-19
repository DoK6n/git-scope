#!/usr/bin/env node
const [, , command, ...args] = process.argv

switch (command) {
  default:
    console.log('taskly <add|list|done> — 자세한 사용법은 README 참고')
}
