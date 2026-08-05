/**
 * WB 数据快照生成脚本
 * 用法: node scripts/generate-wb-snapshot.js
 * 在有网络环境的机器上运行一次，生成 src/data/wb-snapshot.json
 * 部署到无梯子服务器时，Provider 优先读此快照
 */
const https = require('https')

const INDICATORS = [
  'NY.GDP.MKTP.CD',
  'GB.XPD.RSDV.GD.ZS',
  'SP.POP.SCIE.RD.P6',
  'IT.NET.USER.ZS',
  'SE.XPD.TOTL.GD.ZS',
  'TX.VAL.TECH.MF.ZS',
  'NE.TRD.GNFS.ZS',
]

const COUNTRIES = ['USA', 'CHN', 'JPN', 'DEU', 'GBR', 'KOR', 'FRA', 'IND']
const YEAR_START = 2010
const YEAR_END = 2023
const OUT = 'src/data/wb-snapshot.json'

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 20000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')) })
  })
}

async function main() {
  const snapshot = { generatedAt: new Date().toISOString(), indicators: {} }

  for (const indicator of INDICATORS) {
    const countries = COUNTRIES.join(';')
    const url = `https://api.worldbank.org/v2/country/${countries}/indicator/${indicator}?format=json&date=${YEAR_START}:${YEAR_END}&per_page=5000`
    process.stdout.write(`Fetching ${indicator}... `)
    try {
      const body = await fetchJson(url)
      if (!Array.isArray(body) || body.length < 2) { console.log('skip (bad response)'); continue }
      const raw = body[1] || []
      const values = raw
        .filter(v => v.countryiso3code)
        .map(v => ({
          country: v.countryiso3code,
          countryName: v.country?.value || v.countryiso3code,
          year: parseInt(v.date),
          value: v.value,
        }))
      snapshot.indicators[indicator] = { values }
      console.log(`${values.length} records`)
    } catch (e) {
      console.log(`failed: ${e.message}`)
    }
  }

  const fs = require('fs')
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2))
  console.log(`\nSaved to ${OUT} (${Object.keys(snapshot.indicators).length}/${INDICATORS.length} indicators)`)
}

main().catch(console.error)
