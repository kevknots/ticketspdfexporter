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

// 🔧 FIXED: Simplified EST timezone conversion
const convertToEST = (dateString: string): Date => {
  const date = new Date(dateString);
  
  // Convert to EST (UTC-5) or EDT (UTC-4) based on DST
  const year = date.getFullYear();
  const dstStart = new Date(year, 2, 14 - new Date(year, 2, 14).getDay()); // 2nd Sunday in March
  const dstEnd = new Date(year, 10, 7 - new Date(year, 10, 7).getDay());   // 1st Sunday in November
  
  const isDST = date >= dstStart && date < dstEnd;
  const offsetHours = isDST ? -4 : -5; // EDT or EST
  
  // Apply the offset
  const estDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
  
  console.log(`Original: ${dateString}, EST: ${estDate.toISOString()}`);
  return estDate;
};

export const maxDuration = 300

export async function GET(req: NextRequest) {
    const lte = new URL(req.url).searchParams.get('lte')
    const gte = new URL(req.url).searchParams.get('gte')
    const type = new URL(req.url).searchParams.get('type')

    console.log('Date range:', { lte, gte, type });

    if (!lte || !gte) {
        return new Response('No valid date range provided!', { status: 400 });
    }

    // 🔧 FIXED: Simple EST conversion
    const lteEST = convertToEST(lte);
    const gteEST = convertToEST(gte);

    console.log('EST Date range:', { lteEST, gteEST });
    
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

    // Fetch tickets based on type
    let tickets = [];
    if (type === 'winme') {
        tickets = await db.tickets_winme.findMany({
            where: {
                created_at: {
                    lte: lteEST,
                    gte: gteEST
                },
                status: 'active'
            },
            select: {
                ticket_number: true,
                product_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true
            },
            orderBy: {
                created_at: 'desc'                
            }
        });
    } else {
        tickets = await db.tickets.findMany({
            where: {
                created_at: {
                    lte: lteEST,
                    gte: gteEST
                },
                status: 'active'
            },
            select: {
                ticket_number: true,
                product_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true
            },
            orderBy: {
                created_at: 'desc'                
            }
        });
    }

    console.log(`Found ${tickets.length} tickets to export`);

    if (tickets.length === 0) {
        return new Response('No tickets found for the specified date range!', { status: 404 });
    }

    // 🔧 FIXED: Proper grid layout calculations
    const ticketWidth = 50;   // Width of each ticket
    const ticketHeight = 40;  // Height of each ticket  
    const marginX = 5;        // Horizontal margin between tickets
    const marginY = 5;        // Vertical margin between tickets
    const startX = 10;        // Left margin of page
    const startY = 10;        // Top margin of page
    
    // Grid configuration for landscape A4
    const ticketsPerRow = 5;     // 5 tickets horizontally
    const ticketsPerColumn = 6;  // 6 tickets vertically
    const totalTicketsPerPage = ticketsPerRow * ticketsPerColumn; // 30 tickets per page

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

        // 🔧 IMPROVED: Better ticket layout
        // Draw ticket border (optional - for debugging)
        // doc.rect(xPosition, yPosition, ticketWidth, ticketHeight);

        // Add logo image (smaller and better positioned)
        doc.addImage(logoDataURL, 'PNG', xPosition + 2, yPosition + 2, 20, 8, undefined, 'FAST');

        // Add ticket number (prominent)
        doc.setFontSize(12).setFont('Helvetica', 'bold');
        doc.text(ticket.ticket_number ?? '', xPosition + ticketWidth/2, yPosition + 15, {align: 'center'});

        // Add customer name
        doc.setFontSize(9).setFont('Helvetica', 'bold');
        const customerName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
        if (customerName) {
            const wrappedNameText = doc.splitTextToSize(customerName, ticketWidth - 4);
            doc.text(wrappedNameText, xPosition + ticketWidth/2, yPosition + 20, {align: 'center'});
        }

        // Add phone number
        doc.setFontSize(8).setFont('Helvetica', 'normal');
        const formattedPhone = formatPhoneNumber(ticket.phone_number ?? '') || ticket.phone_number;
        if (formattedPhone) {
            doc.text(formattedPhone, xPosition + ticketWidth/2, yPosition + 26, {align: 'center'});
        }

        // Add email (smaller font, wrapped)
        doc.setFontSize(7);
        if (ticket.email) {
            const wrappedEmailText = doc.splitTextToSize(ticket.email, ticketWidth - 4);
            doc.text(wrappedEmailText, xPosition + ticketWidth/2, yPosition + 30, {align: 'center'});
        }
    }

    const pdfBuffer = doc.output('arraybuffer');

    // Set headers and send the response
    return new Response(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${type}-tickets-${gteEST.toISOString().split('T')[0]}-to-${lteEST.toISOString().split('T')[0]}.pdf`
        }
    });
}
