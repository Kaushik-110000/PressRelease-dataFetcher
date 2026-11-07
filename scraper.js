
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeRelease(page, releaseId, tempDir) {

    const url =
        `https://www.pib.gov.in/PressReleasePage.aspx?PRID=${releaseId}&reg=48&lang=1`;

    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForSelector('#Titleh2', {
            timeout: 30000
        });

        const result = await page.evaluate(() => {
            const title = document.querySelector('#Titleh2');
            const date = document.querySelector('#PrDateTime');
            const body = document.querySelector('#pibReleaseBody');

            return {
                title: title?.innerText.trim() || null,
                dateTime: date?.innerText.trim() || null,
                contentText: body?.innerText.trim() || null
            };
        });

        if (!result.title) {
            throw new Error('Release title not found');
        }

        // Save intermediate JSON inside temp.
        fs.writeFileSync(
            path.join(tempDir, `release-${releaseId}.json`),
            JSON.stringify(result, null, 2),
            'utf8'
        );

        return result;

    } catch (error) {
        throw new Error(`PRID ${releaseId}: ${error.message}`);
    }
}

module.exports = scrapeRelease;
