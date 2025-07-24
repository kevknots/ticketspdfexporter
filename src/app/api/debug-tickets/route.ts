// src/app/api/debug-comprehensive/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

interface DebugTicket {
    ticket_number: string | null;
    order_id: string | null;
    created_at: Date | null;
    order_date: Date | null; // Add order_date for analysis
    order_date_time: Date | null; // Add order_date_time for analysis
    phone_number: string | null;
    email: string | null;
    contact_id: string | null;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    status: string | null;
    product_name: string | null; // Might be useful
}

export const maxDuration = 300;

async function analyzeTickets(tableName: 'tickets' | 'tickets_winme', dateFilter?: { gte: Date; lte: Date }) {
    // Ensure dateFilter is always defined for our specific analysis
    const whereBase = dateFilter ? {
        created_at: {
            gte: dateFilter.gte,
            lte: dateFilter.lte
        },
        status: 'active'
    } : { status: 'active' };

    let totalCount, withPhoneCount, withoutPhoneCount, withEmailCount, withoutEmailCount, samples, phoneInContactId;

    if (tableName === 'tickets') {
        // --- Specific Analysis for Client's Concerns (July 1-10, 2025) ---
        // Define the sub-ranges if the overall filter matches the client period
        const isClientPeriod = dateFilter?.gte?.toISOString()?.startsWith('2025-07-01T') && dateFilter?.lte?.toISOString()?.startsWith('2025-07-10T');
        let july1to8Analysis = null;
        let july9to10Analysis = null;

        if (isClientPeriod) {
            const july1Start = new Date('2025-07-01T00:00:00Z');
            const july8End = new Date('2025-07-08T23:59:59.999Z');
            const july9Start = new Date('2025-07-09T00:00:00Z');
            const july10End = new Date('2025-07-10T23:59:59.999Z');

            // --- Analysis for July 1-8: Date Mismatches ---
            const july1to8Where = {
                ...whereBase,
                created_at: {
                    gte: july1Start,
                    lte: july8End
                }
            };
            const totalJuly1to8 = await db.tickets.count({ where: july1to8Where });

            // Find tickets created in July 1-8 but ordered in June
            // Assuming order_date represents the original order date
            const juneStart = new Date('2025-06-01T00:00:00Z');
            const juneEnd = new Date('2025-06-30T23:59:59.999Z');

            const mismatchedJuly1to8Count = await db.tickets.count({
                where: {
                    ...july1to8Where,
                    order_date: {
                        gte: juneStart,
                        lte: juneEnd
                    }
                }
            });

            const mismatchedJuly1to8Samples = await db.tickets.findMany({
                where: {
                    ...july1to8Where,
                    order_date: {
                        gte: juneStart,
                        lte: juneEnd
                    }
                },
                take: 10, // Get samples
                orderBy: { created_at: 'asc' },
                select: {
                    ticket_number: true,
                    order_id: true,
                    created_at: true,
                    order_date: true,
                    order_date_time: true,
                    phone_number: true,
                    email: true,
                    contact_id: true,
                    first_name: true,
                    last_name: true,
                    name: true,
                    status: true,
                    product_name: true
                }
            });

            july1to8Analysis = {
                period: "July 1-8, 2025",
                totalTickets: totalJuly1to8,
                mismatchedOrderDateCount: mismatchedJuly1to8Count, // Tickets created July 1-8, ordered June
                mismatchedOrderDatePercentage: totalJuly1to8 > 0 ? ((mismatchedJuly1to8Count / totalJuly1to8) * 100).toFixed(2) : '0',
                mismatchedSamples: mismatchedJuly1to8Samples.map(ticket => ({
                    ticket_number: ticket.ticket_number,
                    order_id: ticket.order_id,
                    created_at: ticket.created_at?.toISOString(),
                    created_at_date: ticket.created_at ? ticket.created_at.toISOString().split('T')[0] : null,
                    order_date: ticket.order_date ? ticket.order_date.toISOString().split('T')[0] : null,
                    order_date_time: ticket.order_date_time?.toISOString(),
                    name: ticket.name || `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim(),
                    product_name: ticket.product_name
                   // Add more fields if needed for debugging
                }))
            };

            // --- Analysis for July 9-10: Missing Tickets ---
            const july9to10Where = {
                ...whereBase,
                created_at: {
                    gte: july9Start,
                    lte: july10End
                }
            };
            const totalJuly9to10 = await db.tickets.count({ where: july9to10Where });
            // Get samples if any exist, otherwise just confirm zero
            const july9to10Samples = await db.tickets.findMany({
                 where: july9to10Where,
                 take: 5, // Small sample if any exist
                 orderBy: { created_at: 'asc' },
                 select: {
                    ticket_number: true,
                    order_id: true,
                    created_at: true,
                    order_date: true,
                    phone_number: true,
                    email: true,
                    name: true,
                    product_name: true,
                    first_name: true,
                    last_name: true,
                 }
            });

            july9to10Analysis = {
                period: "July 9-10, 2025",
                totalTickets: totalJuly9to10,
                samplesIfAny: july9to10Samples.map(ticket => ({
                     ticket_number: ticket.ticket_number,
                     order_id: ticket.order_id,
                     created_at: ticket.created_at?.toISOString(),
                     order_date: ticket.order_date ? ticket.order_date.toISOString().split('T')[0] : null,
                     name: ticket.name || `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim(),
                     product_name: ticket.product_name
                }))
            };
        }

        // --- Standard Analysis for the requested date range ---
        totalCount = await db.tickets.count({ where: whereBase });
        withPhoneCount = await db.tickets.count({
            where: {
                ...whereBase,
                NOT: [
                    { phone_number: null },
                    { phone_number: '' }
                ]
            }
        });
        withoutPhoneCount = totalCount - withPhoneCount; // Simpler calculation

        withEmailCount = await db.tickets.count({
             where: {
                 ...whereBase,
                 NOT: [
                     { email: null },
                     { email: '' }
                 ]
             }
        });
        withoutEmailCount = totalCount - withEmailCount;

        samples = await db.tickets.findMany({
            where: whereBase,
            take: 20,
            orderBy: { created_at: 'desc' },
            select: {
                ticket_number: true,
                order_id: true,
                created_at: true,
                order_date: true, // Include for context
                order_date_time: true, // Include for context
                phone_number: true,
                email: true,
                contact_id: true,
                first_name: true,
                last_name: true,
                name: true,
                status: true,
                product_name: true // Include for context
            }
        });

        phoneInContactId = await db.tickets.count({
            where: {
                ...whereBase,
                AND: [
                    { OR: [{ phone_number: null }, { phone_number: '' }] },
                    { contact_id: { not: null } },
                    { NOT: { contact_id: { contains: '@' } } }
                ]
            }
        });

        // Return enhanced analysis including specific client period checks
        const typedSamples = samples as DebugTicket[];
        const contactIdPatterns = {
            total: Math.min(20, typedSamples.length), // Adjust based on actual samples taken
            email: typedSamples.filter(t => t.contact_id?.includes('@')).length,
            phone: typedSamples.filter(t => t.contact_id && !t.contact_id.includes('@') && /^\d{10,11}$/.test(t.contact_id.replace(/\D/g, ''))).length,
            null: typedSamples.filter(t => !t.contact_id).length,
            other: typedSamples.filter(t => t.contact_id && !t.contact_id.includes('@') && !/^\d{10,11}$/.test(t.contact_id.replace(/\D/g, ''))).length
        };

        // Standard return structure enhanced with specific analysis
        const baseAnalysis = {
            tableName,
            totalCount,
            withPhoneCount,
            withoutPhoneCount,
            phonePercentage: totalCount > 0 ? ((withPhoneCount / totalCount) * 100).toFixed(2) : '0',
            withEmailCount,
            withoutEmailCount,
            emailPercentage: totalCount > 0 ? ((withEmailCount / totalCount) * 100).toFixed(2) : '0',
            phoneInContactId,
            contactIdPatterns,
            samples: typedSamples.map(ticket => ({
                ticket_number: ticket.ticket_number,
                order_id: ticket.order_id,
                created_at: ticket.created_at?.toISOString(),
                created_at_est: ticket.created_at?.toLocaleString("en-US", { timeZone: "America/New_York" }),
                order_date: ticket.order_date ? ticket.order_date.toISOString().split('T')[0] : null, // Format as YYYY-MM-DD
                phone_number: ticket.phone_number,
                email: ticket.email,
                contact_id: ticket.contact_id,
                name: ticket.name || `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim(),
                status: ticket.status,
                product_name: ticket.product_name,
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

        // Add specific client period analysis if applicable
        if (isClientPeriod) {
            (baseAnalysis as any).clientPeriodAnalysis = {
                july1to8: july1to8Analysis,
                july9to10: july9to10Analysis
            };
        }

        return baseAnalysis;

    } else { // tableName === 'tickets_winme'
        // Keep existing logic for winme if needed, or simplify/remove if focus is solely on 'tickets'
        // For now, keeping it simple and focused.
        totalCount = await db.tickets_winme.count({ where: whereBase });
        withPhoneCount = await db.tickets_winme.count({
            where: {
                ...whereBase,
                NOT: [
                    { phone_number: null },
                    { phone_number: '' }
                ]
            }
        });
        withoutPhoneCount = totalCount - withPhoneCount;

         withEmailCount = await db.tickets_winme.count({
             where: {
                 ...whereBase,
                 NOT: [
                     { email: null },
                     { email: '' }
                 ]
             }
        });
        withoutEmailCount = totalCount - withEmailCount;

        samples = await db.tickets_winme.findMany({
            where: whereBase,
            take: 20,
            orderBy: { created_at: 'desc' },
            select: {
                ticket_number: true,
                order_id: true,
                created_at: true,
                 order_date: true,
                phone_number: true,
                email: true,
                contact_id: true,
                first_name: true,
                last_name: true,
                name: true,
                status: true,
                 product_name: true
            }
        });
        phoneInContactId = await db.tickets_winme.count({
            where: {
                ...whereBase,
                AND: [
                    { OR: [{ phone_number: null }, { phone_number: '' }] },
                    { contact_id: { not: null } },
                    { NOT: { contact_id: { contains: '@' } } }
                ]
            }
        });

         const typedSamples = samples as DebugTicket[];
        const contactIdPatterns = {
            total: Math.min(20, typedSamples.length),
            email: typedSamples.filter(t => t.contact_id?.includes('@')).length,
            phone: typedSamples.filter(t => t.contact_id && !t.contact_id.includes('@') && /^\d{10,11}$/.test(t.contact_id.replace(/\D/g, ''))).length,
            null: typedSamples.filter(t => !t.contact_id).length,
            other: typedSamples.filter(t => t.contact_id && !t.contact_id.includes('@') && !/^\d{10,11}$/.test(t.contact_id.replace(/\D/g, ''))).length
        };

        return {
            tableName,
            totalCount,
            withPhoneCount,
            withoutPhoneCount,
            phonePercentage: totalCount > 0 ? ((withPhoneCount / totalCount) * 100).toFixed(2) : '0',
             withEmailCount,
            withoutEmailCount,
            emailPercentage: totalCount > 0 ? ((withEmailCount / totalCount) * 100).toFixed(2) : '0',
            phoneInContactId,
            contactIdPatterns,
            samples: typedSamples.map(ticket => ({
                ticket_number: ticket.ticket_number,
                order_id: ticket.order_id,
                created_at: ticket.created_at?.toISOString(),
                created_at_est: ticket.created_at?.toLocaleString("en-US", { timeZone: "America/New_York" }),
                 order_date: ticket.order_date ? ticket.order_date.toISOString().split('T')[0] : null,
                phone_number: ticket.phone_number,
                email: ticket.email,
                contact_id: ticket.contact_id,
                name: ticket.name || `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim(),
                status: ticket.status,
                 product_name: ticket.product_name,
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
                        lte_est: lteDate.toLocaleString("en-US", { timeZone: "America/New_York" }),
                        gte_est: gteDate.toLocaleString("en-US", { timeZone: "America/New_York" })
                    }
                };
            }
        }

        // Analyze tickets based on type (defaulting to 'badd'/'tickets' for focused debug)
        const results = [];
        if (!type || type === 'badd') {
            const baddAnalysis = await analyzeTickets('tickets', dateFilter);
            results.push(baddAnalysis);
        }
        // Optionally analyze winme if needed
        // if (type === 'winme') {
        //     const winmeAnalysis = await analyzeTickets('tickets_winme', dateFilter);
        //     results.push(winmeAnalysis);
        // }

        // Get date boundaries (conditionally)
        const boundaries = {
            tickets: null as any,
            tickets_winme: null as any
        };
        if (!type || type === 'badd') {
            let boundaryWhere = { status: 'active' };
            if (dateFilter) {
                 boundaryWhere = { ...boundaryWhere, created_at: dateFilter }; // Apply filter if exists for boundary check within range
            }
            const oldestTicket = await db.tickets.findFirst({
                where: boundaryWhere,
                orderBy: { created_at: 'asc' },
                select: { created_at: true, ticket_number: true }
            });
            const newestTicket = await db.tickets.findFirst({
                where: boundaryWhere,
                orderBy: { created_at: 'desc' },
                select: { created_at: true, ticket_number: true }
            });
            boundaries.tickets = {
                oldest: oldestTicket ? {
                    date: oldestTicket.created_at?.toISOString(),
                    date_est: oldestTicket.created_at?.toLocaleString("en-US", { timeZone: "America/New_York" }),
                    ticket: oldestTicket.ticket_number
                } : null,
                newest: newestTicket ? {
                    date: newestTicket.created_at?.toISOString(),
                    date_est: newestTicket.created_at?.toLocaleString("en-US", { timeZone: "America/New_York" }),
                    ticket: newestTicket.ticket_number
                } : null
            };
        }
        // Boundary check for winme if needed
        // if (type === 'winme') { ... }

        // Summary (only for relevant tables)
        const totalAnalyzed = results.reduce((sum, r) => sum + r.totalCount, 0);
        const totalWithPhone = results.reduce((sum, r) => sum + r.withPhoneCount, 0);
        const totalWithoutPhone = results.reduce((sum, r) => sum + r.withoutPhoneCount, 0);
        const totalPhoneInContactId = results.reduce((sum, r) => sum + r.phoneInContactId, 0);
        const totalWithEmail = results.reduce((sum, r) => sum + (r.withEmailCount || 0), 0);
        const totalWithoutEmail = results.reduce((sum, r) => sum + (r.withoutEmailCount || 0), 0);

        const response = {
            timestamp: new Date().toISOString(),
            query: {
                type: type || 'badd', // Reflect actual type used
                dateFilter: dateAnalysis
            },
            summary: {
                totalTickets: totalAnalyzed,
                withPhone: totalWithPhone,
                withoutPhone: totalWithoutPhone,
                phonePercentage: totalAnalyzed > 0 ? ((totalWithPhone / totalAnalyzed) * 100).toFixed(2) + '%' : '0%',
                withEmail: totalWithEmail,
                withoutEmail: totalWithoutEmail,
                emailPercentage: totalAnalyzed > 0 ? ((totalWithEmail / totalAnalyzed) * 100).toFixed(2) + '%' : '0%',
                potentialPhonesInContactId: totalPhoneInContactId
            },
            dataBoundaries: boundaries,
            tableAnalysis: results, // This will now contain the specific client period analysis
            // dataIssues and recommendations can be simplified or removed for this specific debug view
            dataIssues: [],
            recommendations: [
                // Add dynamic recommendations based on findings if needed
            ].filter(Boolean)
        };

        console.log('📊 Debug Summary for Client Period:', {
            query: response.query,
            totalTickets: response.summary.totalTickets,
            phonePercentage: response.summary.phonePercentage
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
