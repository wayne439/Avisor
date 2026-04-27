#!/usr/bin/env node
/**
   * scripts/fetch-faa-data.cjs
   *
   * Downloads FAA & airport data from open data sources at build time.
   * Run with: node scripts/fetch-faa-data.cjs
   *
   * This replaces committing faa_master.xlsx to git.
   * After running once, add faa_master.xlsx and faa_data_dictionary.xlsx to .gitignore.
   */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'Data');

// OurAirports open data (always current, free, no auth needed)
const SOURCES = [
{
      url: 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv',
            dest: path.join(__dirname, '..', 'airport-frequencies.csv'),
            name: 'airport-frequencies.csv'
        },
{
    url: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
          dest: path.join(DATA_DIR, 'airports.csv'),
          name: 'airports.csv'
      },
{
    url: 'https://davidmegginson.github.io/ourairports-data/navaids.csv',
          dest: path.join(DATA_DIR, 'navaids.csv'),
          name: 'navaids.csv'
      }
];

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url, destPath, name) {
    return new Promise((resolve, reject) => {
          console.log('  Downloading:', name);
          const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              file.close();
              fs.unlinkSync(destPath);
        return download(res.headers.location, destPath, name).then(resolve).catch(reject);
}
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
                file.close();
        const size = fs.statSync(destPath).size;
        console.log('  Done:', name, '(' + (size / 1024).toFixed(1) + ' KB)');
        resolve();
});
}).on('error', (err) => {
        fs.unlink(destPath, () => {});
      reject(err);
});
});
}

async function main() {
    console.log('\nFetching FAA and airport data...\n');
  ensureDir(DATA_DIR);

  for (const source of SOURCES) {
        await download(source.url, source.dest, source.name);
    }

      console.log('\nData fetch complete.');
      console.log('Run npm run build:navaids next to bundle navaids.\n');
  console.log('Note: For full FAA 28-day NAFD cycle data, download manually from:');
  console.log('  https://n
