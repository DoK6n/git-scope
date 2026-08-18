import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { execGit } from './exec'

interface CacheEntry {
  /** 캐시 이미지 파일명 (avatars/ 아래) */
  file?: string
  mime?: string
  /** 아바타 없음(네거티브 캐시) */
  none?: boolean
  fetchedAt: number
}

type CacheIndex = Record<string, CacheEntry>

/** 캐시 유효기간 — 지난 뒤에는 재조회한다 */
const TTL_MS = 14 * 24 * 60 * 60 * 1000
const AVATAR_SIZE = 64

/**
 * GitHub 아바타 조회 + 디스크 캐시.
 * 리포의 origin이 github.com이면 commits API로 작성자의 avatar_url을 얻고,
 * 이미지를 globalStorage에 저장한 뒤 data URI로 webview에 전달한다.
 * (인증 없는 GitHub API는 시간당 60회 제한 — rate limit에 걸리면 이번 세션은 조회 중단)
 */
export class AvatarService {
  private index: CacheIndex | null = null
  private pending = new Map<string, Promise<string | null>>()
  private rateLimited = false
  private remoteCache = new Map<string, { owner: string; repo: string } | null>()

  constructor(
    private readonly storageDir: string,
    /** GitHub 토큰 공급자 — 비공개 리포 접근 + rate limit 완화(60/h → 5000/h) */
    private readonly getToken: () => Promise<string | null> = async () =>
      process.env.GITHUB_TOKEN ?? null,
  ) {}

  private get dir(): string {
    return path.join(this.storageDir, 'avatars')
  }

  private get indexPath(): string {
    return path.join(this.dir, 'index.json')
  }

  private async loadIndex(): Promise<CacheIndex> {
    if (this.index) return this.index
    try {
      this.index = JSON.parse(await fs.readFile(this.indexPath, 'utf8')) as CacheIndex
    } catch {
      this.index = {}
    }
    return this.index
  }

  private async saveIndex(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    await fs.writeFile(this.indexPath, JSON.stringify(this.index ?? {}))
  }

  async clearCache(): Promise<void> {
    this.index = {}
    this.pending.clear()
    await fs.rm(this.dir, { recursive: true, force: true })
  }

  /** 캐시 히트면 즉시, 아니면 GitHub에서 조회. 실패/미지원이면 null (webview가 Gravatar 폴백) */
  async getAvatar(repoRoot: string, email: string, commitHash: string): Promise<string | null> {
    const key = email.trim().toLowerCase()
    if (key === '') return null
    const index = await this.loadIndex()

    const entry = index[key]
    if (entry && Date.now() - entry.fetchedAt < TTL_MS) {
      if (entry.none || !entry.file) return null
      try {
        const buffer = await fs.readFile(path.join(this.dir, entry.file))
        return `data:${entry.mime ?? 'image/png'};base64,${buffer.toString('base64')}`
      } catch {
        // 캐시 파일이 지워졌으면 아래로 내려가 재조회
      }
    }

    if (this.rateLimited) return null

    let inflight = this.pending.get(key)
    if (!inflight) {
      inflight = this.fetchFromGitHub(repoRoot, key, commitHash).finally(() =>
        this.pending.delete(key),
      )
      this.pending.set(key, inflight)
    }
    return inflight
  }

  /** origin 원격이 github.com이면 owner/repo 추출 */
  private async detectGitHubRepo(
    repoRoot: string,
  ): Promise<{ owner: string; repo: string } | null> {
    const cached = this.remoteCache.get(repoRoot)
    if (cached !== undefined) return cached
    let result: { owner: string; repo: string } | null = null
    try {
      const url = (await execGit(['remote', 'get-url', 'origin'], { cwd: repoRoot })).trim()
      const match =
        /^git@github\.com:([^/]+)\/(.+?)(\.git)?$/.exec(url) ??
        /^https:\/\/github\.com\/([^/]+)\/(.+?)(\.git)?\/?$/.exec(url)
      if (match) result = { owner: match[1]!, repo: match[2]! }
    } catch {
      // 원격 없음 → GitHub 아님
    }
    this.remoteCache.set(repoRoot, result)
    return result
  }

  private async fetchFromGitHub(
    repoRoot: string,
    email: string,
    commitHash: string,
  ): Promise<string | null> {
    const github = await this.detectGitHubRepo(repoRoot)
    // GitHub 리포가 아니면 캐시 없이 null — webview가 Gravatar로 폴백한다
    if (!github) return null

    const index = await this.loadIndex()
    const token = await this.getToken().catch(() => null)
    const headers: Record<string, string> = {
      'User-Agent': 'GitScope',
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    try {
      const commitRes = await fetch(
        `https://api.github.com/repos/${github.owner}/${github.repo}/commits/${commitHash}`,
        { headers },
      )
      if (commitRes.status === 403 || commitRes.status === 429) {
        this.rateLimited = true
        return null
      }
      if (!commitRes.ok) {
        index[email] = { none: true, fetchedAt: Date.now() }
        await this.saveIndex()
        return null
      }
      const body = (await commitRes.json()) as {
        author?: { avatar_url?: string } | null
        committer?: { avatar_url?: string } | null
      }
      const avatarUrl = body.author?.avatar_url ?? body.committer?.avatar_url
      if (!avatarUrl) {
        index[email] = { none: true, fetchedAt: Date.now() }
        await this.saveIndex()
        return null
      }

      const sized = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}s=${AVATAR_SIZE}`
      const imageRes = await fetch(sized, { headers: { 'User-Agent': 'GitScope' } })
      if (!imageRes.ok) {
        index[email] = { none: true, fetchedAt: Date.now() }
        await this.saveIndex()
        return null
      }
      const mime = imageRes.headers.get('content-type')?.split(';')[0] ?? 'image/png'
      const buffer = Buffer.from(await imageRes.arrayBuffer())
      const file = `${createHash('sha256').update(email).digest('hex')}.img`
      await fs.mkdir(this.dir, { recursive: true })
      await fs.writeFile(path.join(this.dir, file), buffer)
      index[email] = { file, mime, fetchedAt: Date.now() }
      await this.saveIndex()
      return `data:${mime};base64,${buffer.toString('base64')}`
    } catch {
      // 네트워크 오류 — 캐시하지 않고 이번만 실패 처리
      return null
    }
  }
}
