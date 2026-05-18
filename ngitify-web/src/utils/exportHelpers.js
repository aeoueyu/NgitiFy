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

const normalizeReportConfig = ({
    title,
    subtitle = '',
    summaryItems = [],
    sections = [],
    orientation = 'landscape',
}) => ({
    title,
    subtitle,
    summaryItems: Array.isArray(summaryItems) ? summaryItems : [],
    sections: Array.isArray(sections) ? sections : [],
    orientation: orientation === 'portrait' ? 'portrait' : 'landscape',
});

const buildSummaryMarkup = (summaryItems = []) => (
    summaryItems.length > 0
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
        : ''
);

const buildSectionMarkup = (sections = []) => sections.map((section) => `
    <section class="report-section">
        <div class="section-heading">
            <h2>${escapeHtml(section.title)}</h2>
        </div>
        <div class="table-shell">
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
        </div>
    </section>
`).join('');

export const buildPrintReportDocument = (reportConfig = {}) => {
    const {
        title,
        subtitle,
        summaryItems,
        sections,
        orientation,
    } = normalizeReportConfig(reportConfig);

    const generatedAt = new Date().toLocaleString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(title)}</title>
                <style>
                    @page {
                        size: ${orientation};
                        margin: 14mm;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #eef4f8;
                    }
                    body {
                        font-family: "Lexend Deca", Arial, sans-serif;
                        color: #14324a;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .report-shell {
                        width: 100%;
                        padding: 28px;
                    }
                    .report-document {
                        background: #ffffff;
                        border: 1px solid #d8e6ef;
                        border-radius: 20px;
                        padding: 28px;
                        box-shadow: 0 18px 45px rgba(10, 63, 101, 0.08);
                    }
                    .report-header {
                        display: flex;
                        justify-content: space-between;
                        gap: 16px;
                        align-items: flex-start;
                        border-bottom: 2px solid #0a3f65;
                        padding-bottom: 16px;
                        margin-bottom: 18px;
                    }
                    .report-header-copy h1 {
                        margin: 0 0 6px;
                        color: #0a3f65;
                        font-size: 24px;
                        line-height: 1.2;
                    }
                    .report-header-copy p {
                        margin: 0;
                        color: #526579;
                        font-size: 13px;
                        line-height: 1.5;
                    }
                    .report-meta {
                        min-width: 180px;
                        text-align: right;
                    }
                    .report-meta-label {
                        display: block;
                        color: #6b7c8f;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 4px;
                    }
                    .report-meta-value {
                        color: #0a3f65;
                        font-size: 12px;
                        font-weight: 700;
                        line-height: 1.45;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 12px;
                        margin-bottom: 20px;
                    }
                    .summary-card {
                        border: 1px solid #dbe5ef;
                        border-radius: 14px;
                        padding: 12px 14px;
                        background: #f8fbfd;
                        min-height: 72px;
                    }
                    .summary-label {
                        display: block;
                        color: #5b6f82;
                        font-size: 10px;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                        letter-spacing: 0.45px;
                    }
                    .summary-value {
                        color: #0a3f65;
                        font-size: 16px;
                        line-height: 1.35;
                    }
                    .report-section {
                        margin-bottom: 18px;
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .section-heading {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        margin-bottom: 8px;
                    }
                    .report-section h2 {
                        margin: 0;
                        color: #0a3f65;
                        font-size: 15px;
                        line-height: 1.3;
                    }
                    .table-shell {
                        width: 100%;
                        overflow: hidden;
                        border: 1px solid #dbe5ef;
                        border-radius: 14px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }
                    th, td {
                        border-bottom: 1px solid #dbe5ef;
                        border-right: 1px solid #dbe5ef;
                        padding: 8px 10px;
                        font-size: 11px;
                        text-align: left;
                        vertical-align: top;
                        white-space: normal;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                        line-height: 1.45;
                    }
                    th:last-child, td:last-child {
                        border-right: none;
                    }
                    tbody tr:last-child td {
                        border-bottom: none;
                    }
                    th {
                        background: #eef7fb;
                        color: #0a3f65;
                        font-weight: 800;
                    }
                    td {
                        color: #31465a;
                    }
                    .empty-cell {
                        text-align: center;
                        color: #6b7280;
                        padding: 18px;
                    }
                    @media print {
                        html, body {
                            background: #ffffff;
                        }
                        .report-shell {
                            padding: 0;
                        }
                        .report-document {
                            border: none;
                            border-radius: 0;
                            box-shadow: none;
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <main class="report-shell">
                    <article class="report-document">
                        <header class="report-header">
                            <div class="report-header-copy">
                                <h1>${escapeHtml(title)}</h1>
                                <p>${escapeHtml(subtitle)}</p>
                            </div>
                            <div class="report-meta">
                                <span class="report-meta-label">Generated</span>
                                <span class="report-meta-value">${escapeHtml(generatedAt)}</span>
                            </div>
                        </header>
                        ${buildSummaryMarkup(summaryItems)}
                        ${buildSectionMarkup(sections)}
                    </article>
                </main>
            </body>
        </html>
    `;
};

export const openPrintReport = ({
    title,
    subtitle = '',
    summaryItems = [],
    sections = [],
    orientation = 'landscape',
}) => {
    const reportConfig = normalizeReportConfig({
        title,
        subtitle,
        summaryItems,
        sections,
        orientation,
    });
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) {
        return false;
    }

    printWindow.document.write(buildPrintReportDocument(reportConfig));

    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
        printWindow.print();
    }, 250);

    return true;
};
