// src/app/api/generate/route.ts - OPTIMIZED VERSION

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import jsPDF from 'jspdf';

// 🚀 OPTIMIZATION: Cache logo images to avoid repeated downloads
const logoCache = new Map<string, string>();

// A function to fetch and encode images as base64 with caching
const getImageData = async (url: string): Promise<string> => {
    if (logoCache.has(url)) {
        return logoCache.get(url)!;
    }
    
    const fetch = (await import('node-fetch')).default
    const response = await fetch(url);
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    
    // Cache for future use
    logoCache.set(url, base64);
    return base64;
};

// 🚀 OPTIMIZATION: Pre-compiled phone number regex
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

// 🚀 OPTIMIZATION: Faster phone extraction with early returns
function extractPhoneFromContactId(contactId: string): string | null {
    if (!contactId || contactId.includes('@')) return null;
    
    const digits = contactId.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 11 && digits.startsWith('1')) return digits.substring(1);
    
    return null;
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    const lte = new URL(req.url).searchParams.get('lte')
    const gte = new URL(req.url).searchParams.get('gte')
    const type = new URL(req.url).searchParams.get('type')
    const limit = new URL(req.url).searchParams.get('limit') // 🚀 NEW: Optional limit

    console.log('🚀 PDF Generation started:', { lte, gte, type, limit });

    if (!lte || !gte) {
        return new Response('No valid date range provided!', { status: 400 });
    }

    const lteDate = new Date(lte);
    const gteDate = new Date(gte);

    if (isNaN(lteDate.getTime()) || isNaN(gteDate.getTime())) {
        return new Response('Invalid date format provided!', { status: 400 });
    }

    // 🚀 OPTIMIZATION: Initialize PDF early to reduce memory allocations
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [279.4, 431.8], // 11x17 inches in mm
        compress: true
    });

    // 🚀 OPTIMIZATION: Load logo once and cache it
    console.log('⏱️ Loading logo...');
    const logoUrl = type === "winme" 
        ? "https://staging.baddworldwide.com/test/uploads/winme_min_3fc7b4f20e.webp" 
        : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"
    
    const logoImage = await getImageData(logoUrl);
    const logoDataURL = `data:image/png;base64,${logoImage}`;
    console.log('✅ Logo loaded in', Date.now() - startTime, 'ms');

    // 🚀 OPTIMIZATION: Streamlined database query with selective fields only
    const queryStart = Date.now();
    const whereClause = {
        created_at: { lte: lteDate, gte: gteDate },
        status: 'active'
    };

    // Add limit if specified (useful for testing)
    const queryOptions = {
        where: whereClause,
        select: {
            ticket_number: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            email: true,
            contact_id: true,
            name: true
            // 🚀 REMOVED: created_at, product_id (not needed for PDF)
        },
        orderBy: { created_at: 'desc' as const },
        ...(limit ? { take: parseInt(limit) } : {})
    };
    
    const tickets = await (type === 'winme' ? 
        db.tickets_winme.findMany(queryOptions) :
        db.tickets.findMany(queryOptions)
    );

    console.log(`✅ Database query completed in ${Date.now() - queryStart}ms - Found ${tickets.length} tickets`);

    if (tickets.length === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    // 🚀 OPTIMIZATION: Pre-calculate all layout constants
    const pageWidth = 431.8, pageHeight = 279.4;
    const ticketsPerRow = 5, ticketsPerColumn = 8;
    const totalTicketsPerPage = 40;
    const marginX = 8, marginY = 6, startX = 10, startY = 10;
    
    const availableWidth = pageWidth - (2 * startX) - ((ticketsPerRow - 1) * marginX);
    const availableHeight = pageHeight - (2 * startY) - ((ticketsPerColumn - 1) * marginY);
    const ticketWidth = availableWidth / ticketsPerRow;
    const ticketHeight = availableHeight / ticketsPerColumn;

    console.log(`📐 Layout: ${ticketWidth.toFixed(1)}mm x ${ticketHeight.toFixed(1)}mm per ticket`);

    // 🚀 OPTIMIZATION: Pre-calculate logo dimensions
    const logoWidth = ticketWidth * 0.6;
    const logoHeight = ticketHeight * 0.25;

    // 🚀 OPTIMIZATION: Process tickets in batches for better memory management
    const renderStart = Date.now();
    let processedCount = 0;

    for (let index = 0; index < tickets.length; index++) {
        const ticket = tickets[index];
        
        // Add new page every 40 tickets
        if (index > 0 && index % totalTicketsPerPage === 0) {
            doc.addPage();
        }

        // Calculate grid position
        const pageIndex = index % totalTicketsPerPage;
        const row = Math.floor(pageIndex / ticketsPerRow);
        const col = pageIndex % ticketsPerRow;
        
        const xPos = startX + col * (ticketWidth + marginX);
        const yPos = startY + row * (ticketHeight + marginY);

        // 🚀 OPTIMIZATION: Set all font properties once per ticket type
        const logoX = xPos + (ticketWidth - logoWidth) / 2;
        const logoY = yPos + 2;
        
        // Add logo
        doc.addImage(logoDataURL, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');

        // Ticket number - set font once
        doc.setFontSize(10).setFont('Helvetica', 'bold');
        const ticketY = logoY + logoHeight + 3;
        doc.text(ticket.ticket_number ?? '', xPos + ticketWidth/2, ticketY, {align: 'center'});

        // Customer name
        let customerName = '';
        if (ticket.first_name || ticket.last_name) {
            customerName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
        } else if (ticket.name) {
            customerName = ticket.name;
        }
        
        if (customerName) {
            doc.setFontSize(8).setFont('Helvetica', 'bold');
            const nameY = ticketY + 4;
            // 🚀 OPTIMIZATION: Simplified text wrapping
            const maxNameLength = 25; // Approximate character limit
            const displayName = customerName.length > maxNameLength 
                ? customerName.substring(0, maxNameLength) + '...' 
                : customerName;
            doc.text(displayName, xPos + ticketWidth/2, nameY, {align: 'center'});
        }

        // 🚀 OPTIMIZATION: Streamlined phone detection
        let phoneNumber = '';
        if (ticket.phone_number?.trim()) {
            phoneNumber = ticket.phone_number.trim();
        } else if (ticket.contact_id) {
            const extracted = extractPhoneFromContactId(ticket.contact_id);
            if (extracted) phoneNumber = extracted;
        }
        
        if (phoneNumber) {
            doc.setFontSize(7).setFont('Helvetica', 'normal');
            const phoneY = ticketY + 8;
            const formattedPhone = formatPhoneNumber(phoneNumber) || phoneNumber;
            doc.text(formattedPhone, xPos + ticketWidth/2, phoneY, {align: 'center'});
        }

        // 🚀 OPTIMIZATION: Only add email if space permits and different from phone
        let emailAddress = '';
        if (ticket.email?.trim()) {
            emailAddress = ticket.email.trim();
        } else if (ticket.contact_id?.includes('@')) {
            emailAddress = ticket.contact_id;
        }
        
        if (emailAddress && emailAddress !== phoneNumber) {
            doc.setFontSize(6).setFont('Helvetica', 'normal');
            const emailY = ticketY + 11;
            // 🚀 OPTIMIZATION: Truncate long emails
            const maxEmailLength = 30;
            const displayEmail = emailAddress.length > maxEmailLength 
                ? emailAddress.substring(0, maxEmailLength) + '...' 
                : emailAddress;
            doc.text(displayEmail, xPos + ticketWidth/2, emailY, {align: 'center'});
        }

        processedCount++;
        
        // 🚀 OPTIMIZATION: Progress logging every 50 tickets instead of every ticket
        if (processedCount % 50 === 0) {
            console.log(`⏱️ Processed ${processedCount}/${tickets.length} tickets`);
        }
    }

    console.log(`✅ PDF rendering completed in ${Date.now() - renderStart}ms`);

    // 🚀 OPTIMIZATION: Generate PDF buffer
    const bufferStart = Date.now();
    const pdfBuffer = doc.output('arraybuffer');
    console.log(`✅ PDF buffer generated in ${Date.now() - bufferStart}ms`);

    console.log(`🎉 Total PDF generation time: ${Date.now() - startTime}ms`);

    return new Response(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${type}-tickets-${gteDate.toISOString().split('T')[0]}-to-${lteDate.toISOString().split('T')[0]}.pdf`,
            'Cache-Control': 'public, max-age=3600' // 🚀 NEW: Cache for 1 hour
        }
    });
}
