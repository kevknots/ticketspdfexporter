// src/app/api/debug-comprehensive/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

interface DebugTicket {
    ticket_number: string | null;
    order_id: string | null;
    created_at: Date | null;
    phone_number: string | null;
    email: string | null;
    contact_id: string | null;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    status: string | null;
}
export const duration = 300;

async function analyzeTickets(tableName: 'tickets' | 'tickets_winme', dateFilter?: { gte: Date; lte: Date }) {
    const where = dateFilter ? {
        created_at: {
            gte: dateFilter.gte,
            lte: dateFilter.lte
        },
        status: 'active'
    } : { status: 'active' };

    // --- Fix: Use conditional logic to access the specific model ---
    let totalCount, withPhoneCount, withoutPhoneCount, samples, phoneInContactId;

    if (tableName === 'tickets') {
        // Access the 'tickets' model directly
        totalCount = await db.tickets.count({ where });
        withPhoneCount = await db.tickets.count({
            where: {
                ...where,
                NOT: [
                    { phone_number: null },
                    { phone_number: '' }
                ]
            }
        });
        withoutPhoneCount = await db.tickets.count({
            where: {
                ...where,
                OR: [
                    { phone_number: null },
                    { phone_number: '' }
                ]
            }
        });
        samples = await db.tickets.findMany({
            where,
            take: 20,
            orderBy: { created_at: 'desc' },
            select: {
                ticket_number: true,
                order_id: true,
                created_at: true,
                phone_number: true,
                email: true,
                contact_id: true,
                first_name: true,
                last_name: true,
                name: true,
                status: true
            }
        });
         phoneInContactId = await db.tickets.count({
            where: {
                ...where,
                AND: [
                    { OR: [{ phone_number: null }, { phone_number: '' }] },
                    { contact_id: { not: null } },
                    { NOT: { contact_id: { contains: '@' } } }
                ]
            }
        });
    } else { // tableName === 'tickets_winme'
        // Access the 'tickets_winme' model directly
        totalCount = await db.tickets_winme.count({ where });
        withPhoneCount = await db.tickets_winme.count({
            where: {
                ...where,
                NOT: [
                    { phone_number: null },
                    { phone_number: '' }
                ]
            }
        });
        withoutPhoneCount = await db.tickets_winme.count({
            where: {
                ...where,
                OR: [
                    { phone_number: null },
                    { phone_number: '' }
                ]
            }
        });
        samples = await db.tickets_winme.findMany({
            where,
            take: 20,
            orderBy: { created_at: 'desc' },
            select: {
                ticket_number: true,
                order_id: true,
                created_at: true,
                phone_number: true,
                email: true,
                contact_id: true,
                first_name: true,
                last_name: true,
                name: true,
                status: true
            }
        });
        phoneInContactId = await db.tickets_winme.count({
            where: {
                ...where,
                AND: [
                    { OR: [{ phone_number: null }, { phone_number: '' }] },
                    { contact_id: { not: null } },
                    { NOT: { contact_id: { contains: '@' } } }
                ]
            }
        });
    }

    // Type assertion for samples to DebugTicket[] is still needed
    const typedSamples = samples as DebugTicket[];

    // --- Fix: The rest of the function uses typedSamples instead of samples ---
    const contactIdPatterns = {
        total: 0,
        email: 0,
        phone: 0,
        null: 0,
        other: 0
    };

    typedSamples.forEach(ticket => {
        if (!ticket.contact_id) {
            contactIdPatterns.null++;
        } else if (ticket.contact_id.includes('@')) {
            contactIdPatterns.email++;
        } else if (/^\d{10,11}$/.test(ticket.contact_id.replace(/\D/g, ''))) {
            contactIdPatterns.phone++;
        } else {
            contactIdPatterns.other++;
        }
        contactIdPatterns.total++;
    });


    return {
        tableName,
        totalCount,
        withPhoneCount,
        withoutPhoneCount,
        phonePercentage: totalCount > 0 ? ((withPhoneCount / totalCount) * 100).toFixed(2) : '0',
        phoneInContactId,
        contactIdPatterns,
        samples: typedSamples.map(ticket => ({
            ticket_number: ticket.ticket_number,
            order_id: ticket.order_id,
            created_at: ticket.created_at?.toISOString(),
            created_at_est: ticket.created_at?.toLocaleString("en-US", { timeZone: "America/New_York" }),
            phone_number: ticket.phone_number,
            email: ticket.email,
            contact_id: ticket.contact_id,
            name: ticket.name || `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim(),
            status: ticket.status,
            phone_analysis: {
                has_phone: !!(ticket.phone_number && ticket.phone_number.trim()),
                has_email: !!(ticket.email && ticket.email.trim()),
                contact_is_email: ticket.contact_id?.includes('@') || false,
                contact_is_phone: ticket.contact_id ? /^\d{10,11}$/.test(ticket.contact_id.replace(/\D/g, '')) : false,
                potential_phone: ticket.phone_number ||
                    (ticket.contact_id && !ticket.contact_id.includes('@') ? ticket.contact_id : null)
            }
        }))
    };
}
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const lte = url.searchParams.get('lte');
        const gte = url.searchParams.get('gte');
        const type = url.searchParams.get('type'); // 'badd', 'winme', or null for both

        console.log('🔍 COMPREHENSIVE DEBUG:', { lte, gte, type });

        // Parse dates if provided
        let dateFilter = undefined;
        let dateAnalysis = null;

        if (lte && gte) {
            const lteDate = new Date(lte);
            const gteDate = new Date(gte);

            if (!isNaN(lteDate.getTime()) && !isNaN(gteDate.getTime())) {
                dateFilter = { lte: lteDate, gte: gteDate };
                
                dateAnalysis = {
                    input: { lte, gte },
                    parsed: {
                        lte: lteDate.toISOString(),
                        gte: gteDate.toISOString(),
                        lte_est: lteDate.toLocaleString("en-US", {timeZone: "America/New_York"}),
                        gte_est: gteDate.toLocaleString("en-US", {timeZone: "America/New_York"})
                    }
                };
            }
        }

        // Analyze tickets based on type
        const results = [];
        
        if (!type || type === 'badd') {
            const baddAnalysis = await analyzeTickets('tickets', dateFilter);
            results.push(baddAnalysis);
        }
        
        if (!type || type === 'winme') {
            const winmeAnalysis = await analyzeTickets('tickets_winme', dateFilter);
            results.push(winmeAnalysis);
        }

        // Get date boundaries
        const boundaries = {
            tickets: null as any,
            tickets_winme: null as any
        };

        if (!type || type === 'badd') {
            const oldestTicket = await db.tickets.findFirst({
                where: { status: 'active' },
                orderBy: { created_at: 'asc' },
                select: { created_at: true, ticket_number: true }
            });
            const newestTicket = await db.tickets.findFirst({
                where: { status: 'active' },
                orderBy: { created_at: 'desc' },
                select: { created_at: true, ticket_number: true }
            });

            boundaries.tickets = {
                oldest: oldestTicket ? {
                    date: oldestTicket.created_at?.toISOString(),
                    date_est: oldestTicket.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                    ticket: oldestTicket.ticket_number
                } : null,
                newest: newestTicket ? {
                    date: newestTicket.created_at?.toISOString(),
                    date_est: newestTicket.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                    ticket: newestTicket.ticket_number
                } : null
            };
        }

        if (!type || type === 'winme') {
            const oldestWinme = await db.tickets_winme.findFirst({
                where: { status: 'active' },
                orderBy: { created_at: 'asc' },
                select: { created_at: true, ticket_number: true }
            });
            const newestWinme = await db.tickets_winme.findFirst({
                where: { status: 'active' },
                orderBy: { created_at: 'desc' },
                select: { created_at: true, ticket_number: true }
            });

            boundaries.tickets_winme = {
                oldest: oldestWinme ? {
                    date: oldestWinme.created_at?.toISOString(),
                    date_est: oldestWinme.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                    ticket: oldestWinme.ticket_number
                } : null,
                newest: newestWinme ? {
                    date: newestWinme.created_at?.toISOString(),
                    date_est: newestWinme.created_at?.toLocaleString("en-US", {timeZone: "America/New_York"}),
                    ticket: newestWinme.ticket_number
                } : null
            };
        }

        // Look for specific data quality issues
        const dataIssues = [];

        // Check for tickets with order_id but no phone
        const ticketsWithOrderNoPhone = await db.tickets.count({
            where: {
                AND: [
                    { order_id: { not: null } },
                    { OR: [{ phone_number: null }, { phone_number: '' }] }
                ]
            }
        });

        if (ticketsWithOrderNoPhone > 0) {
            dataIssues.push({
                type: 'missing_phone_with_order',
                count: ticketsWithOrderNoPhone,
                message: `${ticketsWithOrderNoPhone} tickets have order_id but no phone - can fetch from Shopify`
            });
        }

        // Check for old format tickets
        const oldFormatCount = await db.tickets.count({
            where: {
                OR: [
                    { ticket_number: null },
                    { NOT: { ticket_number: { contains: '-' } } }
                ]
            }
        });

        if (oldFormatCount > 0) {
            dataIssues.push({
                type: 'old_ticket_format',
                count: oldFormatCount,
                message: `${oldFormatCount} tickets have old or missing ticket number format`
            });
        }

        // Summary
        const totalAnalyzed = results.reduce((sum, r) => sum + r.totalCount, 0);
        const totalWithPhone = results.reduce((sum, r) => sum + r.withPhoneCount, 0);
        const totalWithoutPhone = results.reduce((sum, r) => sum + r.withoutPhoneCount, 0);
        const totalPhoneInContactId = results.reduce((sum, r) => sum + r.phoneInContactId, 0);

        const response = {
            timestamp: new Date().toISOString(),
            query: {
                type: type || 'both',
                dateFilter: dateAnalysis
            },
            summary: {
                totalTickets: totalAnalyzed,
                withPhone: totalWithPhone,
                withoutPhone: totalWithoutPhone,
                phonePercentage: totalAnalyzed > 0 ? ((totalWithPhone / totalAnalyzed) * 100).toFixed(2) + '%' : '0%',
                potentialPhonesInContactId: totalPhoneInContactId
            },
            dataBoundaries: boundaries,
            tableAnalysis: results,
            dataIssues,
            recommendations: [
                totalPhoneInContactId > 0 && 
                    `${totalPhoneInContactId} tickets might have phone numbers in contact_id field`,
                totalWithoutPhone > 100 && 
                    `${totalWithoutPhone} tickets missing phones - consider Shopify lookup`,
                dataIssues.length > 0 && 
                    `Found ${dataIssues.length} data quality issues that need attention`
            ].filter(Boolean)
        };

        console.log('📊 Debug Summary:', {
            totalTickets: response.summary.totalTickets,
            phonePercentage: response.summary.phonePercentage,
            issues: dataIssues.length
        });

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('❌ Debug error:', error);
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
