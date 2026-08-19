#!/usr/bin/env node
import { createTask } from './model'
import { TaskStore, loadFromFile, saveToFile } from './store'

const DB = `${process.env.HOME}/.taskly.json`
const [, , command, ...args] = process.argv
const store = new TaskStore()

switch (command) {
  case 'add': {
    store.add(createTask(Date.now(), args.join(' ')))
    saveToFile(store, DB)
    break
  }
  case 'list': {
    for (const task of loadFromFile(DB)) {
      console.log(`${task.done ? '✔' : '·'} ${task.title}`)
    }
    break
  }
  default:
    console.log('taskly <add|list|done> — 자세한 사용법은 README 참고')
}
