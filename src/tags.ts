/** "장보기 #집 #급함" → { title: "장보기", tags: ["집", "급함"] } */
export function parseTags(input: string): { title: string; tags: string[] } {
  const tags = [...input.matchAll(/#(\S+)/g)].map((m) => m[1])
  return { title: input.replace(/#\S+/g, '').trim(), tags }
}
