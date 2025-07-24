// src/app/api/debug-tickets-enhanced/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const lte = url.searchParams.get('lte');
        const gte = url.searchParams.get('gte');
        const type = url.searchParams.get('type') || 'badd';
        const limit = parseInt(url.searchParams.get('limit') || '50');

        console.log('🔍 DEBUG ENDPOINT CALLED:', {
            lte,
            gte,
            type,
            limit,
            timestamp: new Date().toISOString()
        });

        // Date conversion analysis
        let dateAnalysis = null;
        let whereClause: any = { status: 'active' };

        if (lte && gte) {
            const lteDate = new Date(lte);
            const gteDate = new Date(gte);

            // IMPORTANT: The dates from frontend are already in ISO format
            // We should use them directly without timezone conversion
            whereClause.created_at = {
                lte: lteDate,
                gte: gteDate
            };

            dateAnalysis = {
                input: {
                    lte: lte,
                    gte: gte,
                    lteDate: lteDate.toISOString(),
                    gteDate: gteDate.toISOString()
                },
                interpretation: {
                    lteEST: lteDate.toLocaleString("en-US", {timeZone: "America/New_York"}),
                    gteEST: gteDate.toLocaleString("en-US", {timeZone: "America/New_York"}),
                    lteUTC: lteDate.toISOString(),
                    gteUTC: gteDate.toISOString()
                },
                note: "Using dates directly as provided by frontend (ISO format)"
            };
        }

        // Get tickets with full data
        const tickets = await (type === 'winme' ? db.tickets_winme : db.tickets).findMany({
            where: whereClause,
            take: limit,
            orderBy: { created_at: 'desc' }
        });

        // Analyze phone number patterns
        const phoneAnalysis = tickets.map(ticket => {
            const phoneFields = {
                phone_number: ticket.phone_number,
                contact_id: ticket.contact_id,
                email: ticket.email
            };

            // Check if contact_id looks like a phone
            const contactIdIsPhone = ticket.contact_id && 
                !ticket.contact_id.includes('@') && 
                /^\d{10,}$/.test(String(ticket.contact_id).replace(/\D/g, ''));

            // Extract phone logic (matching generate endpoint)
            let extractedPhone = '';
            if (ticket.phone_number && ticket.phone_number.trim()) {
                extractedPhone = ticket.phone_number.trim();
            } else if (contactIdIsPhone) {
                const digits = String(ticket.contact_id).replace(/\D/g, '');
                if (digits.length === 10) {
                    extractedPhone = digits;
                } else if (digits.length === 11 && digits.startsWith('1')) {
                    extractedPhone = digits.substring(1);
                }
            }

            return {
                ticket_number: ticket.ticket_number,
                order_id: ticket.order_id,
                created_at: ticket.created_at?.toISOString(),
                created_at_est: ticket.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                phoneFields,
                analysis: {
                    hasPhoneNumber: !!ticket.phone_number,
                    hasContactId: !!ticket.contact_id,
                    contactIdIsEmail: ticket.contact_id?.includes('@') || false,
                    contactIdIsPhone,
                    extractedPhone,
                    wouldShowPhone: !!extractedPhone
                }
            };
        });

        // Count tickets by date
        const dateRangeCount = await (type === 'winme' ? db.tickets_winme : db.tickets).count({
            where: whereClause
        });

        // Get tickets with missing phones
        const missingPhoneCount = await (type === 'winme' ? db.tickets_winme : db.tickets).count({
            where: {
                ...whereClause,
                OR: [
                    { phone_number: null },
                    { phone_number: '' },
                    {
                        AND: [
                            { phone_number: null },
                            {
                                OR: [
                                    { contact_id: null },
                                    { contact_id: '' },
                                    { contact_id: { contains: '@' } }
                                ]
                            }
                        ]
                    }
                ]
            }
        });

        // Sample of tickets with missing phones
        const missingPhoneSamples = await (type === 'winme' ? db.tickets_winme : db.tickets).findMany({
            where: {
                ...whereClause,
                phone_number: null
            },
            take: 10,
            select: {
                ticket_number: true,
                order_id: true,
                contact_id: true,
                phone_number: true,
                email: true,
                first_name: true,
                last_name: true,
                created_at: true
            }
        });

        // Get date range boundaries
        const oldestTicket = await (type === 'winme' ? db.tickets_winme : db.tickets).findFirst({
            where: { status: 'active' },
            orderBy: { created_at: 'asc' },
            select: { created_at: true, ticket_number: true }
        });

        const newestTicket = await (type === 'winme' ? db.tickets_winme : db.tickets).findFirst({
            where: { status: 'active' },
            orderBy: { created_at: 'desc' },
            select: { created_at: true, ticket_number: true }
        });

        // Raw SQL query to double-check date filtering
        let rawDateCheck = null;
        if (lte && gte) {
            const tableName = type === 'winme' ? 'tickets_winme' : 'tickets';
            const lteDate = new Date(lte);
            const gteDate = new Date(gte);
            const rawQuery = `
                SELECT COUNT(*) as count,
                       MIN(created_at) as min_date,
                       MAX(created_at) as max_date
                FROM ${tableName}
                WHERE created_at >= $1::timestamp
                  AND created_at <= $2::timestamp
                  AND status = 'active'
            `;
            
            try {
                const result = await db.$queryRawUnsafe(rawQuery, 
                    gteDate, 
                    lteDate
                );
                rawDateCheck = result;
            } catch (e) {
                rawDateCheck = { error: String(e) };
            }
        }

        const response = {
            timestamp: new Date().toISOString(),
            query: {
                type,
                dateRange: dateAnalysis,
                whereClause
            },
            summary: {
                totalInDateRange: dateRangeCount,
                sampledCount: tickets.length,
                missingPhoneCount,
                missingPhonePercentage: ((missingPhoneCount / dateRangeCount) * 100).toFixed(2) + '%'
            },
            dataRange: {
                oldest: {
                    ticket: oldestTicket?.ticket_number,
                    date: oldestTicket?.created_at?.toISOString(),
                    dateEST: oldestTicket?.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"})
                },
                newest: {
                    ticket: newestTicket?.ticket_number,
                    date: newestTicket?.created_at?.toISOString(),
                    dateEST: newestTicket?.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"})
                }
            },
            rawSQLCheck: rawDateCheck,
            phoneAnalysis: {
                summary: {
                    total: phoneAnalysis.length,
                    withPhone: phoneAnalysis.filter(t => t.analysis.wouldShowPhone).length,
                    withoutPhone: phoneAnalysis.filter(t => !t.analysis.wouldShowPhone).length,
                    phoneFromContactId: phoneAnalysis.filter(t => !t.phoneFields.phone_number && t.analysis.contactIdIsPhone).length
                },
                samples: phoneAnalysis.slice(0, 10)
            },
            missingPhoneSamples: missingPhoneSamples.map(t => ({
                ...t,
                created_at_iso: t.created_at?.toISOString(),
                created_at_est: t.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"})
            }))
        };

        // Log to server console for debugging
        console.log('📊 DEBUG RESULTS:', JSON.stringify(response, null, 2));

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('❌ Debug endpoint error:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        }, null, 2), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
