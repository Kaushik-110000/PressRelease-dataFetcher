
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const fetchPRIDs = require('./regFetcher');
const scrapeRelease = require('./scraper');

const TEMP_DIR = path.join(__dirname, 'temp');
const OUTPUT_FILE = path.join(__dirname, 'merged.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const parsed = new Date(`${date}T12:00:00`);

    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date;
}

async function main() {

    let browser;

    console.log('\n======================================');
    console.log('       PIB AUTOMATED SCRAPER');
    console.log('======================================\n');

    try {
        // STEP 1: Get input
        const startDate = (await ask('Start date (YYYY-MM-DD): ')).trim();
        const endDate = (await ask('End date   (YYYY-MM-DD): ')).trim();

        if (!validDate(startDate) || !validDate(endDate)) {
            throw new Error('Invalid date format or date.');
        }

        if (startDate > endDate) {
            throw new Error('Start date cannot be after end date.');
        }

        rl.close();

        console.log('\n[INIT] Date range:', startDate, 'to', endDate);

        // STEP 2: Create temp directory
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
        fs.mkdirSync(TEMP_DIR, { recursive: true });

        console.log('[INIT] Temporary folder created.');

        // STEP 3: Fetch PRIDs date-wise
        console.log('\n========== PHASE 1: PRID FETCHING ==========');

        const dateWisePRIDs = await fetchPRIDs(
            startDate,
            endDate,
            TEMP_DIR
        );

        const totalPRIDs = Object.values(dateWisePRIDs)
            .reduce((sum, ids) => sum + ids.length, 0);

        console.log(`\n[SUMMARY] Total PRIDs found: ${totalPRIDs}`);

        // STEP 4: Launch one browser for all releases
        console.log('\n========== PHASE 2: RELEASE SCRAPING ==========');

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null
        });

        const page = await browser.newPage();

        const merged = {};

        let completed = 0;
        let failed = 0;

        // STEP 5: Scrape releases date-wise
        for (const [date, prids] of Object.entries(dateWisePRIDs)) {

            console.log(`\n[DATE] ${date}`);
            console.log(`[DATE] Releases: ${prids.length}`);

            merged[date] = [];

            for (let i = 0; i < prids.length; i++) {

                const prid = prids[i];

                console.log(
                    `[SCRAPE ${completed + failed + 1}/${totalPRIDs}] PRID: ${prid}`
                );

                try {
                    const release = await scrapeRelease(
                        page,
                        prid,
                        TEMP_DIR
                    );

                    merged[date].push(release);

                    completed++;

                    console.log(`[SUCCESS] ${release.title}`);

                } catch (error) {
                    failed++;
                    console.error(`[FAILED] ${error.message}`);
                }
            }

            console.log(
                `[DATE COMPLETE] ${date}: ${merged[date].length}/${prids.length} successful`
            );
        }

        // STEP 6: Close browser
        await browser.close();
        browser = null;

        console.log('\n[SCRAPE] Browser closed.');

        // STEP 7: Create final merged file in root
        console.log('\n========== PHASE 3: MERGING ==========');

        fs.writeFileSync(
            OUTPUT_FILE,
            JSON.stringify(merged, null, 2),
            'utf8'
        );

        const totalReleases = Object.values(merged)
            .reduce((sum, releases) => sum + releases.length, 0);

        console.log('[MERGE] merged.json created successfully.');

        // STEP 8: Delete temporary files
        console.log('\n========== PHASE 4: CLEANUP ==========');

        fs.rmSync(TEMP_DIR, {
            recursive: true,
            force: true
        });

        console.log('[CLEANUP] Temporary folder deleted.');

        // FINAL SUMMARY
        console.log('\n======================================');
        console.log('          PROCESS COMPLETED');
        console.log('======================================');

        console.log('Date range       :', startDate, 'to', endDate);
        console.log('Total PRIDs      :', totalPRIDs);
        console.log('Successful       :', completed);
        console.log('Failed           :', failed);
        console.log('Final releases   :', totalReleases);
        console.log('Output           : merged.json');

        console.log('======================================\n');

    } catch (error) {

        console.error('\n[ERROR]', error.message);

    } finally {

        if (browser) {
            await browser.close().catch(() => {});
        }

        if (!rl.closed) {
            rl.close();
        }

        // Always remove intermediate files.
        fs.rmSync(TEMP_DIR, {
            recursive: true,
            force: true
        });

        console.log('[CLEANUP] Temporary files removed.');
    }
}

main();
