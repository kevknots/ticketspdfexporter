// src/app/api/generate/route.ts - FAST PARALLEL VERSION

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import jsPDF from 'jspdf';
 
const logoCache = new Map<string, string>();

const getImageData = async (url: string): Promise<string> => {
    if (logoCache.has(url)) {
        return logoCache.get(url)!;
    }
    
    const fetch = (await import('node-fetch')).default
    const response = await fetch(url);
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    
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

// 🚀 PARALLEL: Process ticket data in batches
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
            : '';// src/app/api/generate/route.ts - PARALLEL PROCESSING FOR SPEED

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import jsPDF from 'jspdf';

const logoCache = new Map<string, string>();

const getImageData = async (url: string): Promise<string> => {
    if (logoCache.has(url)) {
        return logoCache.get(url)!;
    }
    
    const fetch = (await import('node-fetch')).default
    const response = await fetch(url);
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    
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

// 🚀 PARALLEL: Process ticket data in batches
async function processTicketBatch(tickets: any[]): Promise<any[]> {
    return tickets.map(ticket => {
        // Pre-process all data for this ticket
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

        // Pre-format phone number
        const formattedPhone = phoneNumber ? (formatPhoneNumber(phoneNumber) || phoneNumber) : '';

        // Truncate long text for performance
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

// 🚀 PARALLEL: Split array into chunks for parallel processing
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

    // 🚀 PARALLEL: Start logo loading and database query simultaneously
    console.log('⏱️ Starting parallel operations...');
    const logoUrl = type === "winme" 
        ? "https://staging.baddworldwide.com/test/uploads/winme_min_3fc7b4f20e.webp" 
        : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"

    const [logoImage, tickets] = await Promise.all([
        getImageData(logoUrl),
        // Database query
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

    console.log(`✅ Parallel operations completed in ${Date.now() - startTime}ms - Found ${tickets.length} tickets`);

    if (tickets.length === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    const logoDataURL = `data:image/png;base64,${logoImage}`;

    // 🚀 PARALLEL: Process all ticket data in parallel batches
    console.log('🔄 Processing ticket data in parallel...');
    const processingStart = Date.now();
    
    const BATCH_SIZE = 100; // Process 100 tickets at a time
    const ticketChunks = chunkArray(tickets, BATCH_SIZE);
    
    // Process all chunks in parallel
    const processedChunks = await Promise.all(
        ticketChunks.map(chunk => processTicketBatch(chunk))
    );
    
    // Flatten results
    const processedTickets = processedChunks.flat();
    
    console.log(`✅ Ticket processing completed in ${Date.now() - processingStart}ms`);

    // 🚀 PDF Generation with pre-processed data
    console.log('📄 Starting PDF generation...');
    const pdfStart = Date.now();

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [279.4, 431.8],
        compress: true
    });

    // Pre-calculate all layout constants
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

    // 🚀 OPTIMIZED: Batch font operations and minimize PDF API calls
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

        // Logo
        const logoX = xPos + (ticketWidth - logoWidth) / 2;
        const logoY = yPos + 2;
        // Add logo
        doc.addImage(logoDataURL, 'PNG', logoX, logoY, logoWidth, logoHeight);

        // Batch all text operations for this ticket
        const textOperations = [
            // Ticket number
            {
                text: ticket.ticket_number,
                x: xPos + ticketWidth/2,
                y: logoY + logoHeight + 3,
                fontSize: 10,
                font: 'Helvetica',
                style: 'bold',
                align: 'center' as const
            }
        ];

        // Customer name
        if (ticket.displayName) {
            textOperations.push({
                text: ticket.displayName,
                x: xPos + ticketWidth/2,
                y: logoY + logoHeight + 7,
                fontSize: 8,
                font: 'Helvetica',
                style: 'bold',
                align: 'center' as const
            });
        }

        // Phone number
        if (ticket.formattedPhone) {
            textOperations.push({
                text: ticket.formattedPhone,
                x: xPos + ticketWidth/2,
                y: logoY + logoHeight + 11,
                fontSize: 7,
                font: 'Helvetica',
                style: 'normal',
                align: 'center' as const
            });
        }

        // Email
        if (ticket.displayEmail) {
            textOperations.push({
                text: ticket.displayEmail,
                x: xPos + ticketWidth/2,
                y: logoY + logoHeight + 14,
                fontSize: 6,
                font: 'Helvetica',
                style: 'normal',
                align: 'center' as const
            });
        }

        // Execute all text operations for this ticket
        textOperations.forEach(op => {
            doc.setFontSize(op.fontSize).setFont(op.font, op.style);
            doc.text(op.text, op.x, op.y, { align: op.align });
        });

        // Progress logging every 200 tickets
        if ((index + 1) % 200 === 0) {
            console.log(`⏱️ PDF Progress: ${index + 1}/${processedTickets.length} tickets (${Math.round(((index + 1) / processedTickets.length) * 100)}%)`);
        }
    }

    console.log(`✅ PDF generation completed in ${Date.now() - pdfStart}ms`);

    // Generate PDF buffer
    const bufferStart = Date.now();
    const pdfBuffer = doc.output('arraybuffer');
    console.log(`✅ PDF buffer generated in ${Date.now() - bufferStart}ms`);

    console.log(`🎉 TOTAL PARALLEL PDF GENERATION TIME: ${Date.now() - startTime}ms`);

    return new Response(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${type}-tickets-${gteDate.toISOString().split('T')[0]}-to-${lteDate.toISOString().split('T')[0]}.pdf`,
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
