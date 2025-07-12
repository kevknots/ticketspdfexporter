// src/app/api/debug-layout/route.ts

import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    try {
        // Same calculations as in the PDF generation
        const marginX = 5;
        const marginY = 5;
        const startX = 10;
        const startY = 10;
        
        const ticketsPerRow = 8;
        const ticketsPerColumn = 6;
        const totalTicketsPerPage = ticketsPerRow * ticketsPerColumn;
        
        // A3 landscape dimensions
        const a3Width = 420;
        const a3Height = 297;
        
        const availableWidth = a3Width - (2 * startX);
        const availableHeight = a3Height - (2 * startY);
        
        const ticketWidth = (availableWidth - (ticketsPerRow - 1) * marginX) / ticketsPerRow;
        const ticketHeight = (availableHeight - (ticketsPerColumn - 1) * marginY) / ticketsPerColumn;
        
        const totalUsedWidth = startX + (ticketsPerRow * ticketWidth) + ((ticketsPerRow-1) * marginX) + startX;
        const totalUsedHeight = startY + (ticketsPerColumn * ticketHeight) + ((ticketsPerColumn-1) * marginY) + startY;
        
        // Calculate sample positions for first row
        const samplePositions = [];
        for (let col = 0; col < ticketsPerRow; col++) {
            const xPosition = startX + col * (ticketWidth + marginX);
            const yPosition = startY;
            samplePositions.push({
                col,
                x: Math.round(xPosition * 100) / 100,
                y: Math.round(yPosition * 100) / 100
            });
        }

        const response = {
            format: "A3 Landscape",
            paperDimensions: {
                width: a3Width,
                height: a3Height
            },
            margins: {
                startX,
                startY,
                marginX,
                marginY
            },
            grid: {
                ticketsPerRow,
                ticketsPerColumn,
                totalTicketsPerPage
            },
            calculatedTicketSize: {
                width: Math.round(ticketWidth * 100) / 100,
                height: Math.round(ticketHeight * 100) / 100
            },
            available: {
                width: availableWidth,
                height: availableHeight
            },
            totalUsed: {
                width: Math.round(totalUsedWidth * 100) / 100,
                height: Math.round(totalUsedHeight * 100) / 100
            },
            fits: {
                width: totalUsedWidth <= a3Width,
                height: totalUsedHeight <= a3Height
            },
            sampleFirstRowPositions: samplePositions,
            warnings: [
                ...(ticketWidth < 40 ? ["Ticket width seems small for A3"] : []),
                ...(totalUsedWidth > a3Width ? ["Layout exceeds A3 width"] : []),
                ...(totalUsedHeight > a3Height ? ["Layout exceeds A3 height"] : [])
            ]
        };

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Layout debug error:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
