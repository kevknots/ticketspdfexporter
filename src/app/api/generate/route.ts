// src/app/api/route.ts

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

export const maxDuration = 300

export async function GET(req: NextRequest) {
    const lte = new URL(req.url).searchParams.get('lte')
    const gte = new URL(req.url).searchParams.get('gte')
    const type = new URL(req.url).searchParams.get('type')

    console.log('Date range:', { lte, gte, type });

    if (!lte || !gte) {
        return new Response('No valid date range provided!', { status: 400 });
    }

    // 🔧 FIXED: Use dates directly (already converted by browser)
    const lteDate = new Date(lte);
    const gteDate = new Date(gte);

    console.log('Database query range:', { 
        from: gteDate.toISOString(), 
        to: lteDate.toISOString(),
        fromLocal: gteDate.toLocaleString("en-US", {timeZone: "America/New_York"}),
        toLocal: lteDate.toLocaleString("en-US", {timeZone: "America/New_York"})
    });
    
    // Initialize jsPDF with better dimensions for ticket layout
    const doc = new jsPDF({
        orientation: 'landscape', // 🔧 CHANGED: Better for ticket grid
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const logoUrl = type === "winme" 
        ? "https://staging.baddworldwide.com/test/uploads/winme_min_3fc7b4f20e.webp" 
        : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"
    
    // Load the logo image
    const logoImage = await getImageData(logoUrl);
    const logoDataURL = `data:image/png;base64,${logoImage}`;

    // Fetch tickets based on type with debugging
    let tickets = [];
    
    console.log(`Querying ${type} tickets between ${gteDate.toISOString()} and ${lteDate.toISOString()}`);
    
    if (type === 'winme') {
        tickets = await db.tickets_winme.findMany({
            where: {
                created_at: {
                    lte: lteDate,
                    gte: gteDate
                },
                status: 'active'
            },
            select: {
                ticket_number: true,
                product_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                created_at: true,
                // 🔧 FIXED: Include all possible contact fields
                contact_id: true,
                name: true // Old format uses this field
            },
            orderBy: {
                created_at: 'desc'                
            }
        });
    } else {
        tickets = await db.tickets.findMany({
            where: {
                created_at: {
                    lte: lteDate,
                    gte: gteDate
                },
                status: 'active'
            },
            select: {
                ticket_number: true,
                product_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                created_at: true,
                // 🔧 FIXED: Include all possible contact fields
                contact_id: true,
                name: true // Old format uses this field
            },
            orderBy: {
                created_at: 'desc'                
            }
        });
    }

    console.log(`Found ${tickets.length} tickets`);
    if (tickets.length > 0) {
        console.log('Sample tickets:', tickets.slice(0, 3).map(t => ({
            ticket_number: t.ticket_number,
            created_at: t.created_at,
            name: `${t.first_name} ${t.last_name}`
        })));
    }

    // 🔧 DEBUG: Show recent tickets regardless of date range
    const recentTickets = await db.tickets.findMany({
        take: 5,
        select: {
            ticket_number: true,
            created_at: true,
            first_name: true,
            last_name: true
        },
        orderBy: {
            created_at: 'desc'
        }
    });
    console.log('5 most recent tickets in database:', recentTickets);

    if (tickets.length === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    // 🔧 FIXED: Better grid layout to prevent overflow
    const ticketWidth = 55;   // Slightly wider
    const ticketHeight = 50;  // Taller to fit all content
    const marginX = 3;        // Smaller horizontal margin
    const marginY = 3;        // Smaller vertical margin  
    const startX = 5;         // Smaller left margin
    const startY = 5;         // Smaller top margin
    
    // Grid configuration for landscape A4 (297mm x 210mm)
    const ticketsPerRow = 5;     // 5 tickets horizontally
    const ticketsPerColumn = 4;  // 🔧 REDUCED to 4 rows to prevent overflow
    const totalTicketsPerPage = ticketsPerRow * ticketsPerColumn; // 20 tickets per page

    for (let index = 0; index < tickets.length; index++) {
        const ticket = tickets[index];
        
        // Add a new page if needed
        if (index > 0 && index % totalTicketsPerPage === 0) {
            doc.addPage();
        }

        // 🔧 FIXED: Correct grid positioning
        const pageIndex = index % totalTicketsPerPage;
        const row = Math.floor(pageIndex / ticketsPerRow);
        const col = pageIndex % ticketsPerRow;
        
        const xPosition = startX + col * (ticketWidth + marginX);
        const yPosition = startY + row * (ticketHeight + marginY);

        console.log(`Ticket ${index}: Row ${row}, Col ${col}, Position (${xPosition}, ${yPosition})`);

        // 🔧 IMPROVED: Better ticket layout with proper data handling
        // Draw ticket border for debugging (uncomment to see boundaries)
        // doc.rect(xPosition, yPosition, ticketWidth, ticketHeight);

        // 🔧 FIXED: Centered logo position
        const logoWidth = 20;
        const logoHeight = 8;
        const logoX = xPosition + (ticketWidth - logoWidth) / 2; // Center horizontally
        const logoY = yPosition + 2;
        
        doc.addImage(logoDataURL, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');

        // Add ticket number (prominent, moved down to avoid overlap)
        doc.setFontSize(10).setFont('Helvetica', 'bold');
        doc.text(ticket.ticket_number ?? '', xPosition + ticketWidth/2, yPosition + 15, {align: 'center'});

        // 🔧 FIXED: Better customer name handling for both old and new formats
        doc.setFontSize(8).setFont('Helvetica', 'bold');
        let customerName = '';
        
        // Try different name fields (old vs new format)
        if (ticket.first_name || ticket.last_name) {
            customerName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
        } else if (ticket.name) {
            customerName = ticket.name; // Old format uses 'name' field
        }
        
        if (customerName) {
            const wrappedNameText = doc.splitTextToSize(customerName, ticketWidth - 4);
            doc.text(wrappedNameText, xPosition + ticketWidth/2, yPosition + 22, {align: 'center'});
        }

        // 🔧 FIXED: Better phone number handling
        doc.setFontSize(7).setFont('Helvetica', 'normal');
        let phoneNumber = ticket.phone_number;
        
        // If no phone_number, try contact_id (might contain phone for old format)
        if (!phoneNumber && ticket.contact_id) {
            // Check if contact_id looks like a phone number
            const contactId = String(ticket.contact_id);
            if (/^\d{10,}$/.test(contactId.replace(/\D/g, ''))) {
                phoneNumber = contactId;
            }
        }
        
        if (phoneNumber) {
            const formattedPhone = formatPhoneNumber(phoneNumber) || phoneNumber;
            doc.text(formattedPhone, xPosition + ticketWidth/2, yPosition + 30, {align: 'center'});
        }

        // 🔧 FIXED: Better email handling  
        doc.setFontSize(6);
        let emailAddress = ticket.email;
        
        // If no email, try contact_id (might contain email for old format)
        if (!emailAddress && ticket.contact_id) {
            const contactId = String(ticket.contact_id);
            if (contactId.includes('@')) {
                emailAddress = contactId;
            }
        }
        
        if (emailAddress) {
            const wrappedEmailText = doc.splitTextToSize(emailAddress, ticketWidth - 4);
            doc.text(wrappedEmailText, xPosition + ticketWidth/2, yPosition + 36, {align: 'center'});
        }

        // 🔧 DEBUG: Log missing data
        if (!customerName && !phoneNumber && !emailAddress) {
            console.log(`⚠️ Ticket ${ticket.ticket_number} missing contact data:`, {
                first_name: ticket.first_name,
                last_name: ticket.last_name,
                name: ticket.name,
                phone_number: ticket.phone_number,
                email: ticket.email,
                contact_id: ticket.contact_id
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
