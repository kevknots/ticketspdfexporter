// src/app/api/route.ts

import { NextRequest } from "next/server";
//import PDFDocument from 'pdfkit';
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

     // Create a new PDF document

     const lte = new URL(req.url).searchParams.get('lte')
     const gte = new URL(req.url).searchParams.get('gte')
     const type = new URL(req.url).searchParams.get('type')
 
     const convertTZ = (date: string, tzString:string) => {
        return new Date((new Date(date)).toLocaleString("en-US", {timeZone: tzString}));   
    }

    const lteDate =  lte ? convertTZ(lte?.toString(), 'America/New_York') : null

    const gteDate = gte ? convertTZ(gte?.toString(), 'America/New_York') : null

    // Initialize jsPDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [432, 279],
    compress: true
  });

  const logoUrl = type==="winme" ? "https://staging.baddworldwide.com/test/uploads/winme_1_7ca7a7ffc2.webp" : "https://staging.baddworldwide.com/test/uploads/header_logo_badd_1_p_1_1_336873557e.png"
  // Load the logo image
  const logoImage = await getImageData(logoUrl);
  const logoDataURL = `data:image/png;base64,${logoImage}`;


        if(lteDate && gteDate){

            console.log(type)

            console.log(type === 'winme')
            
            let tickets = [] 
            if(type === 'winme'){
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
                    name: true,
                    phone_number: true,
                    email: true
                },
                orderBy: {
                    created_at: 'desc'                
                }
             })
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
                    name: true,
                    phone_number: true,
                    email: true
                },
                orderBy: {
                    created_at: 'desc'                
                }
            });
            } 

            console.log(tickets)

         // Calculate the width and height of each ticket in the grid
         const ticketWidth = 35; // Adjust based on your layout
         const ticketHeight = 45; // Adjust based on your layout
         const margin = 5; // Adjust based on your layout
         const ticketsPerRow = 8;
         const ticketsPerColumn = 5;
         const totalTicketsPerPage = 40;

         let index = 0

         for(let ticket of tickets){
             const rowIndex = Math.floor(index / ticketsPerColumn) % ticketsPerRow; // Calculate row index
             const columnIndex = index % ticketsPerColumn; // Calculate column index     
             const xPosition = 25 + margin+10 + columnIndex * (ticketWidth + margin+10);
             const yPosition = 10 + margin + rowIndex * (ticketHeight + margin);
         
            // Add a new page if the current ticket index is a multiple of `totalTicketsPerPage` and is not the first ticket
            if (index > 0 && index % totalTicketsPerPage === 0) {
                doc.addPage();
            }
           // Add logo image
           doc.addImage(logoDataURL, 'PNG', xPosition-12, yPosition, 25, 10, undefined, 'FAST');
           


           // Add text elements
           doc.setFontSize(15).setFont('Helvetica', 'bold');
           doc.text(ticket.ticket_number ?? '', xPosition, yPosition + 15, {align: 'center'});
           doc.setFontSize(10).setFont('Helvetica', 'bold');
            // Wrap text if it's too long
            const maxTextWidth = ticketWidth + 15; // max width for the text, adjust as necessary
            const wrappedNameText = doc.splitTextToSize(ticket.name ?? '', maxTextWidth);
           doc.text(wrappedNameText, xPosition, yPosition + 20, {align: 'center'});
           doc.setFont('Helvetica', 'normal');
           doc.text((formatPhoneNumber(ticket.phone_number ?? '') || ticket.phone_number) ?? '', xPosition, yPosition + 26, {align: 'center'});

           doc.setFontSize(8)
            // Wrap text if it's too long
            const maxEmailTextWidth = ticketWidth + 5; // max width for the text, adjust as necessary
            const wrappedEmailText = doc.splitTextToSize(ticket.email ?? '', maxEmailTextWidth);
            doc.text(wrappedEmailText, xPosition, yPosition + 30, {align: 'center'});
            index++
         };

            const pdfBuffer = doc.output('arraybuffer');

            // Set headers and send the response
            return new Response(Buffer.from(pdfBuffer), {
                headers:{
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'inline; filename=tickets.pdf'
                }
            })
        }

}
