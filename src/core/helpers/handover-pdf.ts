import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib"
import type { AssetHandover } from "../../modules/asset-handover/entities/asset-handover.entity"
import type { HandoverTransactionType } from "../enums"

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 40
const LEFT = MARGIN
const RIGHT = A4.w - MARGIN
const CONTENT_W = RIGHT - LEFT
const BORDER = rgb(0, 0, 0)

type Line = { text: string; checkbox?: boolean; checked?: boolean; bold?: boolean }

function formatDate(value?: string | Date | null): string {
    if (!value) return "-"
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const clean = (text ?? "").toString().replace(/\r?\n/g, " ").trim()
    if (!clean) return [""]
    const words = clean.split(/\s+/)
    const lines: string[] = []
    let current = ""
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
            current = candidate
        } else {
            if (current) lines.push(current)
            // Hard-break a single word that is too long
            if (font.widthOfTextAtSize(word, size) > maxWidth) {
                let chunk = ""
                for (const ch of word) {
                    if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
                        lines.push(chunk)
                        chunk = ch
                    } else {
                        chunk += ch
                    }
                }
                current = chunk
            } else {
                current = word
            }
        }
    }
    if (current) lines.push(current)
    return lines.length ? lines : [""]
}

/**
 * Generate the "FORM SERAH TERIMA ASET/BARANG" PDF for a handover.
 * Returns the raw PDF bytes.
 */
export async function generateHandoverPdf(handover: AssetHandover): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    const page = doc.addPage([A4.w, A4.h])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

    const drawText = (
        text: string,
        x: number,
        baseline: number,
        size: number,
        f: PDFFont = font
    ) => page.drawText(text, { x, y: baseline, size, font: f, color: rgb(0, 0, 0) })

    const cell = (x: number, top: number, w: number, h: number) =>
        page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: BORDER, borderWidth: 0.7 })

    // ---- Title ----
    const title = "FORM SERAH TERIMA ASET/BARANG"
    const titleSize = 13
    const titleW = fontBold.widthOfTextAtSize(title, titleSize)
    const titleX = (A4.w - titleW) / 2
    let y = A4.h - 45
    drawText(title, titleX, y, titleSize, fontBold)
    page.drawLine({
        start: { x: titleX, y: y - 3 },
        end: { x: titleX + titleW, y: y - 3 },
        thickness: 0.8,
        color: BORDER,
    })

    y -= 35

    // ---- Info table ----
    const tt = handover.transactionType as HandoverTransactionType
    const receivedName = handover.receivedBy?.name ?? "-"

    const infoRows: { label: string; lines: Line[] }[] = [
        { label: "Tanggal", lines: [{ text: formatDate(handover.createdAt) }] },
        { label: "Nama Karyawan", lines: [{ text: receivedName }] },
        {
            label: "Type",
            lines: [
                { text: "Penetapan", checkbox: true, checked: tt === "assign", bold: true },
                { text: "Pengembalian", checkbox: true, checked: tt === "return", bold: true },
            ],
        },
        { label: "Catatan", lines: [{ text: handover.note || "-" }] },
    ]

    const labelW = 175
    const valueW = CONTENT_W - labelW
    const size = 10
    const lineH = 18
    const padV = 6

    for (const row of infoRows) {
        // Expand each logical line into wrapped visual lines (checkbox lines stay single).
        const visual: { text: string; checkbox?: boolean; checked?: boolean; bold?: boolean }[] = []
        for (const line of row.lines) {
            if (line.checkbox) {
                visual.push(line)
            } else {
                const wrapped = wrapText(line.text, line.bold ? fontBold : font, size, valueW - 16)
                wrapped.forEach((t) => visual.push({ text: t, bold: line.bold }))
            }
        }

        const h = visual.length * lineH + 2 * padV - (lineH - 12)
        cell(LEFT, y, labelW, h)
        cell(LEFT + labelW, y, valueW, h)

        // Label (top-aligned)
        drawText(row.label, LEFT + 6, y - padV - size, size, font)

        // Values
        let baseY = y - padV - size
        for (const line of visual) {
            let tx = LEFT + labelW + 8
            if (line.checkbox) {
                page.drawRectangle({ x: tx, y: baseY - 1, width: 10, height: 10, borderColor: BORDER, borderWidth: 0.7 })
                if (line.checked) drawText("X", tx + 2, baseY + 0.5, 9, fontBold)
                tx += 16
            }
            drawText(line.text, tx, baseY, size, line.bold ? fontBold : font)
            baseY -= lineH
        }

        y -= h
    }

    y -= 22
    drawText("Telah diserahkan asset/barang berupa :", LEFT, y, size, font)
    y -= 12

    // ---- Items table ----
    const cols = [
        { title: "No.", w: 34 },
        { title: "Nama Asset/Barang", w: 165 },
        { title: "Code", w: 110 },
        { title: "Keterangan", w: CONTENT_W - 34 - 165 - 110 },
    ]
    const colX: number[] = []
    let cx = LEFT
    for (const c of cols) {
        colX.push(cx)
        cx += c.w
    }

    // Header
    const headerH = 24
    cx = LEFT
    for (const c of cols) {
        cell(cx, y, c.w, headerH)
        const tw = fontBold.widthOfTextAtSize(c.title, size)
        drawText(c.title, cx + (c.w - tw) / 2, y - headerH / 2 - size / 2 + 2, size, fontBold)
        cx += c.w
    }
    y -= headerH

    // Rows
    const items = handover.items ?? []
    items.forEach((item, idx) => {
        const no = String(idx + 1)
        const name = item.asset?.name ?? "-"
        const code = item.asset?.code ?? "-"
        const note = item.note || "-"

        const nameLines = wrapText(name, font, size, cols[1].w - 12)
        const codeLines = wrapText(code, font, size, cols[2].w - 12)
        const descLines = wrapText(note, font, size, cols[3].w - 12)
        const maxLines = Math.max(nameLines.length, codeLines.length, descLines.length, 1)
        const rowH = maxLines * (lineH - 4) + 8

        cx = LEFT
        for (const c of cols) {
            cell(cx, y, c.w, rowH)
            cx += c.w
        }

        const cellTop = y - 6 - size + 2
        drawText(no, colX[0] + (cols[0].w - font.widthOfTextAtSize(no, size)) / 2, cellTop, size, font)
        nameLines.forEach((l, i) => drawText(l, colX[1] + 6, cellTop - i * (lineH - 4), size, font))
        codeLines.forEach((l, i) => drawText(l, colX[2] + 6, cellTop - i * (lineH - 4), size, font))
        descLines.forEach((l, i) => drawText(l, colX[3] + 6, cellTop - i * (lineH - 4), size, font))

        y -= rowH
    })

    // ---- Signature ----
    y -= 30
    const halfW = CONTENT_W / 2
    const sigHeaderH = 24
    const sigBodyH = 95

    const menyerahkanName = handover.handedOverBy?.name ?? ""
    const menerimaName = handover.receivedBy?.name ?? ""

    const sig = (x: number, header: string, name: string) => {
        cell(x, y, halfW, sigHeaderH)
        const hw = fontBold.widthOfTextAtSize(header, size)
        drawText(header, x + (halfW - hw) / 2, y - sigHeaderH / 2 - size / 2 + 2, size, fontBold)

        cell(x, y - sigHeaderH, halfW, sigBodyH)
        const nameW = font.widthOfTextAtSize(name, size)
        drawText(name, x + (halfW - nameW) / 2, y - sigHeaderH - sigBodyH + 10, size, font)
    }

    sig(LEFT, "Yang Menyerahkan,", menyerahkanName)
    sig(LEFT + halfW, "Yang Menerima,", menerimaName)

    y -= sigHeaderH + sigBodyH + 14
    drawText("*Diisi narasi keterangan/kondisi barang yang diterima", LEFT, y, 8, font)

    return await doc.save()
}
