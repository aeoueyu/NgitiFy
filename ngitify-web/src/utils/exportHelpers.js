const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const escapeCsvCell = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
};

export const downloadCsvFile = (filename, headers = [], rows = []) => {
    const csvRows = [];

    if (headers.length > 0) {
        csvRows.push(headers.map(escapeCsvCell).join(','));
    }

    rows.forEach((row) => {
        csvRows.push(row.map(escapeCsvCell).join(','));
    });

    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const downloadCsvSections = (filename, sections = []) => {
    const csvRows = [];

    sections.forEach((section, index) => {
        if (section?.title) {
            csvRows.push(escapeCsvCell(section.title));
        }

        if (Array.isArray(section?.headers) && section.headers.length > 0) {
            csvRows.push(section.headers.map(escapeCsvCell).join(','));
        }

        (section?.rows || []).forEach((row) => {
            csvRows.push((row || []).map(escapeCsvCell).join(','));
        });

        if (index < sections.length - 1) {
            csvRows.push('');
        }
    });

    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const openPrintReport = ({
    title,
    subtitle = '',
    summaryItems = [],
    sections = [],
    orientation = 'landscape',
}) => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) {
        return false;
    }

    const summaryMarkup = summaryItems.length > 0
        ? `
            <section class="summary-grid">
                ${summaryItems.map((item) => `
                    <article class="summary-card">
                        <span class="summary-label">${escapeHtml(item.label)}</span>
                        <strong class="summary-value">${escapeHtml(item.value)}</strong>
                    </article>
                `).join('')}
            </section>
        `
        : '';

    const sectionMarkup = sections.map((section) => `
        <section class="report-section">
            <h2>${escapeHtml(section.title)}</h2>
            <table>
                <thead>
                    <tr>
                        ${(section.headers || []).map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${(section.rows || []).length > 0 ? (section.rows || []).map((row) => `
                        <tr>
                            ${(row || []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="${Math.max((section.headers || []).length, 1)}" class="empty-cell">No records found.</td>
                        </tr>
                    `}
                </tbody>
            </table>
        </section>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${escapeHtml(title)}</title>
                <style>
                    @page {
                        size: ${orientation};
                        margin: 16mm;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        color: #111827;
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                    }
                    .report-shell {
                        padding: 12px 0 24px;
                    }
                    .report-header {
                        border-bottom: 2px solid #0a3f65;
                        margin-bottom: 20px;
                        padding-bottom: 12px;
                    }
                    .report-header h1 {
                        margin: 0 0 6px;
                        color: #0a3f65;
                        font-size: 24px;
                    }
                    .report-header p {
                        margin: 0;
                        color: #4b5563;
                        font-size: 13px;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 12px;
                        margin-bottom: 20px;
                    }
                    .summary-card {
                        border: 1px solid #dbe5ef;
                        border-radius: 10px;
                        padding: 12px 14px;
                        background: #f8fbfd;
                    }
                    .summary-label {
                        display: block;
                        color: #4b5563;
                        font-size: 11px;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                        letter-spacing: 0.4px;
                    }
                    .summary-value {
                        color: #0a3f65;
                        font-size: 18px;
                    }
                    .report-section {
                        margin-bottom: 20px;
                        page-break-inside: avoid;
                    }
                    .report-section h2 {
                        margin: 0 0 10px;
                        color: #0a3f65;
                        font-size: 16px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: auto;
                    }
                    th, td {
                        border: 1px solid #dbe5ef;
                        padding: 8px 10px;
                        font-size: 12px;
                        text-align: left;
                        vertical-align: top;
                        white-space: nowrap;
                    }
                    th {
                        background: #eef7fb;
                        color: #0a3f65;
                        font-weight: 700;
                    }
                    .empty-cell {
                        text-align: center;
                        color: #6b7280;
                        white-space: normal;
                    }
                </style>
            </head>
            <body>
                <main class="report-shell">
                    <header class="report-header">
                        <h1>${escapeHtml(title)}</h1>
                        <p>${escapeHtml(subtitle)}</p>
                    </header>
                    ${summaryMarkup}
                    ${sectionMarkup}
                </main>
            </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
        printWindow.print();
    }, 250);

    return true;
};
