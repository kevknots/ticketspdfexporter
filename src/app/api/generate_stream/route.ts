// src/app/api/generate-stream/route.ts - STREAMING FOR LARGE DATASETS

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import jsPDF from 'jspdf';

const logoCache = new Map<string, string>();

const getImageData = async (url: string): Promise<string> => {
    if (logoCache.has(url)) {
        return logoCache.get(url)!;
    }
    
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    logoCache.set(url, base64);
    return base64;
};

const PHONE_REGEX = /^(1|)?(\d{3})(\d{3})(\d{4})$/;

function formatPhoneNumber(phoneNumberString: string): string | null {
    const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
    const match = cleaned.match(PHONE_REGEX);
    if (match) {
        const intlCode = (match[1] ? '+1 ' : '');
        return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('');
    }
    return null;
}

function extractPhoneFromContactId(contactId: string): string | null {
    if (!contactId || contactId.includes('@')) return null;
    const digits = contactId.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 11 && digits.startsWith('1')) return digits.substring(1);
    return null;
}

async function streamProcessTickets(
    doc: jsPDF,
    tickets: any[],
    logoDataURL: string,
    startIndex: number = 0
): Promise<void> {
    
    const pageWidth = 431.8, pageHeight = 279.4;
    const ticketsPerRow = 5, ticketsPerColumn = 8;
    const totalTicketsPerPage = 40;
    const marginX = 8, marginY = 6, startX = 10, startY = 10;
    
    const availableWidth = pageWidth - (2 * startX) - ((ticketsPerRow - 1) * marginX);
    const availableHeight = pageHeight - (2 * startY) - ((ticketsPerColumn - 1) * marginY);
    const ticketWidth = availableWidth / ticketsPerRow;
    const ticketHeight = availableHeight / ticketsPerColumn;
    const logoWidth = ticketWidth * 0.6;
    const logoHeight = ticketHeight * 0.25;

    const MICRO_BATCH_SIZE = 20;
    
    for (let batchStart = 0; batchStart < tickets.length; batchStart += MICRO_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + MICRO_BATCH_SIZE, tickets.length);
        const batch = tickets.slice(batchStart, batchEnd);
        
        const processedBatch = await Promise.all(
            batch.map(async (ticket, batchIndex) => {
                const globalIndex = startIndex + batchStart + batchIndex;
                
                let customerName = '';
                if (ticket.first_name || ticket.last_name) {
                    customerName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
                } else if (ticket.name) {
                    customerName = ticket.name;
                }

                let phoneNumber = '';
                if (ticket.phone_number?.trim()) {
                    phoneNumber = ticket.phone_number.trim();
                } else if (ticket.contact_id) {
                    const extracted = extractPhoneFromContactId(ticket.contact_id);
                    if (extracted) phoneNumber = extracted;
                }

                let emailAddress = '';
                if (ticket.email?.trim()) {
                    emailAddress = ticket.email.trim();
                } else if (ticket.contact_id?.includes('@')) {
                    emailAddress = ticket.contact_id;
                }

                const formattedPhone = phoneNumber ? (formatPhoneNumber(phoneNumber) || phoneNumber) : '';
                const displayName = customerName.length > 25 ? customerName.substring(0, 25) + '...' : customerName;
                const displayEmail = emailAddress && emailAddress !== phoneNumber 
                    ? (emailAddress.length > 30 ? emailAddress.substring(0, 30) + '...' : emailAddress)
                    : '';

                if (globalIndex > 0 && globalIndex % totalTicketsPerPage === 0) {
                    return { addPage: true };
                }

                const pageIndex = globalIndex % totalTicketsPerPage;
                const row = Math.floor(pageIndex / ticketsPerRow);
                const col = pageIndex % ticketsPerRow;
                
                const xPos = startX + col * (ticketWidth + marginX);
                const yPos = startY + row * (ticketHeight + marginY);

                return {
                    ticket_number: ticket.ticket_number ?? '',
                    displayName,
                    formattedPhone,
                    displayEmail,
                    xPos,
                    yPos,
                    logoX: xPos + (ticketWidth - logoWidth) / 2,
                    logoY: yPos + 2,
                    logoWidth,
                    logoHeight,
                    ticketWidth,
                    globalIndex
                };
            })
        );

        for (const item of processedBatch) {
            if (item.addPage) {
                doc.addPage();
                continue;
            }

            doc.addImage(logoDataURL, 'PNG', item.logoX, item.logoY, item.logoWidth, item.logoHeight);

            const textY = item.logoY + item.logoHeight + 3;
            
            doc.setFontSize(10).setFont('Helvetica', 'bold');
            doc.text(item.ticket_number, item.xPos + item.ticketWidth/2, textY, {align: 'center'});

            if (item.displayName) {
                doc.setFontSize(8).setFont('Helvetica', 'bold');
                doc.text(item.displayName, item.xPos + item.ticketWidth/2, textY + 4, {align: 'center'});
            }

            if (item.formattedPhone) {
                doc.setFontSize(7).setFont('Helvetica', 'normal');
                doc.text(item.formattedPhone, item.xPos + item.ticketWidth/2, textY + 8, {align: 'center'});
            }

            if (item.displayEmail) {
                doc.setFontSize(6).setFont('Helvetica', 'normal');
                doc.text(item.displayEmail, item.xPos + item.ticketWidth/2, textY + 11, {align: 'center'});
            }
        }

        const totalProcessed = startIndex + batchEnd;
        if (batchEnd % 100 === 0 || batchEnd === tickets.length) {
            console.log(`⚡ STREAMING: Processed ${totalProcessed} tickets`);
        }

        await new Promise(resolve => setImmediate(resolve));
    }
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    const lte = new URL(req.url).searchParams.get('lte')
    const gte = new URL(req.url).searchParams.get('gte')
    const type = new URL(req.url).searchParams.get('type')
    const limit = new URL(req.url).searchParams.get('limit')

    console.log('⚡ STREAMING PDF Generation started:', { lte, gte, type, limit });

    if (!lte || !gte) {
        return new Response('No valid date range provided!', { status: 400 });
    }

    const lteDate = new Date(lte);
    const gteDate = new Date(gte);

    if (isNaN(lteDate.getTime()) || isNaN(gteDate.getTime())) {
        return new Response('Invalid date format provided!', { status: 400 });
    }

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [279.4, 431.8],
        compress: true
    });

    const logoUrl = type === "winme" 
        ? "https://staging.baddworldwide.com/test/uploads/winme_min_3fc7b4f20e.webp" 
        : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"

    console.log('🚀 Starting parallel logo + database operations...');
    
    const [logoImage, totalCount] = await Promise.all([
        getImageData(logoUrl),
        (async () => {
            const whereClause = {
                created_at: { lte: lteDate, gte: gteDate },
                status: 'active'
            };
            return type === 'winme' ? 
                db.tickets_winme.count({ where: whereClause }) :
                db.tickets.count({ where: whereClause });
        })()
    ]);

    console.log(`✅ Found ${totalCount} total tickets`);
    
    if (totalCount === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    const logoDataURL = `data:image/png;base64,${logoImage}`;

    const CHUNK_SIZE = 1500;
    const actualLimit = limit ? Math.min(parseInt(limit), totalCount) : totalCount;
    
    let processedTotal = 0;
    
    for (let offset = 0; offset < actualLimit; offset += CHUNK_SIZE) {
        const currentChunkSize = Math.min(CHUNK_SIZE, actualLimit - offset);
        
        console.log(`📦 Processing chunk ${Math.floor(offset/CHUNK_SIZE) + 1}: tickets ${offset + 1}-${offset + currentChunkSize}`);
        
        const queryOptions = {
            where: {
                created_at: { lte: lteDate, gte: gteDate },
                status: 'active'
            },
            select: {
                ticket_number: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                contact_id: true,
                name: true
            },
            orderBy: { created_at: 'desc' as const },
            skip: offset,
            take: currentChunkSize
        };
        
        const ticketChunk = await (type === 'winme' ? 
            db.tickets_winme.findMany(queryOptions) :
            db.tickets.findMany(queryOptions)
        );

        await streamProcessTickets(doc, ticketChunk, logoDataURL, processedTotal);
        
        processedTotal += ticketChunk.length;
        
        console.log(`✅ Chunk completed. Total processed: ${processedTotal}/${actualLimit}`);
    }

    console.log('📄 Generating final PDF buffer...');
    const bufferStart = Date.now();
    const pdfBuffer = doc.output('arraybuffer');
    console.log(`✅ PDF buffer generated in ${Date.now() - bufferStart}ms`);

    console.log(`🎉 TOTAL STREAMING PDF TIME: ${Date.now() - startTime}ms for ${processedTotal} tickets`);

    return new Response(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${type}-tickets-${gteDate.toISOString().split('T')[0]}-to-${lteDate.toISOString().split('T')[0]}.pdf`,
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
