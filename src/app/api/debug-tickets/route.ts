// src/app/api/debug-tickets/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
    try {
        // Get recent tickets from both tables
        const recentTickets = await db.tickets.findMany({
            take: 20,
            select: {
                ticket_number: true,
                created_at: true,
                first_name: true,
                last_name: true,
                name: true,
                phone_number: true,
                email: true,
                contact_id: true,
                status: true,
                order_id: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        const recentWinmeTickets = await db.tickets_winme.findMany({
            take: 10,
            select: {
                ticket_number: true,
                created_at: true,
                first_name: true,
                last_name: true,
                name: true,
                phone_number: true,
                email: true,
                contact_id: true,
                status: true,
                order_id: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Count total tickets
        const totalTickets = await db.tickets.count();
        const totalWinmeTickets = await db.tickets_winme.count();
        const activeTickets = await db.tickets.count({ where: { status: 'active' } });
        const activeWinmeTickets = await db.tickets_winme.count({ where: { status: 'active' } });

        // Check for new format tickets
        const newFormatTickets = await db.tickets.findMany({
            where: {
                ticket_number: {
                    contains: '-'
                }
            },
            take: 10,
            select: {
                ticket_number: true,
                created_at: true,
                first_name: true,
                last_name: true,
                order_id: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Check data quality for new format tickets specifically
        const newFormatDataCheck = await db.tickets.findMany({
            where: {
                ticket_number: {
                    contains: '-'
                }
            },
            take: 10,
            select: {
                ticket_number: true,
                created_at: true,
                first_name: true,
                last_name: true,
                name: true,
                phone_number: true,
                email: true,
                contact_id: true,
                order_id: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // 🔧 DEBUG: Check contact_id patterns
        const contactIdAnalysis = await db.tickets.findMany({
            take: 20,
            select: {
                ticket_number: true,
                contact_id: true,
                phone_number: true,
                email: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        const response = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTickets,
                totalWinmeTickets,
                activeTickets,
                activeWinmeTickets,
                newFormatTicketsCount: newFormatTickets.length
            },
            contactIdPatterns: contactIdAnalysis.map(t => ({
                ticket_number: t.ticket_number,
                contact_id: t.contact_id,
                contact_id_type: t.contact_id ? (
                    t.contact_id.includes('@') ? 'email' : 
                    /^\d{10,}$/.test(String(t.contact_id).replace(/\D/g, '')) ? 'phone' : 
                    'other'
                ) : 'null',
                phone_number: t.phone_number,
                email: t.email,
                has_phone_data: !!(t.phone_number || (t.contact_id && /^\d{10,}$/.test(String(t.contact_id).replace(/\D/g, ''))))
            })),
            recentTickets: recentTickets.map(t => ({
                ticket_number: t.ticket_number,
                created_at: t.created_at?.toISOString(),
                created_at_est: t.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                first_name: t.first_name,
                last_name: t.last_name,
                name: t.name,
                displayName: t.first_name && t.last_name ? `${t.first_name} ${t.last_name}` : t.name,
                phone_number: t.phone_number,
                email: t.email,
                contact_id: t.contact_id,
                status: t.status,
                order_id: t.order_id,
                hasContactData: !!(t.phone_number || t.email)
            })),
            recentWinmeTickets: recentWinmeTickets.map(t => ({
                ticket_number: t.ticket_number,
                created_at: t.created_at?.toISOString(),
                created_at_est: t.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                first_name: t.first_name,
                last_name: t.last_name,
                name: t.name,
                displayName: t.first_name && t.last_name ? `${t.first_name} ${t.last_name}` : t.name,
                phone_number: t.phone_number,
                email: t.email,
                contact_id: t.contact_id,
                status: t.status,
                order_id: t.order_id,
                hasContactData: !!(t.phone_number || t.email)
            })),
            newFormatTicketsWithData: newFormatDataCheck.map(t => ({
                ticket_number: t.ticket_number,
                created_at: t.created_at?.toISOString(),
                created_at_est: t.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                first_name: t.first_name,
                last_name: t.last_name,
                name: t.name,
                phone_number: t.phone_number,
                email: t.email,
                contact_id: t.contact_id,
                order_id: t.order_id,
                hasContactData: !!(t.phone_number || t.email || (t.contact_id && t.contact_id !== t.order_id))
            })),
            newFormatTickets: newFormatTickets.map(t => ({
                ticket_number: t.ticket_number,
                created_at: t.created_at?.toISOString(),
                created_at_est: t.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
                order_id: t.order_id,
                isNewFormat: t.ticket_number?.includes('-') && t.ticket_number?.match(/^[a-zA-Z0-9]+-[a-f0-9]{6}-\d{6}$/)
            }))
        };

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Debug endpoint error:', error);
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
