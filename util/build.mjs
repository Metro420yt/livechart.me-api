//this script minifies and adds info to each version files in openapi/docs

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'

const rootDir = import.meta.dirname.split('\\').slice(0, -1).join('\\')
const sourceDir = rootDir + '\\openapi\\docs'
const prodDir = rootDir + '\\openapi\\prod'
const authorsCachePath = import.meta.dirname + '\\-authors.json'

if (!existsSync(prodDir)) mkdirSync(prodDir, { recursive: true })
if (!existsSync(authorsCachePath)) writeFileSync(authorsCachePath, '{}')

const versions = readdirSync(sourceDir)
const versionData = {}
for (const v of versions) {
    try { versionData[v] = JSON.parse(readFileSync(`${sourceDir}\\${v}`)) }
    catch (e) { console.log(`unable to update file: ${v}\n${e}`) }
}
if (versions.length > 0) var versionsStr = versions.map(v => `[v${versionData[v].info.version}](./${v.split('.').slice(0, -1)})`).join('<br>')


for (const v of versions) {
    const data = versionData[v]
    if (!data) continue;

    // get the user&repo from remote url
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).match(/(.*github.com\/(.*)\/(.*)).git/)
    const repo = `${remoteUrl[2]}/${remoteUrl[3]}`

    const res = await fetch(`https://api.github.com/repos/${repo}/commits?path=/openapi/docs/${v}`)
    if (res.status !== 200) {
        console.log(res.status, res.url)
        continue;
    }

    const authors = JSON.parse(readFileSync(authorsCachePath, 'utf8'))
    if (!authors[v]) authors[v] = []
    for (const { author } of await res.json()) {
        if (authors[v].find(a => a.id === author.id)) continue;
        console.log('new contributor', author.login)
        authors[v].push(Object.fromEntries(['id', 'login', 'html_url'].map(k => [k, author[k]])))
    }


    data.info.description += `<br>[Source Code](${remoteUrl[1]})\n\n## Contributors\n` + authors[v].map((author) => `[${author.login}](${author.html_url})`).join('<br>')

    if (versionsStr) data.info.description += `\n\n## Versions\n${versionsStr}`

    writeFileSync(`${prodDir}\\${v}`, JSON.stringify(data))
    writeFileSync(authorsCachePath, JSON.stringify(authors))
}