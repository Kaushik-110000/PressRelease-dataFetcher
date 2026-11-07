# PIB Scraper

A Node.js and Puppeteer-based tool to scrape PIB press releases within a specified date range and export them into a consolidated JSON file.

## Installation

**1. Clone the repository**

```bash
git clone <repository-url>
cd pib-scraper
```

**2. Install dependencies**

```bash
npm install
```

## Usage

Run the scraper:

```bash
node merger.js
```

Enter the start and end dates when prompted:

```text
Start date (YYYY-MM-DD): 2026-11-01
End date   (YYYY-MM-DD): 2026-11-07
```

The scraper automatically fetches PRIDs, extracts individual press releases, and merges them date-wise.

## Output

The final file `merged.json` is generated in the project root.

```json
{
  "2026-11-06": [
    {
      "title": "Press Release Title",
      "dateTime": "Posted On: 06 NOV 2026",
      "contentText": "Press release content..."
    }
  ]
}
```

Intermediate files are stored in `temp/` and automatically deleted after processing.

## Requirements

- Node.js
- Internet connection
- Puppeteer-compatible browser environment
