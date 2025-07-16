// src/app/api/generate/route.ts - FAST PARALLEL PROCESSING

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

async function processTicketBatch(tickets: any[]): Promise<any[]> {
    return tickets.map(ticket => {
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

        return {
            ticket_number: ticket.ticket_number ?? '',
            displayName,
            formattedPhone,
            displayEmail
        };
    });
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    const lte = new URL(req.url).searchParams.get('lte')
    const gte = new URL(req.url).searchParams.get('gte')
    const type = new URL(req.url).searchParams.get('type')
    const limit = new URL(req.url).searchParams.get('limit')

    console.log('🚀 PARALLEL PDF Generation started:', { lte, gte, type, limit });

    if (!lte || !gte) {
        return new Response('No valid date range provided!', { status: 400 });
    }

    const lteDate = new Date(lte);
    const gteDate = new Date(gte);

    if (isNaN(lteDate.getTime()) || isNaN(gteDate.getTime())) {
        return new Response('Invalid date format provided!', { status: 400 });
    }

    const logoUrl = type === "winme" 
        ? "https://staging.baddworldwide.com/test/uploads/winme_min_3fc7b4f20e.webp" 
        : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"

    const [logoImage, tickets] = await Promise.all([
        getImageData(logoUrl),
        (async () => {
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
                ...(limit ? { take: parseInt(limit) } : {})
            };
            
            return type === 'winme' ? 
                db.tickets_winme.findMany(queryOptions) :
                db.tickets.findMany(queryOptions);
        })()
    ]);

    console.log(`✅ Found ${tickets.length} tickets in ${Date.now() - startTime}ms`);

    if (tickets.length === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    const logoDataURL = `data:image/png;base64,${logoImage}`;

    const processingStart = Date.now();
    const BATCH_SIZE = 100;
    const ticketChunks = chunkArray(tickets, BATCH_SIZE);
    
    const processedChunks = await Promise.all(
        ticketChunks.map(chunk => processTicketBatch(chunk))
    );
    
    const processedTickets = processedChunks.flat();
    console.log(`✅ Processed all tickets in ${Date.now() - processingStart}ms`);

    const pdfStart = Date.now();
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [279.4, 431.8],
        compress: true
    });

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

    for (let index = 0; index < processedTickets.length; index++) {
        const ticket = processedTickets[index];
        
        if (index > 0 && index % totalTicketsPerPage === 0) {
            doc.addPage();
        }

        const pageIndex = index % totalTicketsPerPage;
        const row = Math.floor(pageIndex / ticketsPerRow);
        const col = pageIndex % ticketsPerRow;
        
        const xPos = startX + col * (ticketWidth + marginX);
        const yPos = startY + row * (ticketHeight + marginY);

        const logoX = xPos + (ticketWidth - logoWidth) / 2;
        const logoY = yPos + 2;
        doc.addImage(logoDataURL, logoX, logoY, logoWidth, logoHeight);

        doc.setFontSize(10).setFont('Helvetica', 'bold');
        const ticketY = logoY + logoHeight + 3;
        doc.text(ticket.ticket_number, xPos + ticketWidth/2, ticketY, {align: 'center'});

        if (ticket.displayName) {
            doc.setFontSize(8).setFont('Helvetica', 'bold');
            doc.text(ticket.displayName, xPos + ticketWidth/2, ticketY + 4, {align: 'center'});
        }

        if (ticket.formattedPhone) {
            doc.setFontSize(7).setFont('Helvetica', 'normal');
            doc.text(ticket.formattedPhone, xPos + ticketWidth/2, ticketY + 8, {align: 'center'});
        }

        if (ticket.displayEmail) {
            doc.setFontSize(6).setFont('Helvetica', 'normal');
            doc.text(ticket.displayEmail, xPos + ticketWidth/2, ticketY + 11, {align: 'center'});
        }

        if ((index + 1) % 200 === 0) {
            console.log(`⏱️ Progress: ${index + 1}/${processedTickets.length} tickets`);
        }
    }

    console.log(`✅ PDF generated in ${Date.now() - pdfStart}ms`);

    const pdfBuffer = doc.output('arraybuffer');
    console.log(`🎉 TOTAL TIME: ${Date.now() - startTime}ms for ${processedTickets.length} tickets`);

    return new Response(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${type}-tickets-${gteDate.toISOString().split('T')[0]}-to-${lteDate.toISOString().split('T')[0]}.pdf`,
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
