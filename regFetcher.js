
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'https://www.pib.gov.in/allRel.aspx?reg=48&lang=1';

const SELECTORS = {
    day: '#ContentPlaceHolder1_ddlday',
    month: '#ContentPlaceHolder1_ddlMonth',
    year: '#ContentPlaceHolder1_ddlYear',
    resultLabel: '#ContentPlaceHolder1_lblDate'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function getDates(start, end) {
    const dates = [];
    const current = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);

    while (current <= last) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const day = current.getDate();

        dates.push({
            year,
            month,
            day,
            date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        });

        current.setDate(current.getDate() + 1);
    }

    return dates;
}

async function setDropdown(page, selector, value, alternativeText) {
    const result = await page.evaluate(
        ({ selector, value, alternativeText }) => {
            const select = document.querySelector(selector);

            if (!select) {
                return { success: false, error: `Missing ${selector}` };
            }

            const option = [...select.options].find(option =>
                option.value === String(value) ||
                option.text.trim().toLowerCase() ===
                    String(alternativeText ?? value).toLowerCase()
            );

            if (!option) {
                return {
                    success: false,
                    error: `Option ${value} not found in ${selector}`
                };
            }

            select.value = option.value;

            return {
                success: true,
                value: option.value,
                text: option.text.trim()
            };
        },
        { selector, value, alternativeText }
    );

    if (!result.success) {
        throw new Error(result.error);
    }

    return result;
}

async function fetchPRIDs(startDate, endDate, tempDir) {
    let browser;

    try {
        const dates = getDates(startDate, endDate);
        const results = {};

        console.log('\n[PRID] Launching browser...');

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null
        });

        const page = await browser.newPage();

        await page.goto(URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForSelector(SELECTORS.day);
        await page.waitForSelector(SELECTORS.month);
        await page.waitForSelector(SELECTORS.year);

        console.log('[PRID] PIB page loaded.');

        for (let i = 0; i < dates.length; i++) {
            const item = dates[i];

            console.log(
                `\n[PRID ${i + 1}/${dates.length}] ${item.date}`
            );

            try {
                // Set all dropdowns without triggering separate postbacks.
                await setDropdown(page, SELECTORS.year, item.year);

                const monthName = new Date(
                    item.year, item.month - 1, 1
                ).toLocaleString('en-US', { month: 'long' });

                await setDropdown(
                    page,
                    SELECTORS.month,
                    item.month,
                    monthName
                );

                await setDropdown(page, SELECTORS.day, item.day);

                // Trigger one ASP.NET postback.
                const navigation = page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 20000
                }).catch(() => null);

                await page.evaluate(() => {
                    if (typeof window.__doPostBack !== 'function') {
                        throw new Error('__doPostBack is unavailable');
                    }

                    window.__doPostBack(
                        'ctl00$ContentPlaceHolder1$ddlday',
                        ''
                    );
                });

                await navigation;
                await page.waitForSelector(SELECTORS.resultLabel);
                await delay(2000);

                const extracted = await page.evaluate(() => {
                    const ids = new Set();

                    document.querySelectorAll('a[href]').forEach(anchor => {
                        try {
                            const url = new URL(anchor.href);
                            const id = url.searchParams.get('PRID');

                            if (id && /^\d+$/.test(id)) {
                                ids.add(id);
                            }
                        } catch (_) {}
                    });

                    return {
                        ids: [...ids],
                        label: document.querySelector(
                            '#ContentPlaceHolder1_lblDate'
                        )?.innerText.trim() || ''
                    };
                });

                results[item.date] = extracted.ids;

                console.log(`[PRID] ${extracted.label}`);
                console.log(`[PRID] Found ${extracted.ids.length} IDs`);

                // Save intermediate progress inside temp.
                fs.writeFileSync(
                    path.join(tempDir, 'prids_by_date.json'),
                    JSON.stringify(results, null, 2)
                );

            } catch (error) {
                console.error(`[PRID] Failed ${item.date}: ${error.message}`);
                results[item.date] = [];
            }
        }

        console.log('\n[PRID] Date-wise fetching completed.');

        return results;

    } finally {
        if (browser) {
            await browser.close();
            console.log('[PRID] Browser closed.');
        }
    }
}

module.exports = fetchPRIDs;
