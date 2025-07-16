// src/app/api/generate/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import jsPDF from 'jspdf';

// A function to fetch and encode images as base64
const getImageData = async (url: string) => {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(url);
    const buffer = await response.buffer();
    return buffer.toString('base64');
};

function formatPhoneNumber(phoneNumberString: string) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    var intlCode = (match[1] ? '+1 ' : '');
    return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('');
  }
  return null;
}

// 🔧 FIXED: Better phone number extraction from contact_id
function extractPhoneFromContactId(contactId: string): string | null {
    if (!contactId) return null;
    
    // Skip if it's clearly an email
    if (contactId.includes('@')) return null;
    
    // Extract all digits
    const digits = contactId.replace(/\D/g, '');
    
    // Check for valid US phone number patterns
    if (digits.length === 10) {
        return digits;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return digits.substring(1); // Remove country code
    }
    
    return null;
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
    const lte = new URL(req.url).searchParams.get('lte')
    const gte = new URL(req.url).searchParams.get('gte')
    const type = new URL(req.url).searchParams.get('type')

    console.log('Date range received:', { lte, gte, type });

    if (!lte || !gte) {
        return new Response('No valid date range provided!', { status: 400 });
    }

    // 🔧 FIXED: Dates are already properly formatted ISO strings from frontend
    const lteDate = new Date(lte);
    const gteDate = new Date(gte);

    // Validate dates
    if (isNaN(lteDate.getTime()) || isNaN(gteDate.getTime())) {
        return new Response('Invalid date format provided!', { status: 400 });
    }

    console.log('Database query range:', { 
        from: gteDate.toISOString(), 
        to: lteDate.toISOString(),
        fromEST: gteDate.toLocaleString("en-US", {timeZone: "America/New_York"}),
        toEST: lteDate.toLocaleString("en-US", {timeZone: "America/New_York"})
    });
    
    // 🔧 FIXED: Initialize jsPDF with 11x17 dimensions
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [279.4, 431.8], // 11x17 inches in mm (11" = 279.4mm, 17" = 431.8mm)
        compress: true
    });

    const logoUrl = type === "winme" 
        ? "https://staging.baddworldwide.com/test/uploads/winme_min_3fc7b4f20e.webp" 
        : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"
    
    // Load the logo image
    const logoImage = await getImageData(logoUrl);
    const logoDataURL = `data:image/png;base64,${logoImage}`;

    // 🔧 FIXED: Better date filtering - ensure we're only getting the correct month
    let tickets = [];
    
    console.log(`Querying ${type} tickets between ${gteDate.toISOString()} and ${lteDate.toISOString()}`);
    
    const whereClause = {
        created_at: {
            lte: lteDate,
            gte: gteDate
        },
        status: 'active'
    };
    
    if (type === 'winme') {
        tickets = await db.tickets_winme.findMany({
            where: whereClause,
            select: {
                ticket_number: true,
                product_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                created_at: true,
                contact_id: true,
                name: true
            },
            orderBy: {
                created_at: 'desc'                
            }
        });
    } else {
        tickets = await db.tickets.findMany({
            where: whereClause,
            select: {
                ticket_number: true,
                product_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                created_at: true,
                contact_id: true,
                name: true
            },
            orderBy: {
                created_at: 'desc'                
            }
        });
    }

    console.log(`Found ${tickets.length} tickets`);
    
    // 🔧 DEBUG: Check the actual months of returned tickets
    if (tickets.length > 0) {
        const ticketMonths = tickets.map(t => {
            if (!t.created_at) return 'unknown';
            const month = t.created_at.getMonth() + 1; // JavaScript months are 0-indexed
            const year = t.created_at.getFullYear();
            return `${year}-${month.toString().padStart(2, '0')}`;
        });
        const uniqueMonths = [...new Set(ticketMonths)];
        console.log('Ticket months found:', uniqueMonths);
        
        console.log('Sample tickets with dates:', tickets.slice(0, 5).map(t => ({
            ticket_number: t.ticket_number,
            created_at: t.created_at?.toISOString(),
            month: t.created_at ? t.created_at.getMonth() + 1 : null,
            year: t.created_at ? t.created_at.getFullYear() : null
        })));
    }

    if (tickets.length === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    // 🔧 FIXED: 11x17 layout - 5 across, 8 down (40 tickets per page)
    const pageWidth = 431.8;  // 17 inches in mm
    const pageHeight = 279.4; // 11 inches in mm
    
    const ticketsPerRow = 5;
    const ticketsPerColumn = 8;
    const totalTicketsPerPage = ticketsPerRow * ticketsPerColumn; // 40 tickets per page
    
    const marginX = 8;        // Horizontal spacing between tickets
    const marginY = 6;        // Vertical spacing between tickets
    const startX = 10;        // Left margin
    const startY = 10;        // Top margin
    
    // Calculate ticket dimensions to fit 5x8 grid on 11x17
    const availableWidth = pageWidth - (2 * startX) - ((ticketsPerRow - 1) * marginX);
    const availableHeight = pageHeight - (2 * startY) - ((ticketsPerColumn - 1) * marginY);
    
    const ticketWidth = availableWidth / ticketsPerRow;   // ~80mm per ticket
    const ticketHeight = availableHeight / ticketsPerColumn; // ~30mm per ticket
    
    console.log(`📐 11x17 Layout: ${ticketWidth.toFixed(1)}mm x ${ticketHeight.toFixed(1)}mm per ticket`);
    console.log(`📐 Total page usage: ${(startX + (ticketsPerRow * ticketWidth) + ((ticketsPerRow-1) * marginX) + startX).toFixed(1)}mm x ${(startY + (ticketsPerColumn * ticketHeight) + ((ticketsPerColumn-1) * marginY) + startY).toFixed(1)}mm`);

    for (let index = 0; index < tickets.length; index++) {
        const ticket = tickets[index];
        
        // Add a new page if needed
        if (index > 0 && index % totalTicketsPerPage === 0) {
            doc.addPage();
        }

        // Calculate position in 5x8 grid
        const pageIndex = index % totalTicketsPerPage;
        const row = Math.floor(pageIndex / ticketsPerRow);
        const col = pageIndex % ticketsPerRow;
        
        const xPosition = startX + col * (ticketWidth + marginX);
        const yPosition = startY + row * (ticketHeight + marginY);

        console.log(`Ticket ${index}: Row ${row}, Col ${col}, Position (${xPosition.toFixed(1)}, ${yPosition.toFixed(1)})`);

        // Draw ticket border for debugging (uncomment to see boundaries)
        // doc.rect(xPosition, yPosition, ticketWidth, ticketHeight);

        // Logo positioning
        const logoWidth = ticketWidth * 0.6;  // 60% of ticket width
        const logoHeight = ticketHeight * 0.25; // 25% of ticket height
        const logoX = xPosition + (ticketWidth - logoWidth) / 2;
        const logoY = yPosition + 2;
        
        doc.addImage(logoDataURL, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');

        // Ticket number
        doc.setFontSize(10).setFont('Helvetica', 'bold');
        const ticketY = logoY + logoHeight + 3;
        doc.text(ticket.ticket_number ?? '', xPosition + ticketWidth/2, ticketY, {align: 'center'});

        // Customer name
        doc.setFontSize(8).setFont('Helvetica', 'bold');
        let customerName = '';
        
        if (ticket.first_name || ticket.last_name) {
            customerName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
        } else if (ticket.name) {
            customerName = ticket.name;
        }
        
        const nameY = ticketY + 4;
        if (customerName) {
            const wrappedNameText = doc.splitTextToSize(customerName, ticketWidth - 4);
            doc.text(wrappedNameText, xPosition + ticketWidth/2, nameY, {align: 'center'});
        }

        // 🔧 FIXED: Improved phone number detection and display
        doc.setFontSize(7).setFont('Helvetica', 'normal');
        let phoneNumber = '';
        
        // Try multiple strategies to find phone number
        if (ticket.phone_number && ticket.phone_number.trim()) {
            phoneNumber = ticket.phone_number.trim();
        } else if (ticket.contact_id) {
            const extractedPhone = extractPhoneFromContactId(ticket.contact_id);
            if (extractedPhone) {
                phoneNumber = extractedPhone;
            }
        }
        
        // Log phone detection for debugging
        if (ticket.ticket_number) {
            console.log(`🔍 Ticket ${ticket.ticket_number}: phone_number='${ticket.phone_number}', contact_id='${ticket.contact_id}', extracted='${phoneNumber}'`);
        }
        
        const phoneY = nameY + 4;
        if (phoneNumber) {
            const formattedPhone = formatPhoneNumber(phoneNumber) || phoneNumber;
            doc.text(formattedPhone, xPosition + ticketWidth/2, phoneY, {align: 'center'});
        } else {
            // Show placeholder for debugging
            doc.setFontSize(6).setFont('Helvetica', 'italic');
            doc.text('No phone', xPosition + ticketWidth/2, phoneY, {align: 'center'});
        }

        // Email (only if different from phone and space permits)
        let emailAddress = '';
        if (ticket.email && ticket.email.trim()) {
            emailAddress = ticket.email.trim();
        } else if (ticket.contact_id && ticket.contact_id.includes('@')) {
            emailAddress = ticket.contact_id;
        }
        
        const emailY = phoneY + 3;
        if (emailAddress && emailAddress !== phoneNumber && emailY < yPosition + ticketHeight - 2) {
            doc.setFontSize(6).setFont('Helvetica', 'normal');
            const wrappedEmailText = doc.splitTextToSize(emailAddress, ticketWidth - 4);
            doc.text(wrappedEmailText, xPosition + ticketWidth/2, emailY, {align: 'center'});
        }

        // 🔧 DEBUG: Log tickets missing contact data
        if (!customerName && !phoneNumber && !emailAddress) {
            console.log(`⚠️ Ticket ${ticket.ticket_number} missing ALL contact data:`, {
                first_name: ticket.first_name,
                last_name: ticket.last_name,
                name: ticket.name,
                phone_number: ticket.phone_number,
                email: ticket.email,
                contact_id: ticket.contact_id,
                created_at: ticket.created_at ? ticket.created_at.toISOString() : 'No date'
            });
        }
    }

    const pdfBuffer = doc.output('arraybuffer');

    // Set headers and send the response
    return new Response(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${type}-tickets-${gteDate.toISOString().split('T')[0]}-to-${lteDate.toISOString().split('T')[0]}.pdf`
        }
    });
}
