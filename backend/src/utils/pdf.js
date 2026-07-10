import PDFDocument from 'pdfkit';

// sections: [{ heading, lines?: string[], table?: { columns: [{key, header, width?}], rows } }]
export function buildPdf(title, sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(title);
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#666')
      .text(`Generated ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();

    for (const section of sections) {
      doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text(section.heading);
      doc.moveDown(0.4);

      if (section.lines) {
        doc.fontSize(10).font('Helvetica');
        for (const line of section.lines) doc.text(line);
      }

      if (section.table) {
        const { columns, rows } = section.table;
        const startX = doc.page.margins.left;
        const usable = doc.page.width - startX - doc.page.margins.right;
        const colWidth = usable / columns.length;

        const drawRow = (values, bold = false) => {
          if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
          const y = doc.y;
          doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
          values.forEach((v, i) => {
            doc.text(String(v ?? ''), startX + i * colWidth, y, {
              width: colWidth - 6,
              ellipsis: true,
            });
          });
          doc.moveDown(0.3);
        };

        drawRow(columns.map((c) => c.header), true);
        for (const row of rows) drawRow(columns.map((c) => row[c.key]));
      }
      doc.moveDown();
    }

    doc.end();
  });
}
