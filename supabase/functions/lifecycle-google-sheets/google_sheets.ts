export async function appendRowsToGoogleSheet(accessToken: string, spreadsheetId: string, sheetName: string, rows: any[]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=RAW`;
  
  const values = rows.map(r => Object.values(r));
  
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  
  if (!res.ok) throw new Error("Google Sheets API failed");
  const data = await res.json();
  return data.updates.updatedRows;
}
