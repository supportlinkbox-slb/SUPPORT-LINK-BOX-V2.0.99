/**
 * GOOGLE SHEETS API V4 INTEGRATION (Spreadsheet Automation)
 * Supports dynamic tab creation, header injection, and data row batch appending
 */

export async function ensureSheetTabExists(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Failed to fetch spreadsheet metadata: ${metaRes.status} ${err}`);
  }

  const metaData = await metaRes.json();
  const existingSheets = (metaData.sheets || []).map((s: any) => s.properties?.title);

  if (!existingSheets.includes(sheetTitle)) {
    // Tab doesn't exist, create it via batchUpdate
    const addSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const addSheetRes = await fetch(addSheetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          },
        ],
      }),
    });

    if (!addSheetRes.ok) {
      const err = await addSheetRes.text();
      console.warn(`Could not create sheet tab automatically: ${err}`);
    }
  }
}

export async function appendRowsToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: Record<string, any>[]
): Promise<number> {
  if (!rows || rows.length === 0) return 0;

  // 1. Ensure tab exists
  await ensureSheetTabExists(accessToken, spreadsheetId, sheetName);

  // 2. Format headers and values
  const headers = Object.keys(rows[0]);
  const formattedDataRows = rows.map((r) =>
    headers.map((h) => {
      const val = r[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    })
  );

  // 3. Append to Sheet
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetName
  )}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const payload = {
    values: formattedDataRows,
  };

  const res = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Sheets append failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const updatedRows = data.updates?.updatedRows || rows.length;
  return updatedRows;
}
